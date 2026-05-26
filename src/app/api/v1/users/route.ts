import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/access";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export const GET = withApiAuth(async (_req, user) => {
  if (!isAdmin(user.role)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { name: "asc" },
  });
  return NextResponse.json({ data: users });
});

export const POST = withApiAuth(async (req, user) => {
  if (!isAdmin(user.role)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const body = await req.json();
  const { name, email, role } = body;
  if (!name || !email) return NextResponse.json({ error: "Missing required fields: name, email" }, { status: 400 });

  const tempPassword = crypto.randomBytes(8).toString("hex");
  const hashedPassword = await bcrypt.hash(tempPassword, 12);
  const newUser = await prisma.user.create({
    data: { name, email, hashedPassword, role: role || "member" },
    select: { id: true, name: true, email: true, role: true },
  });
  return NextResponse.json({ data: { ...newUser, tempPassword } }, { status: 201 });
});
