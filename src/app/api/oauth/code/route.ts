import { createAuthCode } from "@/lib/oauth-codes";

export async function POST(request: Request) {
  const body = await request.json();
  const { access_token, refresh_token } = body;

  if (!access_token || !refresh_token) {
    return Response.json({ error: "Missing tokens" }, { status: 400 });
  }

  const code = createAuthCode(access_token, refresh_token);
  return Response.json({ code });
}
