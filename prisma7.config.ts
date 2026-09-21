import "dotenv/config";
import { defineConfig, env } from "@prisma/prisma7/config";

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
    // Set DATABASE_URL in .env (never committed). For Prisma Postgres this is the
    // project's connection string; migrations run against it.
    url: env("DATABASE_URL"),
  },
});
