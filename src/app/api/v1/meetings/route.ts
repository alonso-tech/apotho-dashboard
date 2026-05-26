import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const GET = withApiAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (businessId) where.businessId = businessId;

  const meetings = await prisma.meeting.findMany({
    where,
    include: { business: { select: { id: true, name: true, slug: true } }, _count: { select: { todos: true, issues: true } } },
    orderBy: { date: "desc" },
  });
  return NextResponse.json({ data: meetings });
});

export const POST = withApiAuth(async (req) => {
  const body = await req.json();
  const { businessId } = body;
  if (!businessId) return NextResponse.json({ error: "Missing required field: businessId" }, { status: 400 });

  const meeting = await prisma.meeting.create({
    data: { businessId, startedAt: new Date(), date: new Date() },
  });
  return NextResponse.json({ data: meeting }, { status: 201 });
});
