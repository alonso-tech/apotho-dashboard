import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

// One-time endpoint to seed Q2 2026 rocks from the quarterly meeting
// DELETE THIS FILE after running it once
export async function POST() {
  try {
    // Ensure all users exist
    const owners = [
      { name: "Alonso Timpson", email: "alonso@apotho.com", password: "change-me-1" },
      { name: "Alex Ivory", email: "alex@apotho.com", password: "change-me-2" },
      { name: "Donald Timpson", email: "donald@apotho.com", password: "change-me-3" },
      { name: "Jay", email: "jay@apotho.com", password: "change-me-4" },
      { name: "John", email: "john@apotho.com", password: "change-me-5" },
      { name: "Kyle", email: "kyle@apotho.com", password: "change-me-6" },
      { name: "Stephen", email: "stephen@apotho.com", password: "change-me-7" },
      { name: "Sam", email: "sam@apotho.com", password: "change-me-8" },
    ];

    const createdUsers = await Promise.all(
      owners.map(async (owner) => {
        const hashedPassword = await bcrypt.hash(owner.password, 12);
        return prisma.user.upsert({
          where: { email: owner.email },
          update: {},
          create: {
            name: owner.name,
            email: owner.email,
            hashedPassword,
          },
        });
      })
    );
    const userByEmail = Object.fromEntries(createdUsers.map((u) => [u.email, u]));

    // Ensure all businesses exist
    const businesses = [
      { name: "Evolution Drafting", slug: "evolution-drafting", description: "Architectural drafting and design services" },
      { name: "Sentri Homes", slug: "sentri-homes", description: "Home construction and development" },
      { name: "Terraform Development & Design", slug: "terraform-development", description: "Land development and design" },
      { name: "Ittera Studios", slug: "ittera-studios", description: "Creative studio and media production" },
      { name: "Marauder Labs", slug: "marauder-labs", description: "Technology and software development" },
      { name: "TriForce Golf Simulator", slug: "triforce-golf", description: "Indoor golf simulation entertainment" },
      { name: "Apotho Marketplace", slug: "apotho-marketplace", description: "Digital marketplace platform" },
      { name: "Mortgage Company", slug: "mortgage-company", description: "Mortgage lending and financing" },
      { name: "Evo Arch", slug: "evo-arch", description: "Architecture services expansion (AZ, FL, TX, CO)" },
      { name: "Evo Eng", slug: "evo-eng", description: "Engineering services expansion (AZ, FL, TX, CO)" },
      { name: "Apotho Improvements", slug: "apotho-improvements", description: "Parent company overseeing all subsidiaries" },
    ];

    const createdBusinesses = await Promise.all(
      businesses.map((biz) =>
        prisma.business.upsert({
          where: { slug: biz.slug },
          update: { name: biz.name, description: biz.description },
          create: { name: biz.name, slug: biz.slug, description: biz.description },
        })
      )
    );
    const bizBySlug = Object.fromEntries(createdBusinesses.map((b) => [b.slug, b]));

    // Link all users to all businesses
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
      }
    }

    // Q2 2026 rocks from the Quarterly Meeting (March 30, 2026)
    const q2Rocks = [
      // Evolution Drafting — John and Jay — $3M rev, 20% profit
      { title: "Weekly hiring meetings with Collin, Jay, and John", businessSlug: "evolution-drafting", ownerEmail: "john@apotho.com", quarter: 2, year: 2026 },
      { title: "Hire 17 total sales agents", businessSlug: "evolution-drafting", ownerEmail: "john@apotho.com", quarter: 2, year: 2026 },
      { title: "Hire 6 new coordinators", businessSlug: "evolution-drafting", ownerEmail: "john@apotho.com", quarter: 2, year: 2026 },
      { title: "Hire employee to record process and create social media content", businessSlug: "evolution-drafting", ownerEmail: "jay@apotho.com", quarter: 2, year: 2026 },
      { title: "John downloads Claude and finishes front end training", businessSlug: "evolution-drafting", ownerEmail: "john@apotho.com", quarter: 2, year: 2026 },
      { title: "Kyle finishes drafting automation back end", businessSlug: "evolution-drafting", ownerEmail: "kyle@apotho.com", quarter: 2, year: 2026 },
      { title: "Alex switches whole company to new applications by end of April", businessSlug: "evolution-drafting", ownerEmail: "alex@apotho.com", quarter: 2, year: 2026 },
      { title: "Kyle builds client-facing Viktor by end of April", businessSlug: "evolution-drafting", ownerEmail: "kyle@apotho.com", quarter: 2, year: 2026 },
      { title: "800 leads a week at 8% conversion rate at $3500 total job average", businessSlug: "evolution-drafting", ownerEmail: "jay@apotho.com", quarter: 2, year: 2026 },
      { title: "Donald builds out engineering upsale process", businessSlug: "evolution-drafting", ownerEmail: "donald@apotho.com", quarter: 2, year: 2026 },
      { title: "Lonnie hires Apotho agent to sell the whole upsale process", businessSlug: "evolution-drafting", ownerEmail: "alonso@apotho.com", quarter: 2, year: 2026 },
      { title: "John has Jullian build out e-commerce with Alex", businessSlug: "evolution-drafting", ownerEmail: "john@apotho.com", quarter: 2, year: 2026 },

      // Evo Arch — Lonnie
      { title: "File LLC for Evo Arch", businessSlug: "evo-arch", ownerEmail: "alonso@apotho.com", quarter: 2, year: 2026 },
      { title: "GMB locations through AZ, FL, TX, CO", businessSlug: "evo-arch", ownerEmail: "alonso@apotho.com", quarter: 2, year: 2026 },
      { title: "AI Bot to answer for Evo Arch", businessSlug: "evo-arch", ownerEmail: "alonso@apotho.com", quarter: 2, year: 2026 },

      // Evo Eng — Lonnie
      { title: "File LLC for Evo Eng", businessSlug: "evo-eng", ownerEmail: "alonso@apotho.com", quarter: 2, year: 2026 },
      { title: "GMB locations through AZ, FL, TX, CO for Evo Eng", businessSlug: "evo-eng", ownerEmail: "alonso@apotho.com", quarter: 2, year: 2026 },
      { title: "AI Bot to answer for Evo Eng", businessSlug: "evo-eng", ownerEmail: "alonso@apotho.com", quarter: 2, year: 2026 },

      // Sentri Homes — Steve — $1M rev, 20% Profit
      { title: "Figure out homebuilding sell", businessSlug: "sentri-homes", ownerEmail: "stephen@apotho.com", quarter: 2, year: 2026 },
      { title: "Hire more agents", businessSlug: "sentri-homes", ownerEmail: "stephen@apotho.com", quarter: 2, year: 2026 },
      { title: "Hire more fulfilment", businessSlug: "sentri-homes", ownerEmail: "stephen@apotho.com", quarter: 2, year: 2026 },
      { title: "Launch the Sentri app by April 30th", businessSlug: "sentri-homes", ownerEmail: "stephen@apotho.com", quarter: 2, year: 2026 },
      { title: "Get leads on the off weeks", businessSlug: "sentri-homes", ownerEmail: "stephen@apotho.com", quarter: 2, year: 2026 },

      // Marauders — Alex — 300 active customers, $3k rev/mo, 0% profit
      { title: "Give the pitch to 1000 people by April 30th", businessSlug: "marauder-labs", ownerEmail: "alex@apotho.com", quarter: 2, year: 2026 },
      { title: "300 people running the preliminary sale by June 30th", businessSlug: "marauder-labs", ownerEmail: "alex@apotho.com", quarter: 2, year: 2026 },
      { title: "First owner to have 10 scenarios running for 10 different companies gets a Tesla", businessSlug: "marauder-labs", ownerEmail: "alex@apotho.com", quarter: 2, year: 2026 },
      { title: "Build upsale process", businessSlug: "marauder-labs", ownerEmail: "alex@apotho.com", quarter: 2, year: 2026 },
      { title: "Elite customer service and experience", businessSlug: "marauder-labs", ownerEmail: "alex@apotho.com", quarter: 2, year: 2026 },

      // Terraform — Kyle — 5 active properties, $400k Rev, 20% Profit
      { title: "Kyle creates Claude script to take the lot info", businessSlug: "terraform-development", ownerEmail: "kyle@apotho.com", quarter: 2, year: 2026 },
      { title: "Sell the house", businessSlug: "terraform-development", ownerEmail: "kyle@apotho.com", quarter: 2, year: 2026 },
      { title: "Jay's lots permits filed", businessSlug: "terraform-development", ownerEmail: "jay@apotho.com", quarter: 2, year: 2026 },

      // Mortgages — Lon — $0 Rev
      { title: "Find the integrator", businessSlug: "mortgage-company", ownerEmail: "alonso@apotho.com", quarter: 2, year: 2026 },
      { title: "File mortgage company by April 30th", businessSlug: "mortgage-company", ownerEmail: "alonso@apotho.com", quarter: 2, year: 2026 },

      // Apotho Marketplace — Lon — $0 Rev
      { title: "Build entire backend software", businessSlug: "apotho-marketplace", ownerEmail: "alonso@apotho.com", quarter: 2, year: 2026 },
      { title: "Build front-facing customer software", businessSlug: "apotho-marketplace", ownerEmail: "alonso@apotho.com", quarter: 2, year: 2026 },
      { title: "Build the package as a whole process", businessSlug: "apotho-marketplace", ownerEmail: "alonso@apotho.com", quarter: 2, year: 2026 },
      { title: "Marketing for Apotho Marketplace", businessSlug: "apotho-marketplace", ownerEmail: "alonso@apotho.com", quarter: 2, year: 2026 },

      // Ittera — Alex — $30k Rev, 20% profit
      { title: "Build and ship a video game that makes revenue", businessSlug: "ittera-studios", ownerEmail: "alex@apotho.com", quarter: 2, year: 2026 },

      // TriForce — Sam — $4k monthly subs
      { title: "Get 1 ball hit and $4k monthly subs", businessSlug: "triforce-golf", ownerEmail: "sam@apotho.com", quarter: 2, year: 2026 },

      // Apotho Improvements — Lon
      { title: "Build the level 10 meeting app for Apotho Improvements", businessSlug: "apotho-improvements", ownerEmail: "alonso@apotho.com", quarter: 2, year: 2026 },
    ];

    let created = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const rock of q2Rocks) {
      const user = userByEmail[rock.ownerEmail];
      const biz = bizBySlug[rock.businessSlug];
      if (!user || !biz) {
        errors.push(`Missing user=${rock.ownerEmail} or biz=${rock.businessSlug} for "${rock.title}"`);
        continue;
      }

      const existing = await prisma.rock.findFirst({
        where: { title: rock.title, businessId: biz.id, year: rock.year, quarter: rock.quarter },
      });
      if (existing) {
        skipped++;
        continue;
      }

      await prisma.rock.create({
        data: {
          title: rock.title,
          quarter: rock.quarter,
          year: rock.year,
          businessId: biz.id,
          ownerId: user.id,
        },
      });
      created++;
    }

    return NextResponse.json({
      success: true,
      created,
      skipped,
      errors,
      totalRocks: q2Rocks.length,
    });
  } catch (error) {
    console.error("Seed Q2 error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
