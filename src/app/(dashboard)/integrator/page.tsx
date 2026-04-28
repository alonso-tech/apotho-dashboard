import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentQuarter } from "@/lib/quarter";
import { IntegratorBoard } from "@/components/rocks/integrator-board";
import { CreateRockForm } from "@/components/rocks/create-rock-form";
import { isAdmin } from "@/lib/access";

export default async function IntegratorPage({
  searchParams,
}: {
  searchParams: { q?: string; year?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return notFound();

  // Allow access for admin roles OR users who are integrator on at least one rock
  const isAdminUser = isAdmin(session.user.role);
  if (!isAdminUser) {
    const integratorCheck = await prisma.rock.findFirst({
      where: { integratorId: session.user.id },
    });
    if (!integratorCheck) return notFound();
  }

  const { quarter: defaultQ, year: defaultYear } = getCurrentQuarter();
  const selectedQ = searchParams.q ? parseInt(searchParams.q, 10) : defaultQ;
  const selectedYear = searchParams.year ? parseInt(searchParams.year, 10) : defaultYear;

  // Admin emails see ALL rocks; other integrators see only their own
  const integratorFilter = isAdminUser
    ? { integratorId: { not: null } }
    : { integratorId: session.user.id };

  // Get all OPEN rocks, grouped by business
  const rocks = await prisma.rock.findMany({
    where: {
      ...integratorFilter,
      quarter: selectedQ,
      year: selectedYear,
      done: false,
    },
    include: {
      owner: { select: { id: true, name: true } },
      owners: { select: { id: true, name: true } },
      business: { select: { id: true, name: true, slug: true } },
      todos: { select: { id: true, done: true } },
    },
    orderBy: [{ business: { name: "asc" } }, { createdAt: "asc" }],
  });

  // Group rocks by business
  type CardType = {
    id: string;
    title: string;
    ownerName: string;
    businessName: string;
    status: string;
    done: boolean;
    todoDone: number;
    todoTotal: number;
    slug: string;
  };
  type ColumnType = { businessName: string; businessSlug: string; rocks: CardType[] };

  const byBusiness: Record<string, ColumnType> = {};
  const byOwner: Record<string, ColumnType> = {};

  for (const rock of rocks) {
    const ownerNames = rock.owners.length > 0
      ? rock.owners.map((o) => o.name).join(", ")
      : rock.owner.name;
    const card = {
      id: rock.id,
      title: rock.title,
      ownerName: ownerNames,
      businessName: rock.business.name,
      status: rock.status,
      done: rock.done,
      todoDone: rock.todos.filter((t) => t.done).length,
      todoTotal: rock.todos.length,
      slug: rock.business.slug,
    };

    const bKey = rock.business.slug;
    if (!byBusiness[bKey]) {
      byBusiness[bKey] = {
        businessName: rock.business.name,
        businessSlug: rock.business.slug,
        rocks: [],
      };
    }
    byBusiness[bKey].rocks.push(card);

    // For "By Owner", put the rock under each assigned owner
    const ownerList = rock.owners.length > 0 ? rock.owners : [rock.owner];
    for (const o of ownerList) {
      const oKey = o.id;
      if (!byOwner[oKey]) {
        byOwner[oKey] = {
          businessName: o.name ?? "Unassigned",
          businessSlug: oKey,
          rocks: [],
        };
      }
      byOwner[oKey].rocks.push(card);
    }
  }

  // Sort owner columns alphabetically by name
  const byOwnerSorted: typeof byOwner = {};
  for (const k of Object.keys(byOwner).sort((a, b) =>
    byOwner[a].businessName.localeCompare(byOwner[b].businessName)
  )) {
    byOwnerSorted[k] = byOwner[k];
  }

  // Totals across open + completed for accurate progress
  const allCounts = await prisma.rock.groupBy({
    by: ["done"],
    where: {
      ...integratorFilter,
      quarter: selectedQ,
      year: selectedYear,
    },
    _count: { _all: true },
  });
  const doneRocksTotal = allCounts.find((c) => c.done)?._count._all ?? 0;
  const totalRocksAll =
    (allCounts.find((c) => !c.done)?._count._all ?? 0) + doneRocksTotal;

  // Get available quarters for the filter
  const quarters = await prisma.rock.groupBy({
    by: ["quarter", "year"],
    where: integratorFilter,
    orderBy: [{ year: "desc" }, { quarter: "desc" }],
  });

  // Calendar data: all rocks with target dates + all milestones for this quarter
  const [calendarRocksRaw, calendarMilestonesRaw] = await Promise.all([
    prisma.rock.findMany({
      where: {
        ...integratorFilter,
        quarter: selectedQ,
        year: selectedYear,
        targetCompletionDate: { not: null },
        done: false,
      },
      include: {
        owners: { select: { name: true } },
        owner: { select: { name: true } },
        business: { select: { slug: true, name: true } },
      },
    }),
    prisma.rockMilestone.findMany({
      where: {
        done: false,
        rock: {
          ...integratorFilter,
          quarter: selectedQ,
          year: selectedYear,
        },
      },
      include: {
        rock: {
          select: {
            id: true,
            title: true,
            business: { select: { slug: true, name: true } },
            owners: { select: { name: true } },
            owner: { select: { name: true } },
          },
        },
      },
    }),
  ]);

  const calendarRocks = calendarRocksRaw.map((r) => ({
    id: r.id,
    title: r.title,
    ownerName: r.owners.length > 0 ? r.owners.map((o) => o.name).join(", ") : r.owner.name,
    businessName: r.business.name,
    slug: r.business.slug,
    targetDate: r.targetCompletionDate!.toISOString().split("T")[0],
    status: r.status,
    done: r.done,
  }));

  const calendarMilestones = calendarMilestonesRaw.map((m) => ({
    id: m.id,
    title: m.title,
    rockTitle: m.rock.title,
    rockId: m.rock.id,
    slug: m.rock.business.slug,
    businessName: m.rock.business.name,
    ownerName: m.rock.owners.length > 0 ? m.rock.owners.map((o) => o.name).join(", ") : m.rock.owner.name,
    endDate: m.endDate.toISOString().split("T")[0],
    done: m.done,
  }));

  // For create rock form
  const [allBusinesses, allUsers] = await Promise.all([
    prisma.business.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-3xl font-bold tracking-tight gradient-text">Integrator View</h1>
          <p className="text-sm text-muted-foreground">
            Open rocks across companies &middot; Q{selectedQ} {selectedYear}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <CreateRockForm
            businesses={allBusinesses}
            users={allUsers}
            defaultQuarter={selectedQ}
            defaultYear={selectedYear}
          />
          <a
            href="/integrator/completed"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg border bg-card text-sm font-medium btn-outline-gold"
          >
            View Completed Rocks
          </a>
        </div>
      </div>

      <IntegratorBoard
        byOwner={byOwnerSorted}
        byBusiness={byBusiness}
        quarters={quarters.map((q) => ({ quarter: q.quarter, year: q.year }))}
        selectedQ={selectedQ}
        selectedYear={selectedYear}
        totalRocks={totalRocksAll}
        doneRocks={doneRocksTotal}
        calendarRocks={calendarRocks}
        calendarMilestones={calendarMilestones}
      />
    </div>
  );
}
