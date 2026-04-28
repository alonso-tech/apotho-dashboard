import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canAccessBusiness } from "@/lib/access";

export default async function BusinessLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { slug: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return notFound();

  const business = await prisma.business.findUnique({
    where: { slug: params.slug },
    select: { id: true },
  });
  if (!business) return notFound();

  const hasAccess = await canAccessBusiness(session.user.id, session.user.role, business.id);
  if (!hasAccess) return notFound();

  return <>{children}</>;
}
