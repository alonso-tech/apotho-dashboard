import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

function getRockId(req: NextRequest) {
  const parts = req.nextUrl.pathname.split("/");
  const idx = parts.indexOf("rocks");
  return parts[idx + 1];
}

export const GET = withApiAuth(async (req) => {
  const rockId = getRockId(req);
  const milestones = await prisma.rockMilestone.findMany({
    where: { rockId },
    include: { owner: { select: { id: true, name: true } }, _count: { select: { todos: true } } },
    orderBy: { startDate: "asc" },
  });
  return NextResponse.json({ data: milestones });
});

export const POST = withApiAuth(async (req) => {
  const rockId = getRockId(req);
  const body = await req.json();
  const { title, startDate, endDate, ownerId } = body;
  if (!title || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing required fields: title, startDate, endDate" }, { status: 400 });
  }
  const milestone = await prisma.rockMilestone.create({
    data: { rockId, title, startDate: new Date(startDate + "T12:00:00"), endDate: new Date(endDate + "T12:00:00"), ownerId: ownerId || null },
  });
  return NextResponse.json({ data: milestone }, { status: 201 });
});
