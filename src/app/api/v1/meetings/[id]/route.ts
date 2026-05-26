import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const GET = withApiAuth(async (req) => {
  const id = req.nextUrl.pathname.split("/").pop()!;
  const meeting = await prisma.meeting.findUnique({
    where: { id },
    include: {
      business: { select: { id: true, name: true, slug: true } },
      segues: { include: { user: { select: { id: true, name: true } } } },
      issues: { orderBy: { createdAt: "asc" } },
      ratings: { include: { user: { select: { id: true, name: true } } } },
      todos: { include: { owner: { select: { id: true, name: true } } } },
    },
  });
  if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
  return NextResponse.json({ data: meeting });
});

export const PATCH = withApiAuth(async (req) => {
  const id = req.nextUrl.pathname.split("/").pop()!;
  const body = await req.json();

  if (body.end) {
    const meeting = await prisma.meeting.findUnique({ where: { id }, include: { ratings: true } });
    if (!meeting) return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    const avg = meeting.ratings.length > 0
      ? meeting.ratings.reduce((s, r) => s + r.rating, 0) / meeting.ratings.length
      : null;
    const updated = await prisma.meeting.update({ where: { id }, data: { endedAt: new Date(), avgRating: avg } });
    return NextResponse.json({ data: updated });
  }

  return NextResponse.json({ error: "Use { end: true } to end a meeting" }, { status: 400 });
});
