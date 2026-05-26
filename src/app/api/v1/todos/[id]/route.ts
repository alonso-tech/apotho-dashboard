import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const GET = withApiAuth(async (req) => {
  const id = req.nextUrl.pathname.split("/").pop()!;
  const todo = await prisma.todo.findUnique({
    where: { id },
    include: { owner: { select: { id: true, name: true } }, business: { select: { id: true, name: true, slug: true } }, rock: { select: { id: true, title: true } }, milestone: { select: { id: true, title: true } } },
  });
  if (!todo) return NextResponse.json({ error: "Todo not found" }, { status: 404 });
  return NextResponse.json({ data: todo });
});

export const PATCH = withApiAuth(async (req) => {
  const id = req.nextUrl.pathname.split("/").pop()!;
  const body = await req.json();
  const { title, done, killed, ownerId, rockId, milestoneId, startDate, endDate, dueDate } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (title !== undefined) data.title = title;
  if (done !== undefined) data.done = done;
  if (killed !== undefined) data.killed = killed;
  if (ownerId !== undefined) data.ownerId = ownerId;
  if (rockId !== undefined) data.rockId = rockId || null;
  if (milestoneId !== undefined) data.milestoneId = milestoneId || null;
  if (startDate !== undefined) data.startDate = startDate ? new Date(startDate + "T12:00:00") : null;
  if (endDate !== undefined) data.endDate = endDate ? new Date(endDate + "T12:00:00") : null;
  if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;

  const todo = await prisma.todo.update({ where: { id }, data });
  return NextResponse.json({ data: todo });
});

export const DELETE = withApiAuth(async (req) => {
  const id = req.nextUrl.pathname.split("/").pop()!;
  await prisma.todo.delete({ where: { id } });
  return NextResponse.json({ data: { deleted: true } });
});
