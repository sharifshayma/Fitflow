// Simple auth code encoding using base64 JSON.
// The "code" is a base64-encoded JSON payload containing the Supabase tokens.
// Codes are short-lived (used immediately by claude.ai in the token exchange).
// This avoids needing a database or shared state for the serverless environment.

interface CodePayload {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix timestamp when this code expires
}

const CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function createAuthCode(accessToken: string, refreshToken: string): string {
  const payload: CodePayload = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Date.now() + CODE_TTL_MS,
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

export function redeemAuthCode(code: string): { access_token: string; refresh_token: string } | null {
  try {
    const json = Buffer.from(code, "base64url").toString("utf-8");
    const payload: CodePayload = JSON.parse(json);
    if (Date.now() > payload.expires_at) return null;
    return { access_token: payload.access_token, refresh_token: payload.refresh_token };
  } catch {
    return null;
  }
}
