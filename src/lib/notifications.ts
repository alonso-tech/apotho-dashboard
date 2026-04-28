import { Resend } from "resend";
import { prisma } from "./prisma";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM_EMAIL = process.env.NOTIFICATION_FROM_EMAIL || "Apotho Dashboard <notifications@apotho.com>";
const APP_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

interface NotifyOptions {
  userId: string;
  type: "rock-assigned" | "todo-assigned" | "note-mention";
  title: string;
  body: string;
  href?: string;
}

export async function notify({ userId, type, title, body, href }: NotifyOptions) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true },
  });
  if (!user) return;

  // Create in-app notification
  const notification = await prisma.notification.create({
    data: { userId, type, title, body, href },
  });

  // Send email
  if (resend && user.email) {
    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: user.email,
        subject: title,
        html: buildEmailHtml({ title, body, href, recipientName: user.name }),
      });
      await prisma.notification.update({
        where: { id: notification.id },
        data: { emailSent: true },
      });
    } catch (err) {
      console.error("Failed to send notification email:", err);
    }
  }
}

export async function notifyMany(notifications: NotifyOptions[]) {
  await Promise.allSettled(notifications.map((n) => notify(n)));
}

function buildEmailHtml({
  title,
  body,
  href,
  recipientName,
}: {
  title: string;
  body: string;
  href?: string;
  recipientName: string;
}) {
  const fullUrl = href ? `${APP_URL}${href}` : APP_URL;
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
      <div style="border-bottom: 3px solid #7c3aed; padding-bottom: 16px; margin-bottom: 24px;">
        <h2 style="margin: 0; color: #1a1a1a; font-size: 20px;">Apotho Dashboard</h2>
      </div>
      <p style="color: #374151; font-size: 15px; margin-bottom: 8px;">Hi ${recipientName},</p>
      <h3 style="color: #1a1a1a; font-size: 17px; margin-bottom: 12px;">${title}</h3>
      <p style="color: #4b5563; font-size: 14px; line-height: 1.6; margin-bottom: 24px;">${body}</p>
      ${href ? `<a href="${fullUrl}" style="display: inline-block; background: #7c3aed; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-size: 14px; font-weight: 500;">View in Dashboard</a>` : ""}
      <p style="color: #9ca3af; font-size: 12px; margin-top: 32px; border-top: 1px solid #e5e7eb; padding-top: 16px;">
        This notification was sent from the Apotho Dashboard.
      </p>
    </div>
  `;
}
