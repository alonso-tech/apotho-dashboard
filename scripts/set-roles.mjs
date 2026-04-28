import { PrismaClient } from "@prisma/client";
import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// Set roles
await prisma.user.update({ where: { email: "donald@evolutiondrafting.com" }, data: { role: "integrator" } });
await prisma.user.update({ where: { email: "alonso@evolutiondrafting.com" }, data: { role: "visionary" } });

// Verify
const users = await prisma.user.findMany({ select: { name: true, email: true, role: true }, orderBy: { name: "asc" } });
console.log("Updated users:");
for (const u of users) {
  console.log(`  ${u.name} | ${u.email} | ${u.role}`);
}

await prisma.$disconnect();
await pool.end();
