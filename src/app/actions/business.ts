"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/access";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.role)) {
    throw new Error("Unauthorized — admin access required");
  }
  return session;
}

export async function addBusinessOwner(businessId: string, userId: string, role: string) {
  await requireAdmin();

  const existing = await prisma.businessOwner.findUnique({
    where: { userId_businessId: { userId, businessId } },
  });
  if (existing) throw new Error("User already has access to this business");

  await prisma.businessOwner.create({
    data: { userId, businessId, role },
  });

  const biz = await prisma.business.findUnique({ where: { id: businessId } });
  if (biz) revalidatePath(`/${biz.slug}`);
}

export async function removeBusinessOwner(ownershipId: string) {
  await requireAdmin();

  const ownership = await prisma.businessOwner.findUnique({
    where: { id: ownershipId },
    include: { business: true },
  });
  if (!ownership) throw new Error("Ownership record not found");

  await prisma.businessOwner.delete({ where: { id: ownershipId } });
  revalidatePath(`/${ownership.business.slug}`);
}

export async function updateBusinessOwnerRole(ownershipId: string, role: string) {
  await requireAdmin();

  const ownership = await prisma.businessOwner.findUnique({
    where: { id: ownershipId },
    include: { business: true },
  });
  if (!ownership) throw new Error("Ownership record not found");

  await prisma.businessOwner.update({
    where: { id: ownershipId },
    data: { role },
  });

  revalidatePath(`/${ownership.business.slug}`);
}
