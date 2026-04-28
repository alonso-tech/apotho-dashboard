"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notifyMany } from "@/lib/notifications";

export async function createRock(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const title = formData.get("title") as string;
  const description = formData.get("description") as string | null;
  const businessId = formData.get("businessId") as string;
  const quarter = parseInt(formData.get("quarter") as string, 10);
  const year = parseInt(formData.get("year") as string, 10);
  const ownerId = (formData.get("ownerId") as string) || session.user.id;

  if (!title || !businessId || !quarter || !year) throw new Error("Missing required fields");

  const integratorId = (formData.get("integratorId") as string) || session.user.id;

  // Support multiple owners
  const ownerIds = formData.getAll("ownerIds") as string[];
  const allOwnerIds = ownerIds.length > 0 ? ownerIds : [ownerId];

  const rock = await prisma.rock.create({
    data: {
      title,
      description: description || null,
      businessId,
      ownerId: allOwnerIds[0], // primary owner
      integratorId,
      quarter,
      year,
      owners: { connect: allOwnerIds.map((id) => ({ id })) },
    },
  });

  const biz = await prisma.business.findUnique({ where: { id: businessId } });
  const bizName = biz?.name ?? "a company";
  const slug = biz?.slug;

  // Notify assigned owners (skip the person creating it)
  const ownersToNotify = allOwnerIds.filter((id) => id !== session.user.id);
  if (ownersToNotify.length > 0) {
    const href = slug ? `/${slug}/rocks/${rock.id}` : "/my-rocks";
    await notifyMany(
      ownersToNotify.map((userId) => ({
        userId,
        type: "rock-assigned" as const,
        title: `New Rock Assigned: ${title}`,
        body: `You've been assigned a new rock "${title}" for Q${quarter} ${year} at ${bizName}.`,
        href,
      }))
    );
  }

  if (biz) revalidatePath(`/${biz.slug}/rocks`);
  revalidatePath("/my-rocks");
  revalidatePath("/integrator");
}

export async function toggleRock(rockId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const rock = await prisma.rock.findUnique({ where: { id: rockId }, include: { business: true } });
  if (!rock) throw new Error("Rock not found");

  await prisma.rock.update({ where: { id: rockId }, data: { done: !rock.done } });

  revalidatePath(`/${rock.business.slug}/rocks`);
  revalidatePath("/my-rocks");
}

export async function deleteRock(rockId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const rock = await prisma.rock.findUnique({ where: { id: rockId }, include: { business: true } });
  if (!rock) throw new Error("Rock not found");

  await prisma.rock.update({ where: { id: rockId }, data: { owners: { set: [] } } });
  await prisma.rock.delete({ where: { id: rockId } });

  revalidatePath(`/${rock.business.slug}/rocks`);
  revalidatePath("/my-rocks");
}

export async function updateRockDetails(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const rockId = formData.get("rockId") as string;
  const targetCompletionDate = formData.get("targetCompletionDate") as string | null;
  const status = formData.get("status") as string;
  const title = formData.get("title") as string | null;
  const quarter = formData.get("quarter") as string | null;
  const year = formData.get("year") as string | null;
  const businessId = formData.get("businessId") as string | null;

  const rock = await prisma.rock.findUnique({ where: { id: rockId }, include: { business: true } });
  if (!rock) throw new Error("Rock not found");

  await prisma.rock.update({
    where: { id: rockId },
    data: {
      targetCompletionDate: targetCompletionDate ? new Date(targetCompletionDate) : null,
      status: status || rock.status,
      ...(title ? { title } : {}),
      ...(quarter ? { quarter: parseInt(quarter, 10) } : {}),
      ...(year ? { year: parseInt(year, 10) } : {}),
      ...(businessId ? { businessId } : {}),
    },
  });

  // If business changed, revalidate old and new paths
  if (businessId && businessId !== rock.businessId) {
    const newBiz = await prisma.business.findUnique({ where: { id: businessId } });
    if (newBiz) {
      revalidatePath(`/${newBiz.slug}/rocks/${rockId}`);
      revalidatePath(`/${newBiz.slug}/rocks`);
    }
  }
  revalidatePath(`/${rock.business.slug}/rocks/${rockId}`);
  revalidatePath(`/${rock.business.slug}/rocks`);
  revalidatePath("/my-rocks");
  revalidatePath("/integrator");
}

export async function updateRockOwners(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const rockId = formData.get("rockId") as string;
  const ownerIds = formData.getAll("ownerIds") as string[];
  if (!rockId || ownerIds.length === 0) throw new Error("Missing fields");

  const rock = await prisma.rock.findUnique({ where: { id: rockId }, include: { business: true } });
  if (!rock) throw new Error("Rock not found");

  await prisma.rock.update({
    where: { id: rockId },
    data: {
      ownerId: ownerIds[0], // keep primary owner in sync
      owners: { set: ownerIds.map((id) => ({ id })) },
    },
  });

  revalidatePath(`/${rock.business.slug}/rocks/${rockId}`);
  revalidatePath(`/${rock.business.slug}/rocks`);
  revalidatePath("/integrator");
  revalidatePath("/my-rocks");
}

export async function updateRockDescription(rockId: string, description: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const rock = await prisma.rock.findUnique({ where: { id: rockId }, include: { business: true } });
  if (!rock) throw new Error("Rock not found");

  await prisma.rock.update({
    where: { id: rockId },
    data: { description: description.trim() || null },
  });

  revalidatePath(`/${rock.business.slug}/rocks/${rockId}`);
}

export async function addRockNote(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const rockId = formData.get("rockId") as string;
  const content = formData.get("content") as string;
  const mentionedUserIds = formData.getAll("mentionedUserIds") as string[];
  const attachmentsJson = formData.get("attachments") as string | null;
  if (!content?.trim() && !attachmentsJson) throw new Error("Note content or attachment required");

  const rock = await prisma.rock.findUnique({ where: { id: rockId }, include: { business: true } });
  if (!rock) throw new Error("Rock not found");

  const attachments: { fileName: string; fileUrl: string; fileSize: number; fileType: string }[] =
    attachmentsJson ? JSON.parse(attachmentsJson) : [];

  await prisma.rockNote.create({
    data: {
      rockId,
      authorId: session.user.id,
      content: content?.trim() || "",
      attachments: attachments.length > 0
        ? { create: attachments }
        : undefined,
    },
  });

  // Notify mentioned users
  const usersToNotify = mentionedUserIds.filter((id) => id !== session.user.id);
  if (usersToNotify.length > 0) {
    const authorName = session.user.name || "Someone";
    const href = `/${rock.business.slug}/rocks/${rockId}`;
    await notifyMany(
      usersToNotify.map((userId) => ({
        userId,
        type: "note-mention" as const,
        title: `${authorName} mentioned you on "${rock.title}"`,
        body: content.trim(),
        href,
      }))
    );
  }

  revalidatePath(`/${rock.business.slug}/rocks/${rockId}`);
}

export async function deleteRockNote(noteId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const note = await prisma.rockNote.findUnique({
    where: { id: noteId },
    include: { rock: { include: { business: true } } },
  });
  if (!note) throw new Error("Note not found");

  await prisma.rockNote.delete({ where: { id: noteId } });
  revalidatePath(`/${note.rock.business.slug}/rocks/${note.rockId}`);
}

export async function addRockMilestone(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const rockId = formData.get("rockId") as string;
  const title = formData.get("title") as string;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;

  if (!title?.trim() || !startDate || !endDate) throw new Error("Missing fields");

  const rock = await prisma.rock.findUnique({ where: { id: rockId }, include: { business: true } });
  if (!rock) throw new Error("Rock not found");

  const ownerId = (formData.get("ownerId") as string) || null;

  await prisma.rockMilestone.create({
    data: {
      rockId,
      title: title.trim(),
      startDate: new Date(startDate + "T12:00:00"),
      endDate: new Date(endDate + "T12:00:00"),
      ownerId,
    },
  });

  revalidatePath(`/${rock.business.slug}/rocks/${rockId}`);
}

export async function toggleRockMilestone(milestoneId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const milestone = await prisma.rockMilestone.findUnique({
    where: { id: milestoneId },
    include: { rock: { include: { business: true } } },
  });
  if (!milestone) throw new Error("Milestone not found");

  await prisma.rockMilestone.update({
    where: { id: milestoneId },
    data: { done: !milestone.done },
  });

  revalidatePath(`/${milestone.rock.business.slug}/rocks/${milestone.rockId}`);
}

export async function updateRockMilestone(
  milestoneId: string,
  data: { title?: string; startDate?: string; endDate?: string; ownerId?: string | null }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const milestone = await prisma.rockMilestone.findUnique({
    where: { id: milestoneId },
    include: { rock: { include: { business: true } } },
  });
  if (!milestone) throw new Error("Milestone not found");

  const updateData: Record<string, unknown> = {};
  if (data.title !== undefined) updateData.title = data.title.trim();
  if (data.startDate !== undefined) updateData.startDate = new Date(data.startDate + "T12:00:00");
  if (data.endDate !== undefined) updateData.endDate = new Date(data.endDate + "T12:00:00");
  if (data.ownerId !== undefined) updateData.ownerId = data.ownerId || null;

  await prisma.rockMilestone.update({
    where: { id: milestoneId },
    data: updateData,
  });

  revalidatePath(`/${milestone.rock.business.slug}/rocks/${milestone.rockId}`);
}

export async function deleteRockMilestone(milestoneId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const milestone = await prisma.rockMilestone.findUnique({
    where: { id: milestoneId },
    include: { rock: { include: { business: true } } },
  });
  if (!milestone) throw new Error("Milestone not found");

  await prisma.rockMilestone.delete({ where: { id: milestoneId } });
  revalidatePath(`/${milestone.rock.business.slug}/rocks/${milestone.rockId}`);
}
