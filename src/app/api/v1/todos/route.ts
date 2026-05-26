import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/access";

export const GET = withApiAuth(async (req, user) => {
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId");
  const rockId = searchParams.get("rockId");
  const done = searchParams.get("done");
  const killed = searchParams.get("killed");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (businessId) where.businessId = businessId;
  if (rockId) where.rockId = rockId;
  if (done !== null) where.done = done === "true";
  if (killed !== null) where.killed = killed === "true";
  if (!isAdmin(user.role) && !businessId) where.ownerId = user.id;

  const todos = await prisma.todo.findMany({
    where,
    include: { owner: { select: { id: true, name: true } }, business: { select: { id: true, name: true, slug: true } }, rock: { select: { id: true, title: true } }, milestone: { select: { id: true, title: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ data: todos });
});

export const POST = withApiAuth(async (req, user) => {
  const body = await req.json();
  const { title, businessId, ownerId, rockId, milestoneId, meetingId, dueDate, startDate, endDate } = body;
  if (!title || !businessId) {
    return NextResponse.json({ error: "Missing required fields: title, businessId" }, { status: 400 });
  }
  const todo = await prisma.todo.create({
    data: {
      title, businessId,
      ownerId: ownerId || user.id,
      rockId: rockId || null,
      milestoneId: milestoneId || null,
      meetingId: meetingId || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      startDate: startDate ? new Date(startDate + "T12:00:00") : null,
      endDate: endDate ? new Date(endDate + "T12:00:00") : null,
    },
  });
  return NextResponse.json({ data: todo }, { status: 201 });
});
