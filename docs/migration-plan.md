# Fitflow migration — implementation plan

Phased plan to move Fitflow off Supabase to **Prisma Postgres + better-auth**, preserving
the OAuth/MCP integration and migrating existing data. See [`migration-spec.md`](./migration-spec.md).

**Global constraints**
- Preserve Supabase `auth.users.id` (UUID) as `User.id` — no FK remapping.
- Delete the local `mcp-server/` package (only the remote `/api/mcp` is kept).
- Every DB query is scoped by the authenticated `userId` (RLS is gone; the app is the trust boundary).
- Secrets only via env (`.env.local` / host env) — never committed.
- Each phase ends buildable (`npm run build`) and is verified before the next.

## Prerequisites (provide before the noted phase)

| # | Needed by | What |
|---|---|---|
| P1 | Phase 1 | **Prisma Postgres** DB — `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING` |
| P2 | Phase 3 | **better-auth** secret (`openssl rand -base64 32`) + `BETTER_AUTH_URL` |
| P3 | Phase 3 | **Resend** API key + verified `FROM` address (password-reset emails) |
| P4 | Phase 5 | **Supabase read access** — a connection string or a SQL dump of `auth.users` + the 3 tables |
| P5 | Phase 4 | The Claude.ai MCP **redirect URI(s)** to allowlist (from the current connector) |

---

## Phase 1 — Prisma + schema (needs P1)

**Goal:** Prisma wired to Prisma Postgres; the 4 domain tables + better-auth + OAuth tables modeled; initial migration applied to an empty Prisma Postgres.

- Add deps: `prisma`, `@prisma/client`, `better-auth`. `prisma init`.
- **Confirm live columns first:** connect to the current Supabase DB (read-only) and dump the
  actual columns/types of `goals`, `food_logs`, `food_log_values` (the base SQL omits
  `goal_type`/`direction`/`user_id` that the app uses — model what's really there).
- Write `prisma/schema.prisma`: `User`, `Goal`, `FoodLog`, `FoodLogValue` (per spec) + the
  better-auth tables (`Account`, `Session`, `Verification`) + OAuth tables (`OAuthCode`,
  `OAuthToken`, optional `OAuthClient`). `User.id` = UUID string (no default cuid so migrated
  ids can be reused; new signups generate a UUID).
- `lib/prisma.ts` singleton. `npx prisma migrate dev --name init` against Prisma Postgres.
- **Verify:** `npx prisma migrate deploy` clean; `npx prisma studio` shows empty tables; `npm run build`.

## Phase 2 — data layer to Prisma (behind an auth shim)

**Goal:** every `supabase.from(...)` in the API routes becomes a Prisma query scoped by `userId`. Auth still TBD, so read `userId` from a temporary shim (`getUserId(req)`), swapped for real in Phase 3.

- Routes to rewrite: `api/goals`, `api/goals/[id]`, `api/goals/reorder`, `api/food-logs`,
  `api/food-logs/[id]`, `api/food-logs/history`, `api/food-logs/suggestions`, `api/dashboard`.
- Each: replace the Supabase query with Prisma, adding `where: { userId }` (and nested checks
  for `food_log_values` via the parent `foodLog.userId`). Keep response shapes identical.
- Keep the zod validators (`lib/validators.ts`) as-is.
- **Verify:** `npm run build`; hit each route locally with a shim userId (seed one user + rows
  via `prisma studio`/a seed script) and confirm identical JSON to before.

## Phase 3 — better-auth (needs P2, P3)

**Goal:** replace Supabase web-auth with better-auth email/password + sessions + password reset.

- Configure better-auth (Prisma adapter, email/password, Resend for reset emails). Mount its
  handler at `app/api/auth/[...all]/route.ts`; add `lib/auth.ts` + `lib/auth-client.ts`.
- Rewrite `middleware.ts` to check the better-auth session (keep the same public-path allowlist:
  `/login`, `/auth`, `/authorize`, `/api/auth`, plus `/.well-known`, `/api/oauth`, `/api/mcp`).
- Rewrite `/login` to better-auth; add a **reset-password** request + confirm flow (email link).
- Replace the Phase-2 `getUserId` shim with the real better-auth session lookup.
- Delete Supabase web-auth: `lib/supabase-server.ts`, `supabase-browser.ts`, `auth/callback`,
  `api/auth/signout` (replace with better-auth signout).
- **Verify:** sign up + sign in + sign out; reset-password email arrives (Resend) and sets a new
  password; unauthenticated requests 401/redirect; the Phase-2 routes now use the real userId.

## Phase 4 — OAuth2 server + MCP (needs P5)

**Goal:** our own authorization-code server (with PKCE + own JWT tokens) and `/api/mcp` validating them; tools on Prisma.

- `/authorize`: require a better-auth session (else redirect to `/login?next=…`), consent, then
  mint a code row in `OAuthCode` `{ code, userId, clientId, redirectUri, codeChallenge, expiresAt }`
  and redirect back with `code` + `state`.
- `/api/oauth/token`: `authorization_code` → verify code + **PKCE** (`code_verifier`) → issue
  access JWT (`{ sub: userId }`, ~1h, signed with a server secret) + opaque refresh token in
  `OAuthToken`; `refresh_token` → rotate. Delete `lib/oauth-codes.ts` (the Supabase-wrapper).
- Update `/.well-known/oauth-authorization-server` + `/api/oauth/register` to describe our
  endpoints (persist registered clients in `OAuthClient` or keep stateless).
- `/api/mcp`: extract Bearer → verify our JWT → `userId` → run the 6 tools via Prisma, scoped by
  `userId`. Rewrite the inline tool handlers (`list_goals`, `save_goal`, `delete_goal`,
  `log_entry`, `get_logs`, `edit_log`) to Prisma.
- **Delete `mcp-server/`** (unused local stdio package).
- **Verify:** locally drive the OAuth flow (authorize → code → token → call `/api/mcp` with the
  JWT) and confirm the tools read/write the right user's data; then re-connect the Claude.ai
  connector against a preview deployment end-to-end.

## Phase 5 — data migration (needs P4)

**Goal:** move existing users + data from Supabase into Prisma Postgres.

- `scripts/migrate-from-supabase.ts` (`tsx`): read Supabase (env connection string) → write via
  Prisma. Users: `auth.users` → `User` (preserve id + email; no password). Then `goals`,
  `food_logs`, `food_log_values` preserving ids, timestamps, and `user_id` links.
- **Dry-run** (count + sample compare) before the real run; wrap the real import in a transaction
  where feasible; print row-count reconciliation.
- **Verify:** row counts match Supabase; spot-check a user's goals + a day's food log in
  `prisma studio`.

## Phase 6 — cutover & deploy

**Goal:** remove Supabase entirely and ship.

- Remove `@supabase/ssr`, `@supabase/supabase-js`; delete `lib/supabase*.ts`, the two
  `supabase-migration*.sql` files, and any leftover Supabase env. Update `.env.example` + README.
- Deploy to Vercel with the new env (Prisma Postgres, better-auth, Resend). `prisma migrate deploy`
  runs against prod (or was already run in Phase 5).
- Send migrated users their password-reset links.
- **Verify live:** sign in (after reset), CRUD goals + food logs, and the Claude.ai MCP connector
  reconnects and can list/log via the tools. Confirm the app no longer pauses (no Supabase).

## Self-review

- Spec coverage: DB (P1), data layer (P2), web auth + reset (P3), OAuth server + MCP + delete
  local mcp-server (P4), data migration incl. preserved ids (P5), cutover/deploy (P6) — all mapped.
- Every phase ends buildable and independently verifiable; secrets are env-only; the Supabase
  removal is last so each phase can be checked against the still-running old system if needed.
