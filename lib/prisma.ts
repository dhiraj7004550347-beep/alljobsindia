import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { PHASE_PRODUCTION_BUILD } from "next/constants";

// Vercel Preview deployments may not have a staging database. Next.js imports
// route handlers during its build, so use an unreachable local URL only for
// client construction in that phase. Runtime requests still require the real
// DATABASE_URL and never fall back to production credentials.
const connectionString =
  process.env.DATABASE_URL ||
  (process.env.NEXT_PHASE === PHASE_PRODUCTION_BUILD
    ? "postgresql://build:build@127.0.0.1:1/build?connect_timeout=1"
    : undefined);

if (!connectionString) {
  throw new Error("DATABASE_URL is not configured");
}

const adapter = new PrismaPg({
  connectionString,
});

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
