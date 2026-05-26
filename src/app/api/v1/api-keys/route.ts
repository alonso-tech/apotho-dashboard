import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/api-auth";

export const GET = withApiAuth(async (_req, user) => {
  const keys = await prisma.apiKey.findMany({
    where: { userId: user.id, revokedAt: null },
    select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ data: keys });
});

export const POST = withApiAuth(async (req, user) => {
  const body = await req.json();
  const { name } = body;
  if (!name) return NextResponse.json({ error: "Missing required field: name" }, { status: 400 });

  const { rawKey, keyHash, keyPrefix } = generateApiKey();
  await prisma.apiKey.create({ data: { userId: user.id, name, keyHash, keyPrefix } });

  return NextResponse.json({ data: { rawKey, keyPrefix, name } }, { status: 201 });
});
