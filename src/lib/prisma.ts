import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  // During build time, DATABASE_URL may not be set — allow lazy initialization
  if (!connectionString) {
    // Return a client that will fail at query time, not at instantiation time
    // This allows the build to complete without a live database
    const pool = new Pool({ connectionString: "postgresql://localhost/placeholder" });
    const adapter = new PrismaPg(pool);
    return new PrismaClient({ adapter });
  }
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
