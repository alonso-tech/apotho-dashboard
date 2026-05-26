import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";

export const DELETE = withApiAuth(async (req, user) => {
  const id = req.nextUrl.pathname.split("/").pop()!;
  const key = await prisma.apiKey.findUnique({ where: { id } });
  if (!key || key.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  return NextResponse.json({ data: { revoked: true } });
});
