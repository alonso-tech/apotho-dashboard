import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentQuarter } from "@/lib/quarter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TargetIcon, CheckSquareIcon, CalendarIcon, BarChart2Icon, DollarSignIcon } from "lucide-react";
import { BusinessAccessManager } from "@/components/business-access-manager";
import { isAdmin as checkAdmin } from "@/lib/access";

interface PageProps {
  params: { slug: string };
}

export default async function BusinessPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  const { quarter: currentQ, year: currentYear } = getCurrentQuarter();

  const business = await prisma.business.findUnique({
    where: { slug: params.slug },
    include: {
      owners: { include: { user: true } },
    },
  });

  if (!business) notFound();

  const isAdminUser = checkAdmin(session?.user?.role);
  const allUsers = isAdminUser
    ? await prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } })
    : [];

  const sections = [
    {
      label: "Open Rocks",
      href: `/${business.slug}/rocks`,
      icon: TargetIcon,
      description: `Q${currentQ} ${currentYear} priorities`,
    },
    {
      label: "To-Dos",
      href: `/${business.slug}/todos`,
      icon: CheckSquareIcon,
      description: "Open action items",
    },
    {
      label: "Meetings",
      href: `/${business.slug}/meetings`,
      icon: CalendarIcon,
      description: "Level 10 meeting history",
    },
    {
      label: "Scorecard",
      href: `/${business.slug}/scorecard`,
      icon: BarChart2Icon,
      description: "Weekly KPIs & measurables",
    },
    {
      label: "Financials",
      href: `/${business.slug}/financials`,
      icon: DollarSignIcon,
      description: "Revenue & expense overview",
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight gradient-text">{business.name}</h1>
        {business.description && (
          <p className="text-sm text-muted-foreground mt-1">{business.description}</p>
        )}
        <div className="flex flex-wrap gap-2 mt-3">
          {business.owners.map((o) => (
            <span
              key={o.id}
              className="inline-flex items-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium"
            >
              {o.user.name} <span className="text-muted-foreground ml-1">({o.role})</span>
            </span>
          ))}
        </div>
        {isAdminUser && (
          <BusinessAccessManager
            businessId={business.id}
            currentOwners={business.owners.map((o) => ({
              id: o.id,
              userId: o.userId,
              userName: o.user.name,
              role: o.role,
            }))}
            allUsers={allUsers}
          />
        )}
      </div>

      {/* Quick nav cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sections.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="cursor-pointer card-interactive h-full">
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                  <s.icon className="h-5 w-5 text-primary" />
                </div>
                <CardTitle className="text-base">{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{s.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

    </div>
  );
}
