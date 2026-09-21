# Prisma ORM 8 migration — Compute deploy

Prisma Compute's GA build pipeline requires **Prisma ORM 8**. Old Console
git-integration builds were paused after the Sept 7 "switch window," so pushes no
longer deploy until the repo is on Prisma 8 and connected to GA Compute.

This is the **incremental / side-by-side** migration from the official guide
(<https://www.prisma.io/docs/guides/upgrade-prisma-orm/postgresql>): Prisma 8 and
Prisma 7 run against the **same** database, and the app keeps working at every
step.

## What this PR already did (the foundation)

The app still runs entirely on the **Prisma 7 client** — nothing in `src/` was
rewritten, so behavior is unchanged. What changed:

- **Prisma 7 moved off the reserved names.** `prisma` (v7 CLI) → `@prisma/prisma7`
  (the `prisma7` binary); `prisma.config.ts` → `prisma7.config.ts` (imports from
  `@prisma/prisma7/config`); `package.json` scripts and `postinstall` now call
  `prisma7`. `@prisma/client` and `@prisma/adapter-pg` are untouched — better-auth
  and the MCP tools still use the Prisma 7 client.
- **Prisma 8 added.** `prisma@8.0.0-rc.14` (v8 CLI) + `@prisma/orm-postgres`
  (runtime), plus a v8 `prisma.config.ts`.
- **`prisma8/contract.prisma`** — a best-effort contract hand-translated from
  `prisma/schema.prisma` so `prisma contract emit` builds. **It is a placeholder**
  (see step 1 below).
- **`.npmrc`** sets `legacy-peer-deps=true` — the Prisma 8 RC packages otherwise
  break `npm install` with `Cannot read properties of null (reading 'edgesOut')`.
Deploys use GA Compute's **native framework detection** (first-class Next.js):
once the repo is connected with `prisma git connect`, pushing a branch builds and
deploys it — no GitHub Actions workflow and no Composer `module.ts` needed. (An
earlier revision added a `prisma/cloud-deploy-action` workflow; that is the
*Composer* deploy path, which this framework-detected app does not use, so it was
removed.)

Verified locally: `npm install`, `prisma7 generate`, `prisma contract emit`, and
`next build` all pass.

## What you must run (needs your live DB + Compute account)

These cannot run from the Claude sandbox — its network is locked to a fixed set
of hosts, so it can't reach your Prisma Postgres or Compute account, and it never
has your `DATABASE_URL` (a secret; keep it in `.env` / Compute env vars only).

Run everything below from a checkout of this branch with `DATABASE_URL` set in
`.env`.

### 1. Replace the placeholder contract with one inferred from your DB

`prisma db sign` (step 2) verifies the contract against the live database
**exactly** — constraint and index names included — so the hand-written contract
will not pass as-is. Regenerate it:

```bash
npx prisma contract infer --output prisma8/contract.prisma
```

Then re-apply the two edits the guide calls for:
1. **Delete the `PrismaMigrations` model** (`contract infer` picks up Prisma 7's
   `_prisma_migrations` ledger; Prisma 8 must not manage it).
2. **Keep an `@@map` on every model** so table names match what Prisma 7 created
   (`users`, `goals`, `food_logs`, `food_log_values`, `session`, `account`, etc.).

Then emit and sanity-check:

```bash
npx prisma contract emit
```

### 2. Hand migration ownership to Prisma 8 (adopt the existing DB)

Your database already has every table, so adopt it rather than replay migrations:

```bash
npx prisma db sign
npx prisma migration status   # current & target hashes should match, nothing pending
```

After this, stop using `prisma7 migrate` for schema changes; future changes go
through `prisma contract emit` → `prisma migration plan` → `prisma db migrate`.
`prisma7 generate` stays (the app's Prisma 7 client still needs it).

### 3. Connect the repo to GA Compute and deploy

```bash
npx prisma@latest auth login
npx prisma@latest git connect https://github.com/sharifshayma/Fitflow
```

`git connect` installs the Prisma GitHub App (OIDC, no repo secrets). GA Compute
then **detects the Next.js framework and builds/deploys on every push** — no
workflow file needed. Before pushing, set the production environment variables:

```bash
npx prisma@latest project env add DATABASE_URL=postgres://... --role production
npx prisma@latest project env add BETTER_AUTH_URL=https://fitflow.thatsmy.app --role production
```

(or set them in Console → project → Environment). Then push `main`; watch and
open the result:

```bash
npx prisma@latest service list
npx prisma@latest service logs <service> --follow
```

### 4. Verify the OAuth fix is live

Once deployed:

```bash
curl -s https://fitflow.thatsmy.app/.well-known/oauth-protected-resource | jq
```

Expect JSON with `authorization_servers` pointing at
`https://fitflow.thatsmy.app` (not a 404, not `localhost`). Then re-add the MCP
connector in Claude — authorization should reach the FitFlow login/consent screen.

## Deferred: move app queries to the Prisma 8 client

Not done in this PR (it's optional until you confirm the deploy works, and it
can't be tested against your DB from the sandbox). When you're ready, migrate the
MCP tools in `src/app/api/mcp/route.ts` (and the API routes) to the Prisma 8
client one at a time, per the guide's phase 3. Two things to watch:

- **The query API is different**: `prisma.goal.findMany({ where })` →
  `db.orm.public.Goal.where(...).all()`, etc. See
  <https://www.prisma.io/docs/orm/coming-from-prisma-orm-7>.
- **Dates come back as `Temporal.Instant`, not `Date`.** The dashboard/suggestions
  date math in `route.ts` (`getDaily`, `getSuggestions`, `getDashboard`) and the
  serializers would need reworking (or use the `TimestamptzString` contract type).
- **Preserve the `where: { userId }` scoping on every query** — that's the app's
  trust boundary (see the note at the top of `prisma/schema.prisma`).

better-auth has no Prisma 8 adapter, so it stays on the Prisma 7 client
indefinitely — the two ORMs continue to coexist.

## Package versions (pinned; RC software)

| Package | Version | Why pinned |
|---|---|---|
| `prisma` | `8.0.0-rc.14` | `rc.15` trips the npm `edgesOut` install bug |
| `@prisma/orm-postgres` | `8.0.0-rc.11` | current latest |
| `@prisma/prisma7` | `7.10.0-dev.58` | the Prisma 7 CLI under a side-by-side name |
| `@prisma/client`, `@prisma/adapter-pg` | `^7.9.1` | app runtime, unchanged |

Revisit the `legacy-peer-deps` and exact pins once Prisma 8 is out of RC.
