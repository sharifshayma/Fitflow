import { oAuthDiscoveryMetadata } from "better-auth/plugins";
import { auth } from "@/lib/auth";

// OAuth 2.0 Authorization Server Metadata (RFC 8414) — advertises the endpoints
// registered by the better-auth MCP/OIDC plugin.
export const GET = oAuthDiscoveryMetadata(auth);
