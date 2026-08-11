import { headers as nextHeaders } from "next/headers";
import { auth } from "@/lib/auth";

// Resolve the authenticated user id for an API route from the better-auth
// session cookie. API routes are excluded from middleware, so they call this to
// enforce auth (returns null when there is no valid session → the route 401s).
export async function getUserId(req?: Request): Promise<string | null> {
  const headers = req ? req.headers : await nextHeaders();
  const session = await auth.api.getSession({ headers });
  return session?.user?.id ?? null;
}
