import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma Compute deploys the Next.js standalone bundle.
  output: "standalone",
  // Keep Prisma + the pg driver as external (unbundled) server packages, and
  // force the generated client's real files into the standalone output so the
  // bundle doesn't rely on a symlink to @prisma/client (which breaks the
  // Compute artifact's symlink normalization).
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/.prisma/client/**/*",
      "./node_modules/@prisma/client/**/*",
    ],
  },
};

export default nextConfig;
