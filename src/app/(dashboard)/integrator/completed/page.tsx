import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CheckCircle2Icon, ArrowLeftIcon, BuildingIcon } from "lucide-react";
import { isAdmin } from "@/lib/access";

export default async function CompletedRocksPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return notFound();

  const isAdminUser = isAdmin(session.user.role);
  if (!isAdminUser) {
    const integratorCheck = await prisma.rock.findFirst({
      where: { integratorId: session.user.id },
    });
    if (!integratorCheck) return notFound();
  }

  const integratorFilter = isAdminUser
    ? { integratorId: { not: null } }
    : { integratorId: session.user.id };

  const rocks = await prisma.rock.findMany({
    where: { ...integratorFilter, done: true },
    include: {
      owner: { select: { name: true } },
      owners: { select: { name: true } },
      business: { select: { name: true, slug: true } },
    },
    orderBy: [{ year: "desc" }, { quarter: "desc" }, { updatedAt: "desc" }],
  });

  // Group by quarter/year
  const byQuarter: Record<string, typeof rocks> = {};
  for (const r of rocks) {
    const key = `Q${r.quarter} ${r.year}`;
    (byQuarter[key] ??= []).push(r);
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in-up">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight gradient-text">
            Completed Rocks
          </h1>
          <p className="text-sm text-muted-foreground">
            Archive of all rocks that have been finished &middot; {rocks.length} total
          </p>
        </div>
        <Link
          href="/integrator"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border bg-card text-sm font-medium btn-outline-gold"
        >
          <ArrowLeftIcon className="h-4 w-4" /> Back to Integrator
        </Link>
      </div>

      {rocks.length === 0 && (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          No completed rocks yet. When you mark a rock complete on the integrator
          board, it will move here.
        </div>
      )}

      {Object.entries(byQuarter).map(([quarter, qRocks]) => (
        <div key={quarter} className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">{quarter}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {qRocks.map((rock) => (
              <Link
                key={rock.id}
                href={`/${rock.business.slug}/rocks/${rock.id}`}
                className="rounded-lg border bg-card p-4 card-interactive flex flex-col gap-2"
              >
                <div className="flex items-start gap-2">
                  <CheckCircle2Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                  <p className="text-sm font-medium leading-snug line-through text-muted-foreground">
                    {rock.title}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-auto pt-2 border-t">
                  <BuildingIcon className="h-3 w-3" />
                  <span>{rock.business.name}</span>
                  <span className="ml-auto">{rock.owners.length > 0 ? rock.owners.map((o) => o.name).join(", ") : rock.owner.name}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
