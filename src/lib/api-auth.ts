import crypto from "crypto";
import { prisma } from "@/lib/prisma";

export function generateApiKey() {
  const rawKey = "ak_" + crypto.randomBytes(32).toString("hex");
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 11);
  return { rawKey, keyHash, keyPrefix };
}

export async function authenticateApiKey(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ak_")) return null;

  const rawKey = authHeader.slice(7);
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");

  const apiKey = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });

  if (!apiKey) return null;
  if (apiKey.revokedAt) return null;
  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

  // Fire-and-forget lastUsedAt update
  prisma.apiKey.update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } }).catch(() => {});

  return apiKey.user;
}
