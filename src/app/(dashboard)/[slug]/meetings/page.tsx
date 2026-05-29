import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ChevronLeftIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StartMeetingButton } from "@/components/meetings/start-meeting-button";

interface PageProps {
  params: { slug: string };
}

export default async function MeetingsPage({ params }: PageProps) {
  const business = await prisma.business.findUnique({
    where: { slug: params.slug },
  });

  if (!business) notFound();

  const meetings = await prisma.meeting.findMany({
    where: { businessId: business.id },
    orderBy: { date: "desc" },
    take: 20,
    include: { _count: { select: { todos: true } }, todos: { select: { done: true } } },
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight gradient-text">Meetings</h1>
            <p className="text-sm text-muted-foreground mt-1">Level 10 meeting history</p>
          </div>
          <StartMeetingButton businessId={business.id} businessSlug={business.slug} />
        </div>
      </div>

      {meetings.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">No meetings yet.</p>
          <StartMeetingButton businessId={business.id} businessSlug={business.slug} label="Start your first meeting" />
        </div>
      )}

      <div className="flex flex-col gap-3">
        {meetings.map((meeting) => (
          <Link key={meeting.id} href={`/${params.slug}/meetings/${meeting.id}`}>
            <Card className="cursor-pointer card-interactive">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {new Date(meeting.date).toLocaleDateString("en-US", {
                      weekday: "long",
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </CardTitle>
                  <div className="flex gap-2">
                    {meeting.todos.length > 0 && (
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        meeting.todos.filter((t) => t.done).length === meeting.todos.length
                          ? "bg-green-100 text-green-700"
                          : "bg-orange-100 text-orange-700"
                      }`}>
                        To-Dos: {meeting.todos.filter((t) => t.done).length}/{meeting.todos.length}
                      </span>
                    )}
                    {meeting.avgRating !== null && (
                      <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700">
                        Rating: {meeting.avgRating.toFixed(1)}/10
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {meeting.endedAt
                    ? `Completed — ${Math.round((new Date(meeting.endedAt).getTime() - new Date(meeting.startedAt).getTime()) / 60000)} min`
                    : "In progress"}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
