import "dotenv/config";
import { definePrismaConfig } from "prisma/config";
import { defineConfig as ormConfig } from "@prisma/orm-postgres/config";

// Prisma ORM 8 config. This is what the Prisma 8 CLI (`prisma`) and Prisma
// Compute's deploy use. Prisma 7 keeps its own config in prisma7.config.ts.
//
// NOTE: prisma8/contract.prisma is a best-effort contract hand-authored from
// prisma/schema.prisma so the toolchain builds. The AUTHORITATIVE contract must
// be generated from the live database with `prisma contract infer` before
// `prisma db sign` — see docs/prisma8-migration.md.
export default definePrismaConfig({
  orm: ormConfig({
    contract: "prisma8/contract.prisma",
    output: "generated/prisma8",
    db: {
      // Same DATABASE_URL the Prisma 7 config uses — one database, two ORMs.
      connection: process.env.DATABASE_URL,
    },
  }),
});
