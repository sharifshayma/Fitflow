/**
 * Phase 5 — import existing data from Supabase into Prisma Postgres.
 *
 * Reads from the Supabase Postgres database (SUPABASE_DB_URL) and writes via the
 * app's Prisma client (DATABASE_URL). IDs, timestamps and user_id links are
 * preserved, so goals/logs stay attached to the same users. Migrated users have
 * NO credential account — they set a password via the reset flow on first login.
 *
 * Usage (from the repo root, with SUPABASE_DB_URL + DATABASE_URL in .env):
 *   npx tsx scripts/migrate-from-supabase.ts            # dry-run (no writes)
 *   npx tsx scripts/migrate-from-supabase.ts --commit   # perform the import
 *
 * Idempotent: every row is upserted by id, so it is safe to re-run.
 */
import "dotenv/config";
import { Client } from "pg";
import { prisma } from "../src/lib/prisma";

const COMMIT = process.argv.includes("--commit");

function log(...args: unknown[]) {
  console.log(...args);
}

async function main() {
  const supaUrl = process.env.SUPABASE_DB_URL;
  if (!supaUrl) {
    throw new Error(
      "SUPABASE_DB_URL is not set. Put your Supabase Postgres connection string in .env " +
        "(Supabase dashboard → Project Settings → Database → Connection string / URI)."
    );
  }

  const supa = new Client({ connectionString: supaUrl });
  await supa.connect();
  log(`Connected to Supabase. Mode: ${COMMIT ? "COMMIT (writing)" : "DRY-RUN (no writes)"}\n`);

  // --- Read source rows ---
  const users = (
    await supa.query(
      `select u.id, u.email, u.created_at,
              coalesce(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name') as name
       from auth.users u
       where u.email is not null`
    )
  ).rows;

  // Skip rows with no owner (user_id is null) — legacy pre-multi-user data.
  const goals = (
    await supa.query(
      `select id, user_id, name, unit, target_value,
              coalesce(goal_type, 'food') as goal_type,
              coalesce(direction, 'max') as direction,
              coalesce(sort_order, 0) as sort_order,
              created_at, updated_at
       from public.goals
       where user_id is not null`
    )
  ).rows;

  const foodLogs = (
    await supa.query(
      `select id, user_id, food_name, logged_at, created_at
       from public.food_logs
       where user_id is not null`
    )
  ).rows;

  const allValues = (
    await supa.query(
      `select id, food_log_id, goal_id, value from public.food_log_values`
    )
  ).rows;

  // Keep only values whose parent food_log AND referenced goal both survive the
  // owner filter — otherwise they'd be orphaned FKs.
  const goalIds = new Set(goals.map((g) => g.id));
  const foodLogIds = new Set(foodLogs.map((f) => f.id));
  const foodLogValues = allValues.filter(
    (v) => foodLogIds.has(v.food_log_id) && goalIds.has(v.goal_id)
  );
  const droppedValues = allValues.length - foodLogValues.length;

  log("Rows to import (owner-scoped; orphaned user_id=null rows skipped):");
  log(`  auth.users        : ${users.length}`);
  log(`  goals             : ${goals.length}`);
  log(`  food_logs         : ${foodLogs.length}`);
  log(`  food_log_values   : ${foodLogValues.length}  (dropped ${droppedValues} orphaned)\n`);

  if (users[0]) {
    log("Sample user:", { id: users[0].id, email: users[0].email, name: users[0].name });
  }
  if (goals[0]) {
    log("Sample goal:", {
      id: goals[0].id,
      user_id: goals[0].user_id,
      name: goals[0].name,
      target_value: goals[0].target_value,
      goal_type: goals[0].goal_type,
    });
  }
  log("");

  if (!COMMIT) {
    log("DRY-RUN complete — no data written. Re-run with --commit to import.");
    await supa.end();
    await prisma.$disconnect();
    return;
  }

  // --- Write in FK order: users → goals → food_logs → food_log_values ---
  let n = 0;

  for (const u of users) {
    await prisma.user.upsert({
      where: { id: u.id },
      create: {
        id: u.id,
        email: u.email,
        name: u.name ?? null,
        emailVerified: true, // pre-existing Supabase accounts
        createdAt: u.created_at ?? undefined,
      },
      update: { email: u.email, name: u.name ?? undefined },
    });
    n++;
  }
  log(`Users upserted: ${n}`);

  n = 0;
  for (const g of goals) {
    await prisma.goal.upsert({
      where: { id: g.id },
      create: {
        id: g.id,
        userId: g.user_id,
        name: g.name,
        unit: g.unit,
        targetValue: g.target_value,
        goalType: g.goal_type,
        direction: g.direction,
        sortOrder: g.sort_order,
        createdAt: g.created_at ?? undefined,
        updatedAt: g.updated_at ?? undefined,
      },
      update: {
        name: g.name,
        unit: g.unit,
        targetValue: g.target_value,
        goalType: g.goal_type,
        direction: g.direction,
        sortOrder: g.sort_order,
      },
    });
    n++;
  }
  log(`Goals upserted: ${n}`);

  n = 0;
  for (const f of foodLogs) {
    await prisma.foodLog.upsert({
      where: { id: f.id },
      create: {
        id: f.id,
        userId: f.user_id,
        foodName: f.food_name,
        loggedAt: f.logged_at,
        createdAt: f.created_at ?? undefined,
      },
      update: { foodName: f.food_name, loggedAt: f.logged_at },
    });
    n++;
  }
  log(`Food logs upserted: ${n}`);

  n = 0;
  for (const v of foodLogValues) {
    await prisma.foodLogValue.upsert({
      where: { id: v.id },
      create: {
        id: v.id,
        foodLogId: v.food_log_id,
        goalId: v.goal_id,
        value: v.value,
      },
      update: { value: v.value },
    });
    n++;
  }
  log(`Food log values upserted: ${n}\n`);

  // --- Reconcile ---
  const [pu, pg, pf, pv] = await Promise.all([
    prisma.user.count(),
    prisma.goal.count(),
    prisma.foodLog.count(),
    prisma.foodLogValue.count(),
  ]);
  log("Prisma Postgres row counts after import:");
  log(`  users             : ${pu}  (source ${users.length})`);
  log(`  goals             : ${pg}  (source ${goals.length})`);
  log(`  food_logs         : ${pf}  (source ${foodLogs.length})`);
  log(`  food_log_values   : ${pv}  (source ${foodLogValues.length})`);

  await supa.end();
  await prisma.$disconnect();
  log("\nImport complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
