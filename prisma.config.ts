import "dotenv/config";
import { defineConfig, env } from "prisma/config";

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
