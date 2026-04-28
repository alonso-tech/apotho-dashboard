"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function createMeasurable(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const businessId = formData.get("businessId") as string;
  const name = formData.get("name") as string;
  const goal = formData.get("goal") as string;
  const unit = formData.get("unit") as string | null;

  if (!businessId || !name || !goal) throw new Error("Missing required fields");

  await prisma.measurable.create({ data: { businessId, name, goal, unit: unit || null } });

  const biz = await prisma.business.findUnique({ where: { id: businessId } });
  if (biz) revalidatePath(`/${biz.slug}/scorecard`);
}

export async function updateMeasurable(
  measurableId: string,
  name: string,
  goal: string,
  unit: string | null,
  goalDirection?: string
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const m = await prisma.measurable.findUnique({
    where: { id: measurableId },
    include: { business: true },
  });
  if (!m) throw new Error("Measurable not found");

  await prisma.measurable.update({
    where: { id: measurableId },
    data: { name, goal, unit, ...(goalDirection ? { goalDirection } : {}) },
  });

  revalidatePath(`/${m.business.slug}/scorecard`);
}

export async function deleteMeasurable(measurableId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const m = await prisma.measurable.findUnique({
    where: { id: measurableId },
    include: { business: true },
  });
  if (!m) throw new Error("Measurable not found");

  await prisma.measurable.delete({ where: { id: measurableId } });
  revalidatePath(`/${m.business.slug}/scorecard`);
}

export async function reorderMeasurables(orderedIds: string[]) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Update sortOrder for each measurable
  for (let i = 0; i < orderedIds.length; i++) {
    await prisma.measurable.update({
      where: { id: orderedIds[i] },
      data: { sortOrder: i },
    });
  }

  // Get business slug for revalidation
  if (orderedIds.length > 0) {
    const m = await prisma.measurable.findUnique({
      where: { id: orderedIds[0] },
      include: { business: true },
    });
    if (m) revalidatePath(`/${m.business.slug}/scorecard`);
  }
}

export async function saveEntry(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const measurableId = formData.get("measurableId") as string;
  const weekOfStr = formData.get("weekOf") as string;
  const actual = formData.get("actual") as string;

  if (!measurableId || !weekOfStr || !actual) throw new Error("Missing required fields");

  const weekOf = new Date(weekOfStr);

  const measurable = await prisma.measurable.findUnique({
    where: { id: measurableId },
    include: { business: true },
  });
  if (!measurable) throw new Error("Measurable not found");

  // Determine on track based on goal direction
  const actualNum = parseFloat(actual);
  const goalNum = parseFloat(measurable.goal.replace(/,/g, ""));
  const dir = measurable.goalDirection || "gte";
  let onTrack = false;
  if (!isNaN(actualNum) && !isNaN(goalNum)) {
    switch (dir) {
      case "gte": onTrack = actualNum >= goalNum; break;
      case "lte": onTrack = actualNum <= goalNum; break;
      case "gt":  onTrack = actualNum > goalNum; break;
      case "lt":  onTrack = actualNum < goalNum; break;
      case "eq":  onTrack = actualNum === goalNum; break;
      default:    onTrack = actualNum >= goalNum;
    }
  }

  await prisma.measurableEntry.upsert({
    where: { measurableId_weekOf: { measurableId, weekOf } },
    update: { actual, onTrack },
    create: { measurableId, weekOf, actual, onTrack },
  });

  revalidatePath(`/${measurable.business.slug}/scorecard`);
}
