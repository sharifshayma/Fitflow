import { redeemAuthCode } from "@/lib/oauth-codes";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let grantType: string | null = null;
  let code: string | null = null;
  let refreshToken: string | null = null;

  // Support both form-encoded and JSON bodies
  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = await request.formData();
    grantType = formData.get("grant_type") as string;
    code = formData.get("code") as string;
    refreshToken = formData.get("refresh_token") as string;
  } else {
    const body = await request.json();
    grantType = body.grant_type;
    code = body.code;
    refreshToken = body.refresh_token;
  }

  if (grantType === "authorization_code") {
    if (!code) {
      return Response.json({ error: "invalid_request", error_description: "Missing code" }, { status: 400 });
    }

    const tokens = redeemAuthCode(code);
    if (!tokens) {
      return Response.json({ error: "invalid_grant", error_description: "Invalid or expired code" }, { status: 400 });
    }

    return Response.json({
      access_token: tokens.access_token,
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: tokens.refresh_token,
    });
  }

  if (grantType === "refresh_token") {
    if (!refreshToken) {
      return Response.json({ error: "invalid_request", error_description: "Missing refresh_token" }, { status: 400 });
    }

    // Use Supabase to refresh the session
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data.session) {
      return Response.json({ error: "invalid_grant", error_description: error?.message ?? "Refresh failed" }, { status: 400 });
    }

    return Response.json({
      access_token: data.session.access_token,
      token_type: "Bearer",
      expires_in: 3600,
      refresh_token: data.session.refresh_token,
    });
  }

  return Response.json({ error: "unsupported_grant_type" }, { status: 400 });
}
