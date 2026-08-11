# Fitflow — migrate off Supabase to Prisma Postgres + better-auth

**Date:** 2026-08-11
**Status:** Draft for review

## Goal

Stop the Supabase free-tier **project pause** (which takes down the DB *and* auth after
inactivity) by leaving Supabase **entirely**. Move the database to **Prisma Postgres**
(hosted Postgres whose free tier stays awake) via the **Prisma ORM**, move web auth to
**better-auth**, and re-implement the OAuth provider + MCP so they no longer depend on
Supabase tokens. Migrate all existing user data; existing users **reset their password on
first login**.

## Current architecture (what exists today)

- **Data model** (Postgres): `goals`, `food_logs`, `food_log_values`. A `v2-auth` migration
  added `user_id UUID REFERENCES auth.users(id)` to `goals` and `food_logs`, plus RLS
  policies scoping every row to `auth.uid()`.
- **Web auth:** Supabase Auth (email/password). `middleware.ts` calls `supabase.auth.getUser()`
  and redirects unauthenticated users to `/login`. API routes call `getSession()` then query
  `supabase.from(...)`; RLS enforces per-user scoping.
- **OAuth provider** (so Claude.ai can connect to the MCP server):
  - `/.well-known/oauth-authorization-server` — discovery metadata (RFC 8414).
  - `/api/oauth/register` — dynamic client registration (RFC 7591).
  - `/authorize` — a login form; on success it signs in via Supabase and calls `/api/oauth/code`.
  - `/api/oauth/code` + `lib/oauth-codes.ts` — the "auth code" is just a **base64-encoded JSON
    of the Supabase access/refresh tokens** (stateless, 5-min TTL). No real PKCE check.
  - `/api/oauth/token` — `authorization_code` unwraps the code back into Supabase tokens;
    `refresh_token` calls `supabase.auth.refreshSession`.
- **MCP surfaces (two):**
  - `/api/mcp/route.ts` — the **remote** MCP server (Streamable HTTP). Reads the Bearer token
    (a Supabase JWT), builds a Supabase client with it, and RLS scopes the tools.
  - `mcp-server/` — a **separate local stdio** MCP server package that talks to Supabase directly.
- Tools (both servers): `list_goals`, `save_goal`, `delete_goal`, `log_entry`, `get_logs`, `edit_log`.

## Target architecture

### 1. Database — Prisma Postgres + Prisma ORM

`prisma/schema.prisma` with models (RLS is replaced by explicit `where: { userId }` filters
in every query — the app is now the trust boundary):

```prisma
model User {                       // managed by better-auth (+ its Account/Session/Verification tables)
  id        String     @id @default(cuid())
  email     String     @unique
  name      String?
  createdAt DateTime   @default(now())
  goals     Goal[]
  foodLogs  FoodLog[]
}
model Goal {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  name        String
  unit        String
  targetValue Decimal
  goalType    String?   // food | water | weight (used by MCP tools)
  direction   String?
  sortOrder   Int       @default(0)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  values      FoodLogValue[]
  @@index([userId])
}
model FoodLog {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  foodName  String
  loggedAt  DateTime
  createdAt DateTime @default(now())
  values    FoodLogValue[]
  @@index([userId])
  @@index([loggedAt])
}
model FoodLogValue {
  id        String  @id @default(cuid())
  foodLogId String
  foodLog   FoodLog @relation(fields: [foodLogId], references: [id], onDelete: Cascade)
  goalId    String
  goal      Goal    @relation(fields: [goalId], references: [id], onDelete: Cascade)
  value     Decimal
  @@unique([foodLogId, goalId])
}
```

(`goalType`/`direction` exist in the app/MCP even though the base SQL omitted them — confirm
against the live Supabase columns during Phase 1 and add any that are missing.)

A single `lib/prisma.ts` client; `POSTGRES_PRISMA_URL` / `POSTGRES_URL_NON_POOLING` env
(Prisma Postgres provides both). All `supabase.from(...)` calls in the API routes and the
MCP handlers are rewritten to Prisma, each scoped by the authenticated `userId`.

### 2. Web auth — better-auth

Email/password with sessions (cookies), same library as the storefront project. better-auth
owns the `User`/`Account`/`Session`/`Verification` tables. `middleware.ts` checks the
better-auth session instead of Supabase. `/login` + a **password-reset** flow (request link →
email via **Resend** → set new password) — this is how migrated users get in the first time.

### 3. OAuth2 authorization server (our own)

Replace the Supabase-token wrapper with a real, minimal authorization-code server for the
single known client type (Claude.ai's MCP connector):

- Keep `/.well-known/oauth-authorization-server` and `/api/oauth/register`, pointing at our
  endpoints (registration can stay in-memory/stateless or persist clients in DB).
- `/authorize`: requires a **better-auth session** (redirects to `/login` if absent), shows a
  consent screen, then mints an **auth code** persisted in a new `OAuthCode` table with
  `{ code, userId, clientId, redirectUri, codeChallenge, expiresAt }`, and redirects back with it.
- `/api/oauth/token`:
  - `authorization_code`: verify the code row + **PKCE** (`code_verifier` vs stored
    `code_challenge`), then issue an **access token** = short-lived signed **JWT** (`{ sub: userId }`,
    ~1h) and a **refresh token** = opaque random string stored in an `OAuthToken` table (rotating).
  - `refresh_token`: look up + rotate, issue a fresh access JWT.
- New tables: `OAuthCode`, `OAuthToken` (and optionally `OAuthClient`).

### 4. MCP endpoints

- `/api/mcp`: extract the Bearer token → **verify our JWT** → `userId` → run the tool handlers
  against **Prisma**, every query scoped by `userId`. Rewrite the 6 tool handlers to Prisma.
- `mcp-server/` (local stdio): it talks to Supabase directly today. Post-migration it must
  reach the new data. Simplest: point it at the **remote `/api/mcp`** (so there's one code
  path), or give it a Prisma client + a token. **Decision needed** (see Open Questions) — if
  you don't use the local stdio server, we delete `mcp-server/` and keep only `/api/mcp`.

### 5. Data migration

A one-off script (`scripts/migrate-from-supabase.ts`, `tsx`) that reads from Supabase
(connection string via env, never committed) and writes via Prisma:

1. **Users:** read `auth.users` (id, email, created_at) → create `User` rows (preserve id or
   remap; store a marker that the password must be reset). No password hashes are copied.
2. **Goals / food_logs / food_log_values:** copy rows, mapping `user_id` → the new `User.id`,
   preserving `created_at`/`logged_at`, and re-linking foreign keys.
3. After import, each migrated user receives (or requests) a password-reset link to set a new
   password (better-auth reset flow). Their data is already theirs by `userId`.

Run order at cutover: provision Prisma Postgres → `prisma migrate deploy` → run the migration
script → deploy the new app → send reset links.

## Prerequisites (you provide before the build phases that need them)

1. **Prisma Postgres** database — create it (Prisma Console or `npx prisma init --db`) and put
   its connection strings in env (`POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`).
2. **Supabase read access** for the export — a connection string or a SQL dump of `auth.users`
   + the three tables.
3. **Resend** API key + a verified sender address (for password-reset emails).
4. **better-auth secret** (`openssl rand -base64 32`) and the app base URL.
5. The **Claude.ai MCP redirect URI(s)** to allowlist (already implied by the current setup).

Secrets are supplied via env/`.env.local`; they are never committed or pasted in plaintext.

## Phased plan (detail comes in the implementation plan)

1. **Phase 1 — Prisma + schema:** add Prisma, model the 4 tables (+ better-auth + OAuth tables),
   wire Prisma Postgres, generate the initial migration. Verify against the live Supabase columns.
2. **Phase 2 — data layer:** rewrite every `supabase.from(...)` in the API routes to Prisma,
   scoped by `userId` (behind a temporary auth shim until Phase 3).
3. **Phase 3 — better-auth:** login, session, middleware, password-reset (Resend). Remove
   Supabase web-auth.
4. **Phase 4 — OAuth server + MCP:** own authorization-code server (authorize/code/token +
   discovery/register), JWT access tokens, `/api/mcp` validating them, tool handlers on Prisma.
   Decide the fate of `mcp-server/`.
5. **Phase 5 — data migration:** the export/import script; dry-run then real run.
6. **Phase 6 — cutover:** remove all `@supabase/*` deps + files, update env/README, deploy,
   send reset links, verify the Claude.ai MCP connection end-to-end.

## Resolved decisions

- **Local `mcp-server/`**: NOT used — **delete the `mcp-server/` package**; keep only the
  remote `/api/mcp` (the Claude.ai connector). This also removes the last direct-to-Supabase
  code path outside the app.
- **Preserve user IDs**: YES — reuse each Supabase `auth.users.id` (UUID) as the better-auth
  `User.id`, so `goals`/`food_logs` foreign keys need no remapping. (User.id becomes a UUID
  string rather than cuid.)
- **Prisma Postgres region** — pick the region closest to the Vercel deployment (chosen when
  you provision the DB).

## Risks

- OAuth-provider correctness (PKCE, discovery, Claude.ai's exact expectations) — verify the
  live MCP reconnect at the end of Phase 4.
- Cutover is a hard switch (old Supabase tokens stop working); users re-auth and Claude.ai
  re-authorizes the connector once.
- Data integrity during export/import — dry-run and row-count checks before deleting anything.
