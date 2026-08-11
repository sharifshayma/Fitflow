import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth-shim";

export async function GET(request: Request) {
  const userId = await getUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Look back up to a year, capped at 1000 rows for safety.
  const oneYearAgo = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);

  const rows = await prisma.foodLog.findMany({
    where: { userId, loggedAt: { gte: oneYearAgo } },
    orderBy: { loggedAt: "desc" },
    take: 1000,
    select: {
      id: true,
      foodName: true,
      loggedAt: true,
      values: { select: { goalId: true, value: true } },
    },
  });

  type HistoryItem = {
    food_name: string;
    count: number;
    last_logged_at: string;
    values: { goal_id: string; value: number }[];
  };

  const grouped = new Map<string, HistoryItem>();

  for (const row of rows) {
    const trimmed = row.foodName.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    // Skip the Water/Weight pseudo-entries — those have their own tabs.
    if (key === "water" || key === "weight") continue;

    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      // Rows are ordered by logged_at desc, so the first one seen is the most recent.
      grouped.set(key, {
        food_name: trimmed,
        count: 1,
        last_logged_at: row.loggedAt.toISOString(),
        values: row.values.map((v) => ({ goal_id: v.goalId, value: Number(v.value) })),
      });
    }
  }

  const items = Array.from(grouped.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return b.last_logged_at.localeCompare(a.last_logged_at);
  });

  return NextResponse.json(items, {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=300" },
  });
}
