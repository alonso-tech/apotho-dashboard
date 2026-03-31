import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const owners = [
  { name: "Alonso Timpson", email: "alonso@apotho.com", password: "change-me-1" },
  { name: "Alex Ivory", email: "alex@apotho.com", password: "change-me-2" },
  { name: "Donald Timpson", email: "donald@apotho.com", password: "change-me-3" },
  { name: "Jay", email: "jay@apotho.com", password: "change-me-4" },
  { name: "John", email: "john@apotho.com", password: "change-me-5" },
  { name: "Kyle", email: "kyle@apotho.com", password: "change-me-6" },
  { name: "Stephen", email: "stephen@apotho.com", password: "change-me-7" },
];

const businesses = [
  { name: "Evolution Drafting", slug: "evolution-drafting" },
  { name: "Sentri Homes", slug: "sentri-homes" },
  { name: "Terraform Development & Design", slug: "terraform-development" },
  { name: "Ittera Studios", slug: "ittera-studios" },
  { name: "Marauder Labs", slug: "marauder-labs" },
  { name: "TriForce Golf Simulator", slug: "triforce-golf" },
  { name: "Apotho Marketplace", slug: "apotho-marketplace" },
  { name: "Mortgage Company", slug: "mortgage-company" },
];

async function main() {
  console.log("Seeding database...");

  // Upsert all users
  const createdUsers = await Promise.all(
    owners.map(async (owner) => {
      const hashedPassword = await bcrypt.hash(owner.password, 12);
      return prisma.user.upsert({
        where: { email: owner.email },
        update: { name: owner.name, hashedPassword },
        create: {
          name: owner.name,
          email: owner.email,
          hashedPassword,
        },
      });
    })
  );
  console.log(`Seeded ${createdUsers.length} owners`);

  // Upsert all businesses
  const createdBusinesses = await Promise.all(
    businesses.map((biz) =>
      prisma.business.upsert({
        where: { slug: biz.slug },
        update: { name: biz.name },
        create: { name: biz.name, slug: biz.slug },
      })
    )
  );
  console.log(`Seeded ${createdBusinesses.length} businesses`);

  // Link every owner to every business
  let ownershipCount = 0;
  for (const user of createdUsers) {
    for (const business of createdBusinesses) {
      await prisma.businessOwner.upsert({
        where: {
          userId_businessId: {
            userId: user.id,
            businessId: business.id,
          },
        },
        update: {},
        create: {
          userId: user.id,
          businessId: business.id,
          role: "owner",
        },
      });
      ownershipCount++;
    }
  }
  console.log(`Created ${ownershipCount} ownership records`);

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
