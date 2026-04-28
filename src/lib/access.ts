import { prisma } from "./prisma";

// Role hierarchy: integrator > visionary > member
export type UserRole = "integrator" | "visionary" | "member";

/** Returns true if the role is integrator or visionary (admin-level access). */
export function isAdmin(role: string | undefined): boolean {
  return role === "integrator" || role === "visionary";
}

/** Returns true if the role is integrator. */
export function isIntegrator(role: string | undefined): boolean {
  return role === "integrator";
}

/** Returns true if the role is visionary. */
export function isVisionary(role: string | undefined): boolean {
  return role === "visionary";
}

/**
 * Returns the list of businesses visible to a user.
 * Integrator and visionary see all businesses.
 * Members see businesses they're explicitly assigned to OR have an active rock in.
 */
export async function getVisibleBusinesses(userId: string, role: string | undefined) {
  if (isAdmin(role)) {
    return prisma.business.findMany({ orderBy: { name: "asc" } });
  }

  // Businesses from explicit assignment
  const ownerships = await prisma.businessOwner.findMany({
    where: { userId },
    include: { business: true },
  });
  const assignedIds = new Set(ownerships.map((o) => o.business.id));

  // Businesses from active rocks (as owner or co-owner)
  const activeRocks = await prisma.rock.findMany({
    where: {
      done: false,
      OR: [
        { ownerId: userId },
        { owners: { some: { id: userId } } },
      ],
    },
    select: { businessId: true },
    distinct: ["businessId"],
  });

  for (const r of activeRocks) {
    assignedIds.add(r.businessId);
  }

  if (assignedIds.size === 0) return [];

  return prisma.business.findMany({
    where: { id: { in: Array.from(assignedIds) } },
    orderBy: { name: "asc" },
  });
}

/**
 * Checks if a user can access a specific business.
 * Access granted via: admin role, explicit BusinessOwner assignment, or active rock in that business.
 */
export async function canAccessBusiness(userId: string, role: string | undefined, businessId: string): Promise<boolean> {
  if (isAdmin(role)) return true;

  // Check explicit assignment
  const ownership = await prisma.businessOwner.findUnique({
    where: { userId_businessId: { userId, businessId } },
  });
  if (ownership) return true;

  // Check active rocks in this business
  const activeRock = await prisma.rock.findFirst({
    where: {
      businessId,
      done: false,
      OR: [
        { ownerId: userId },
        { owners: { some: { id: userId } } },
      ],
    },
  });
  return !!activeRock;
}
