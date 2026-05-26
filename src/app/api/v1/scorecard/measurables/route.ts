import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const GET = withApiAuth(async (req) => {
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (businessId) where.businessId = businessId;

  const measurables = await prisma.measurable.findMany({
    where,
    include: { business: { select: { id: true, name: true } }, entries: { orderBy: { weekOf: "desc" }, take: 13 } },
    orderBy: { sortOrder: "asc" },
  });
  return NextResponse.json({ data: measurables });
});

export const POST = withApiAuth(async (req) => {
  const body = await req.json();
  const { businessId, name, goal, unit, goalDirection } = body;
  if (!businessId || !name || !goal) {
    return NextResponse.json({ error: "Missing required fields: businessId, name, goal" }, { status: 400 });
  }
  const measurable = await prisma.measurable.create({
    data: { businessId, name, goal, unit: unit || null, goalDirection: goalDirection || "gte" },
  });
  return NextResponse.json({ data: measurable }, { status: 201 });
});
