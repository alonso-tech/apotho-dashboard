import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ChevronLeftIcon } from "lucide-react";
import { ScorecardManager } from "@/components/scorecard/scorecard-manager";
import { getCurrentQuarter } from "@/lib/quarter";

interface PageProps {
  params: { slug: string };
  searchParams: { q?: string; year?: string };
}

function getQuarterWeekStarts(quarter: number, year: number): Date[] {
  const startMonth = (quarter - 1) * 3;
  const quarterStart = new Date(Date.UTC(year, startMonth, 1));
  const quarterEnd = new Date(Date.UTC(year, startMonth + 3, 0));

  // First week: the Sunday on or before the quarter start (full week)
  const firstDay = quarterStart.getUTCDay(); // 0=Sun
  const firstSunday = new Date(quarterStart);
  firstSunday.setUTCDate(firstSunday.getUTCDate() - firstDay);

  const weeks: Date[] = [];
  const cursor = new Date(firstSunday);
  while (cursor.getTime() <= quarterEnd.getTime()) {
    weeks.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  return weeks;
}

export default async function ScorecardPage({ params, searchParams }: PageProps) {
  const business = await prisma.business.findUnique({
    where: { slug: params.slug },
  });

  if (!business) notFound();

  const { quarter: defaultQ, year: defaultYear } = getCurrentQuarter();
  const selectedQ = searchParams.q ? parseInt(searchParams.q, 10) : defaultQ;
  const selectedYear = searchParams.year ? parseInt(searchParams.year, 10) : defaultYear;

  const weekStarts = getQuarterWeekStarts(selectedQ, selectedYear);
  const oldest = weekStarts[0];
  const startMonth = (selectedQ - 1) * 3;
  const quarterEnd = new Date(Date.UTC(selectedYear, startMonth + 3, 0, 23, 59, 59, 999));

  const measurables = await prisma.measurable.findMany({
    where: { businessId: business.id },
    include: {
      entries: {
        where: { weekOf: { gte: oldest, lte: quarterEnd } },
        orderBy: { weekOf: "asc" },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/${params.slug}`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeftIcon className="h-4 w-4 mr-1" />
          {business.name}
        </Link>
        <h1 className="text-3xl font-bold tracking-tight gradient-text">Scorecard</h1>
        <p className="text-sm text-muted-foreground mt-1">Weekly KPIs & measurables</p>
      </div>

      <ScorecardManager
        businessId={business.id}
        businessSlug={business.slug}
        selectedQuarter={selectedQ}
        selectedYear={selectedYear}
        measurables={measurables.map((m) => ({
          id: m.id,
          name: m.name,
          goal: m.goal,
          unit: m.unit ?? "",
          goalDirection: m.goalDirection || "gte",
          entries: m.entries.map((e) => ({
            id: e.id,
            weekOf: e.weekOf.toISOString(),
            actual: e.actual,
            onTrack: e.onTrack,
          })),
        }))}
        weeks={weekStarts.map((d) => d.toISOString())}
      />
    </div>
  );
}
