import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  const rocks = await prisma.rock.findMany({
    where: { quarter: 2, year: 2026 },
    include: { owner: { select: { name: true, email: true } }, business: { select: { name: true, slug: true } } },
    orderBy: [{ business: { name: "asc" } }, { createdAt: "asc" }],
  });

  const grouped: Record<string, { rock: string; owner: string; done: boolean }[]> = {};
  for (const r of rocks) {
    const biz = r.business.name;
    if (!grouped[biz]) grouped[biz] = [];
    grouped[biz].push({ rock: r.title, owner: r.owner.name, done: r.done });
  }

  return NextResponse.json({ totalQ2Rocks: rocks.length, byBusiness: grouped });
}
