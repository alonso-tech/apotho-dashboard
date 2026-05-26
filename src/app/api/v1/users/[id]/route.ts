import { NextResponse } from "next/server";
import { withApiAuth } from "@/lib/api-handler";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/access";

export const PATCH = withApiAuth(async (req, user) => {
  if (!isAdmin(user.role)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const id = req.nextUrl.pathname.split("/").pop()!;
  const body = await req.json();
  const { role, name } = body;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data: any = {};
  if (role !== undefined) data.role = role;
  if (name !== undefined) data.name = name;

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true },
  });
  return NextResponse.json({ data: updated });
});
