import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const GET = withApiAuth(async (req) => {
  const id = req.nextUrl.pathname.split("/").pop()!;
  const rock = await prisma.rock.findUnique({
    where: { id },
    include: { owner: { select: { id: true, name: true } }, owners: { select: { id: true, name: true } }, business: { select: { id: true, name: true, slug: true } }, milestones: true, todos: { include: { owner: { select: { id: true, name: true } } } }, notes: { include: { author: { select: { id: true, name: true } }, attachments: true }, orderBy: { createdAt: "desc" } } },
  });
  if (!rock) return NextResponse.json({ error: "Rock not found" }, { status: 404 });
  return NextResponse.json({ data: rock });
});

export const PATCH = withApiAuth(async (req) => {
  const id = req.nextUrl.pathname.split("/").pop()!;
  const body = await req.json();
  const { title, description, quarter, year, done, status, targetCompletionDate, ownerId, ownerIds, integratorId } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (title !== undefined) data.title = title;
  if (description !== undefined) data.description = description;
  if (quarter !== undefined) data.quarter = quarter;
  if (year !== undefined) data.year = year;
  if (done !== undefined) data.done = done;
  if (status !== undefined) data.status = status;
  if (targetCompletionDate !== undefined) data.targetCompletionDate = targetCompletionDate ? new Date(targetCompletionDate) : null;
  if (ownerId !== undefined) data.ownerId = ownerId;
  if (integratorId !== undefined) data.integratorId = integratorId;
  if (ownerIds !== undefined) data.owners = { set: ownerIds.map((oid: string) => ({ id: oid })) };

  const rock = await prisma.rock.update({ where: { id }, data });
  return NextResponse.json({ data: rock });
});

export const DELETE = withApiAuth(async (req) => {
  const id = req.nextUrl.pathname.split("/").pop()!;
  await prisma.rock.delete({ where: { id } });
  return NextResponse.json({ data: { deleted: true } });
});
