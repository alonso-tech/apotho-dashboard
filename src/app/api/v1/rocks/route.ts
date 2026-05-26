import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { isAdmin, canAccessBusiness } from "@/lib/access";

export const GET = withApiAuth(async (req, user) => {
  const { searchParams } = new URL(req.url);
  const businessId = searchParams.get("businessId");
  const quarter = searchParams.get("quarter") ? Number(searchParams.get("quarter")) : undefined;
  const year = searchParams.get("year") ? Number(searchParams.get("year")) : undefined;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};
  if (businessId) {
    if (!(await canAccessBusiness(user.id, user.role, businessId)))
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    where.businessId = businessId;
  } else if (!isAdmin(user.role)) {
    where.OR = [{ ownerId: user.id }, { owners: { some: { id: user.id } } }];
  }
  if (quarter) where.quarter = quarter;
  if (year) where.year = year;

  const rocks = await prisma.rock.findMany({
    where,
    include: { owner: { select: { id: true, name: true } }, owners: { select: { id: true, name: true } }, business: { select: { id: true, name: true, slug: true } }, milestones: true, _count: { select: { todos: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ data: rocks });
});

export const POST = withApiAuth(async (req, user) => {
  const body = await req.json();
  const { title, businessId, quarter, year, description, ownerId, ownerIds, integratorId, targetCompletionDate, status } = body;
  if (!title || !businessId || !quarter || !year) {
    return NextResponse.json({ error: "Missing required fields: title, businessId, quarter, year" }, { status: 400 });
  }

  const rock = await prisma.rock.create({
    data: {
      title, businessId, quarter, year,
      description: description || null,
      ownerId: ownerId || user.id,
      integratorId: integratorId || null,
      targetCompletionDate: targetCompletionDate ? new Date(targetCompletionDate) : null,
      status: status || "not-started",
      owners: ownerIds?.length ? { connect: ownerIds.map((id: string) => ({ id })) } : undefined,
    },
    include: { owner: { select: { id: true, name: true } }, owners: { select: { id: true, name: true } } },
  });
  return NextResponse.json({ data: rock }, { status: 201 });
});
