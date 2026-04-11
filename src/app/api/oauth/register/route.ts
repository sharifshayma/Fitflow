import { randomUUID } from "crypto";

export async function POST(request: Request) {
  const body = await request.json();

  // Accept any client registration — we don't validate client credentials
  // since auth is handled via the user's Supabase session in the OAuth flow.
  return Response.json({
    client_id: body.client_id ?? randomUUID(),
    client_secret: randomUUID(),
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_secret_expires_at: 0, // never expires
    redirect_uris: body.redirect_uris ?? [],
    token_endpoint_auth_method: "client_secret_post",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    client_name: body.client_name ?? "Claude",
  });
}
