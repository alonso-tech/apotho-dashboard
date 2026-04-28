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

  const rocks = await prisma.rock.findMany({
    where: { businessId: business.id, quarter: getCurrentQuarter().quarter, year: getCurrentQuarter().year },
    include: { owner: true },
    orderBy: { createdAt: "asc" },
  });

  const measurables = await prisma.measurable.findMany({
    where: { businessId: business.id },
    include: {
      entries: {
        orderBy: { weekOf: "desc" },
        take: 1,
      },
    },
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
          latestActual: m.entries[0]?.actual ?? null,
          onTrack: m.entries[0]?.onTrack ?? null,
        }))}
        owners={owners}
        businessSlug={params.slug}
      />
    </div>
  );
}
