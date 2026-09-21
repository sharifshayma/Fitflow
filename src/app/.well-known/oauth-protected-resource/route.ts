import { oAuthProtectedResourceMetadata } from "better-auth/plugins";
import { auth } from "@/lib/auth";

// OAuth 2.0 Protected Resource Metadata (RFC 9728) — the MCP endpoint's 401
// responses point clients here via `WWW-Authenticate: Bearer resource_metadata=...`.
// Claude's MCP connector fetches this to discover which authorization server to
// use; without it the handshake dead-ends and the connector reports
// "Authorization with FitFlow failed."
export const GET = oAuthProtectedResourceMetadata(auth);
