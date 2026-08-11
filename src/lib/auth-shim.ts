// TEMPORARY auth shim for Phase 2 of the Supabase → Prisma migration.
//
// The API routes used to read the user from a Supabase session. Real web auth
// (better-auth) lands in Phase 3, at which point this file is replaced by a
// session lookup. Until then, routes resolve the current user id from either an
// `x-user-id` request header (for local testing) or a `DEV_USER_ID` env var.
export async function getUserId(req?: Request): Promise<string | null> {
  const header = req?.headers.get("x-user-id");
  if (header) return header;
  return process.env.DEV_USER_ID ?? null;
}
