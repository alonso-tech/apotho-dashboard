import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const POST = withApiAuth(async (req) => {
  const body = await req.json();
  const { measurableId, weekOf, actual } = body;
  if (!measurableId || !weekOf || actual === undefined) {
    return NextResponse.json({ error: "Missing required fields: measurableId, weekOf, actual" }, { status: 400 });
  }

  const m = await prisma.measurable.findUnique({ where: { id: measurableId } });
  if (!m) return NextResponse.json({ error: "Measurable not found" }, { status: 404 });

  const goalNum = parseFloat(m.goal.replace(/,/g, ""));
  const actualNum = parseFloat(String(actual).replace(/,/g, ""));
  const dir = m.goalDirection || "gte";
  let onTrack = false;
  if (!isNaN(actualNum) && !isNaN(goalNum)) {
    switch (dir) {
      case "lte": onTrack = actualNum <= goalNum; break;
      case "lt": onTrack = actualNum < goalNum; break;
      case "gt": onTrack = actualNum > goalNum; break;
      case "eq": onTrack = actualNum === goalNum; break;
      default: onTrack = actualNum >= goalNum;
    }
  }

  const entry = await prisma.measurableEntry.upsert({
    where: { measurableId_weekOf: { measurableId, weekOf: new Date(weekOf + "T00:00:00.000Z") } },
    update: { actual: String(actual), onTrack },
    create: { measurableId, weekOf: new Date(weekOf + "T00:00:00.000Z"), actual: String(actual), onTrack },
  });
  return NextResponse.json({ data: entry });
});
