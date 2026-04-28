import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { RockLinkItem } from "@/components/rocks/rock-link-item";
import { CreateRockForm } from "@/components/rocks/create-rock-form";
import { getCurrentQuarter } from "@/lib/quarter";

const DONALD_ID = "cmnghjpm70001g0vpykrfkag5";

interface SearchParams {
  q?: string;
  year?: string;
}

export default async function MyRocksPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const { quarter: defaultQ, year: defaultYear } = getCurrentQuarter();
  const selectedQ = parseInt(searchParams.q ?? String(defaultQ), 10) || defaultQ;
  const selectedYear = parseInt(searchParams.year ?? String(defaultYear), 10) || defaultYear;

  const [openRocks, completedCount] = await Promise.all([
    prisma.rock.findMany({
      where: {
        owners: { some: { id: session.user.id } },
        quarter: selectedQ,
        year: selectedYear,
        done: false,
      },
      include: { business: true, todos: { select: { id: true, done: true } } },
      orderBy: { createdAt: "asc" },
    }),
    prisma.rock.count({
      where: {
        owners: { some: { id: session.user.id } },
        quarter: selectedQ,
        year: selectedYear,
        done: true,
      },
    }),
  ]);

  const rocks = openRocks;

  const [allBusinesses, allUsers] = await Promise.all([
    prisma.business.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } }),
    prisma.user.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  // Group by business
  const byBusiness = rocks.reduce<Record<string, typeof rocks>>((acc, rock) => {
    const key = rock.business.name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(rock);
    return acc;
  }, {});

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight gradient-text">My Rocks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Q{selectedQ} {selectedYear} &mdash; {rocks.length} open
          </p>
        </div>
        <CreateRockForm
          businesses={allBusinesses}
          users={allUsers}
          defaultQuarter={selectedQ}
          defaultYear={selectedYear}
          integratorId={DONALD_ID}
          currentUserId={session.user.id}
        />
      </div>

      {/* Quarter filter */}
      <div className="flex items-center gap-2 flex-wrap">
        {[1, 2, 3, 4].map((q) => (
          <Link
            key={q}
            href={`/my-rocks?q=${q}&year=${selectedYear}`}
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium border transition-colors ${
              q === selectedQ
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-accent border-input"
            }`}
          >
            Q{q}
          </Link>
        ))}
      </div>

      {rocks.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">No rocks assigned to you for Q{selectedQ} {selectedYear}.</p>
      )}

      {Object.entries(byBusiness).map(([bizName, bizRocks]) => (
        <div key={bizName}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {bizName}
          </h2>
          <div className="flex flex-col gap-2">
            {bizRocks.map((rock) => (
              <RockLinkItem
                key={rock.id}
                rockId={rock.id}
                href={`/${rock.business.slug}/rocks/${rock.id}`}
                title={rock.title}
                done={rock.done}
                todoDone={rock.todos.filter((t) => t.done).length}
                todoTotal={rock.todos.length}
              />
            ))}
          </div>
        </div>
      ))}

      {completedCount > 0 && (
        <Link
          href={`/my-rocks/completed?q=${selectedQ}&year=${selectedYear}`}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground border rounded-lg px-4 py-2.5 hover:bg-muted/50 transition-colors"
        >
          View {completedCount} completed rock{completedCount !== 1 ? "s" : ""}
        </Link>
      )}
    </div>
  );
}
