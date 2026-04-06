import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { IntegratorBoard } from "@/components/rocks/integrator-board";

export default async function IntegratorPage({
  searchParams,
}: {
  searchParams: { q?: string; year?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return notFound();

  // Only show to integrators (users who are integrator on at least one rock)
  const integratorCheck = await prisma.rock.findFirst({
    where: { integratorId: session.user.id },
  });
  if (!integratorCheck) return notFound();

  const selectedQ = searchParams.q ? parseInt(searchParams.q, 10) : 2;
  const selectedYear = searchParams.year ? parseInt(searchParams.year, 10) : 2026;

  // Get all rocks where this user is integrator, grouped by business
  const rocks = await prisma.rock.findMany({
    where: {
      integratorId: session.user.id,
      quarter: selectedQ,
      year: selectedYear,
    },
    include: {
      owner: { select: { id: true, name: true } },
      business: { select: { id: true, name: true, slug: true } },
      todos: { select: { id: true, done: true } },
    },
    orderBy: [{ business: { name: "asc" } }, { createdAt: "asc" }],
  });

  // Group rocks by business
  const byBusiness: Record<
    string,
    {
      businessName: string;
      businessSlug: string;
      rocks: {
        id: string;
        title: string;
        ownerName: string;
        status: string;
        done: boolean;
        todoDone: number;
        todoTotal: number;
        slug: string;
      }[];
    }
  > = {};

  for (const rock of rocks) {
    const key = rock.business.slug;
    if (!byBusiness[key]) {
      byBusiness[key] = {
        businessName: rock.business.name,
        businessSlug: rock.business.slug,
        rocks: [],
      };
    }
    byBusiness[key].rocks.push({
      id: rock.id,
      title: rock.title,
      ownerName: rock.owner.name,
      status: rock.status,
      done: rock.done,
      todoDone: rock.todos.filter((t) => t.done).length,
      todoTotal: rock.todos.length,
      slug: rock.business.slug,
    });
  }

  // Get available quarters for the filter
  const quarters = await prisma.rock.groupBy({
    by: ["quarter", "year"],
    where: { integratorId: session.user.id },
    orderBy: [{ year: "desc" }, { quarter: "desc" }],
  });

  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Integrator View</h1>
          <p className="text-sm text-muted-foreground">
            All rocks across companies &middot; Q{selectedQ} {selectedYear}
          </p>
        </div>
      </div>

      <IntegratorBoard
        byBusiness={byBusiness}
        quarters={quarters.map((q) => ({ quarter: q.quarter, year: q.year }))}
        selectedQ={selectedQ}
        selectedYear={selectedYear}
        totalRocks={rocks.length}
        doneRocks={rocks.filter((r) => r.done).length}
      />
    </div>
  );
}
