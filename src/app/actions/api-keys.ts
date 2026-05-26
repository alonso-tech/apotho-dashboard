"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateApiKey } from "@/lib/api-auth";
import { revalidatePath } from "next/cache";

export async function createApiKey(name: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const { rawKey, keyHash, keyPrefix } = generateApiKey();
  await prisma.apiKey.create({
    data: { userId: session.user.id, name, keyHash, keyPrefix },
  });

  revalidatePath("/settings");
  return { rawKey };
}

export async function listApiKeys() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  return prisma.apiKey.findMany({
    where: { userId: session.user.id, revokedAt: null },
    select: { id: true, name: true, keyPrefix: true, lastUsedAt: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function revokeApiKey(keyId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const key = await prisma.apiKey.findUnique({ where: { id: keyId } });
  if (!key || key.userId !== session.user.id) throw new Error("Not found");

  await prisma.apiKey.update({ where: { id: keyId }, data: { revokedAt: new Date() } });
  revalidatePath("/settings");
}
