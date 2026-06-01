import { notFound } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentQuarter } from "@/lib/quarter";
import { ChevronLeftIcon } from "lucide-react";
import { MeetingRunner } from "@/components/meetings/meeting-runner";

interface PageProps {
  params: { slug: string; meetingId: string };
}

export default async function MeetingPage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const business = await prisma.business.findUnique({
    where: { slug: params.slug },
    include: { owners: { include: { user: true } } },
  });
  if (!business) notFound();

  const meeting = await prisma.meeting.findUnique({
    where: { id: params.meetingId },
    include: {
      segues: { include: { user: true } },
      issues: { orderBy: { createdAt: "asc" } },
      ratings: { include: { user: true } },
      todos: { include: { owner: true } },
    },
  });
  if (!meeting || meeting.businessId !== business.id) notFound();

  // Find the previous meeting's todos and issues
  const previousMeeting = await prisma.meeting.findFirst({
    where: {
      businessId: business.id,
      id: { not: meeting.id },
      date: { lt: meeting.date },
    },
    orderBy: { date: "desc" },
    include: {
      todos: { include: { owner: true } },
      issues: true,
    },
  });

  // Only carry over incomplete (not done, not killed) todos
  const previousTodos = (previousMeeting?.todos ?? [])
    .filter((t) => !t.done && !t.killed)
    .map((t) => ({
      id: t.id,
      title: t.title,
      done: t.done,
      ownerName: t.owner.name,
      ownerId: t.ownerId,
      rockId: t.rockId,
    }));

  const previousIssues = (previousMeeting?.issues ?? []).map((i) => ({
    id: i.id,
    title: i.title,
    notes: i.notes ?? "",
    resolved: i.resolved,
    meetingId: i.meetingId,
  }));

  const rocks = await prisma.rock.findMany({
    where: { businessId: business.id, quarter: getCurrentQuarter().quarter, year: getCurrentQuarter().year },
    include: { owner: true },
    orderBy: { createdAt: "asc" },
  });

  // Fetch full scorecard data for the current quarter (same as scorecard page)
  const { quarter: currentQ, year: currentYear } = getCurrentQuarter();
  const startMonth = (currentQ - 1) * 3;
  const quarterStart = new Date(Date.UTC(currentYear, startMonth, 1));
  const quarterEnd = new Date(Date.UTC(currentYear, startMonth + 3, 0, 23, 59, 59, 999));
  const firstDay = quarterStart.getUTCDay();
  const firstSunday = new Date(quarterStart);
  firstSunday.setUTCDate(firstSunday.getUTCDate() - firstDay);
  const scorecardWeeks: Date[] = [];
  const cursor = new Date(firstSunday);
  while (cursor.getTime() <= quarterEnd.getTime()) {
    scorecardWeeks.push(new Date(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }

  const measurables = await prisma.measurable.findMany({
    where: { businessId: business.id },
    include: {
      entries: {
        where: { weekOf: { gte: scorecardWeeks[0], lte: quarterEnd } },
        orderBy: { weekOf: "asc" },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const owners = business.owners.map((o) => ({ id: o.user.id, name: o.user.name }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/${params.slug}/meetings`}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeftIcon className="h-4 w-4 mr-1" />
          Meetings
        </Link>
        <h1 className="text-3xl font-bold tracking-tight gradient-text">
          Level 10 Meeting &mdash;{" "}
          {new Date(meeting.date).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {meeting.endedAt ? "Completed" : "In progress"}
          {meeting.avgRating !== null && ` — Avg rating: ${meeting.avgRating.toFixed(1)}/10`}
        </p>
      </div>

      <MeetingRunner
        meeting={{
          id: meeting.id,
          businessId: meeting.businessId,
          endedAt: meeting.endedAt?.toISOString() ?? null,
          segues: meeting.segues.map((s) => ({
            id: s.id,
            userId: s.userId,
            userName: s.user.name,
            personal: s.personal,
            professional: s.professional,
          })),
          issues: meeting.issues.map((i) => ({
            id: i.id,
            title: i.title,
            notes: i.notes ?? "",
            resolved: i.resolved,
            meetingId: i.meetingId,
          })),
          ratings: meeting.ratings.map((r) => ({
            id: r.id,
            userId: r.userId,
            userName: r.user.name,
            rating: r.rating,
          })),
          todos: meeting.todos.map((t) => ({
            id: t.id,
            title: t.title,
            done: t.done,
            ownerName: t.owner.name,
            ownerId: t.ownerId,
            rockId: t.rockId,
          })),
        }}
        rocks={rocks.map((r) => ({
          id: r.id,
          title: r.title,
          done: r.done,
          ownerName: r.owner.name,
        }))}
        measurables={measurables.map((m) => ({
          id: m.id,
          name: m.name,
          goal: m.goal,
          unit: m.unit ?? "",
          goalDirection: m.goalDirection || "gte",
          entries: m.entries.map((e) => ({
            weekOf: e.weekOf.toISOString(),
            actual: e.actual,
            onTrack: e.onTrack,
          })),
        }))}
        scorecardWeeks={scorecardWeeks.map((d) => d.toISOString())}
        previousTodos={previousTodos}
        previousIssues={previousIssues}
        owners={owners}
        businessSlug={params.slug}
      />
    </div>
  );
}
