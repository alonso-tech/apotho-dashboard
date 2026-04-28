import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/access";
import { UserManagement } from "@/components/admin/user-management";

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !isAdmin(session.user.role)) return notFound();

  const [users, businesses] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        ownedBusinesses: {
          include: { business: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.business.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return (
    <div className="flex flex-col gap-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight gradient-text">User Management</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage user roles and business access
        </p>
      </div>

      <UserManagement
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          businesses: u.ownedBusinesses.map((ob) => ({
            id: ob.business.id,
            name: ob.business.name,
            role: ob.role,
          })),
        }))}
        allBusinesses={businesses}
      />
    </div>
  );
}
