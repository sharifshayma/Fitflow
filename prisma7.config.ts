import "dotenv/config";
import { defineConfig } from "@prisma/prisma7/config";

// Prisma ORM 7 config, renamed from prisma.config.ts so Prisma ORM 8 can own the
// `prisma.config.ts` name. The `prisma7` CLI discovers this file automatically.
// The app's runtime (better-auth + the MCP tools) still runs on the Prisma 7
// client generated from prisma/schema.prisma; see docs/prisma8-migration.md.
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Read via process.env (not prisma's env(), which THROWS when the variable is
    // absent). `prisma7 generate` runs in `postinstall` during the Compute build,
    // where DATABASE_URL is not present; generate never connects, so an undefined
    // url is fine. Migrate commands read the real value from .env / the Compute
    // environment at runtime.
    url: process.env.DATABASE_URL,
  },
});
