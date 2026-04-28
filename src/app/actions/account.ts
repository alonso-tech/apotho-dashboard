"use server";

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function changePassword(currentPassword: string, newPassword: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { hashedPassword: true },
  });

  if (!user?.hashedPassword) {
    return { error: "Account not found." };
  }

  const isValid = await bcrypt.compare(currentPassword, user.hashedPassword);
  if (!isValid) {
    return { error: "Current password is incorrect." };
  }

  const hashed = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({
    where: { id: session.user.id },
    data: { hashedPassword: hashed },
  });

  return { success: true };
}

export async function updateProfile(name: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  if (!name.trim()) {
    return { error: "Name is required." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: name.trim() },
  });

  return { success: true };
}
