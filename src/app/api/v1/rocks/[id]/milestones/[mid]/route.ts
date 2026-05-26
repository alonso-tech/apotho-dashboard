import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

function getMilestoneId(req: NextRequest) {
  return req.nextUrl.pathname.split("/").pop()!;
}

export const PATCH = withApiAuth(async (req) => {
  const id = getMilestoneId(req);
  const body = await req.json();
  const { title, startDate, endDate, done, ownerId } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (title !== undefined) data.title = title;
  if (startDate !== undefined) data.startDate = new Date(startDate + "T12:00:00");
  if (endDate !== undefined) data.endDate = new Date(endDate + "T12:00:00");
  if (done !== undefined) data.done = done;
  if (ownerId !== undefined) data.ownerId = ownerId || null;

  const milestone = await prisma.rockMilestone.update({ where: { id }, data });
  return NextResponse.json({ data: milestone });
});

export const DELETE = withApiAuth(async (req) => {
  const id = getMilestoneId(req);
  await prisma.rockMilestone.delete({ where: { id } });
  return NextResponse.json({ data: { deleted: true } });
});
