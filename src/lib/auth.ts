import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { mcp } from "better-auth/plugins";
import { prisma } from "@/lib/prisma";

// Send a password-reset email via Resend when configured; otherwise (dev, or
// before RESEND_API_KEY is set) log the reset link so the flow is still testable.
async function sendResetEmail(email: string, url: string) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM;

  if (!apiKey || !from) {
    console.log(`[auth] Password reset link for ${email}: ${url}`);
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(apiKey);
  await resend.emails.send({
    from,
    to: email,
    subject: "Reset your FitFlow password",
    text: `Reset your FitFlow password using this link:\n\n${url}\n\nIf you didn't request this, you can ignore this email.`,
  });
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    // Email verification is not required (Resend is optional at this stage);
    // migrated users get in via the password-reset flow.
    requireEmailVerification: false,
    sendResetPassword: async ({ user, url }) => {
      await sendResetEmail(user.email, url);
    },
  },
  plugins: [
    // OAuth2/OIDC provider + MCP: powers the Claude.ai connector. Registers the
    // authorize/token/register endpoints and protects /api/mcp via withMcpAuth.
    mcp({
      loginPage: "/login",
      oidcConfig: {
        loginPage: "/login",
        // Claude's MCP connector self-registers (RFC 7591) and uses PKCE.
        allowDynamicClientRegistration: true,
        // Consent screen for clients the user hasn't approved yet.
        consentPage: "/consent",
      },
    }),
    nextCookies(), // must be last
  ],
});
