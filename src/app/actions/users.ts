"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/access";
import bcrypt from "bcryptjs";
import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.NOTIFICATION_FROM_EMAIL || "Apotho Dashboard <notifications@apotho.com>";
const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.role)) {
    throw new Error("Unauthorized — admin access required");
  }
  return session;
}

function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pw = "";
  for (let i = 0; i < 12; i++) {
    pw += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pw;
}

export async function createUser(name: string, email: string) {
  const session = await requireAdmin();

  if (!name.trim() || !email.trim()) throw new Error("Name and email are required");

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (existing) throw new Error("A user with this email already exists");

  const tempPassword = generateTempPassword();
  const hashedPassword = await bcrypt.hash(tempPassword, 12);

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      hashedPassword,
      role: "member",
    },
  });

  // Send invitation email
  if (resend) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: user.email,
        subject: "You've been invited to the Apotho Dashboard",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
            <div style="border-bottom: 3px solid #7c3aed; padding-bottom: 16px; margin-bottom: 24px;">
              <h2 style="margin: 0; color: #1a1a1a; font-size: 20px;">Apotho Dashboard</h2>
            </div>
            <p style="color: #374151; font-size: 15px; margin-bottom: 8px;">Hi ${user.name},</p>
            <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin-bottom: 16px;">
              ${session.user.name || "An administrator"} has invited you to the Apotho Dashboard. Here are your login credentials:
            </p>
            <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #374151;"><strong>Email:</strong> ${user.email}</p>
              <p style="margin: 0; font-size: 14px; color: #374151;"><strong>Temporary Password:</strong> ${tempPassword}</p>
            </div>
            <a href="${APP_URL}/sign-in" style="display: inline-block; background: #7c3aed; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">Sign In</a>
            <p style="color: #9ca3af; font-size: 12px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
              This invitation was sent from the Apotho Dashboard.
            </p>
          </div>
        `,
      });
    } catch (err) {
      console.error("Failed to send invitation email:", err);
    }
  }

  revalidatePath("/admin/users");
  return { id: user.id, tempPassword };
}

export async function updateUserRole(userId: string, role: string) {
  await requireAdmin();
  if (!["integrator", "visionary", "member"].includes(role)) {
    throw new Error("Invalid role");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { role },
  });

  revalidatePath("/admin/users");
}

export async function addUserToBusiness(userId: string, businessId: string, role: string = "member") {
  await requireAdmin();

  await prisma.businessOwner.upsert({
    where: { userId_businessId: { userId, businessId } },
    update: { role },
    create: { userId, businessId, role },
  });

  revalidatePath("/admin/users");
}

export async function removeUserFromBusiness(userId: string, businessId: string) {
  await requireAdmin();

  await prisma.businessOwner.delete({
    where: { userId_businessId: { userId, businessId } },
  });

  revalidatePath("/admin/users");
}
