import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const PATCH = withApiAuth(async (req) => {
  const id = req.nextUrl.pathname.split("/").pop()!;
  const body = await req.json();
  const { name, goal, unit, goalDirection } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (name !== undefined) data.name = name;
  if (goal !== undefined) data.goal = goal;
  if (unit !== undefined) data.unit = unit;
  if (goalDirection !== undefined) data.goalDirection = goalDirection;

  const measurable = await prisma.measurable.update({ where: { id }, data });
  return NextResponse.json({ data: measurable });
});

export const DELETE = withApiAuth(async (req) => {
  const id = req.nextUrl.pathname.split("/").pop()!;
  await prisma.measurable.delete({ where: { id } });
  return NextResponse.json({ data: { deleted: true } });
});
