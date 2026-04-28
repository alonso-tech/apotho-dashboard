"use client";

import { useState, useTransition } from "react";
import { saveSegue, addIssue, resolveIssue, saveRating, endMeeting } from "@/app/actions/meetings";
import { toggleRock } from "@/app/actions/rocks";
import { createTodo } from "@/app/actions/todos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2Icon, CircleIcon, SquareIcon, ChevronRightIcon, ChevronLeftIcon } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MeetingData {
  id: string;
  businessId: string;
  endedAt: string | null;
  segues: Array<{ id: string; userId: string; userName: string; personal: string; professional: string }>;
  issues: Array<{ id: string; title: string; notes: string; resolved: boolean }>;
  ratings: Array<{ id: string; userId: string; userName: string; rating: number }>;
  todos: Array<{ id: string; title: string; done: boolean; ownerName: string }>;
}

interface RockData {
  id: string;
  title: string;
  done: boolean;
  ownerName: string;
}

interface MeasurableData {
  id: string;
  name: string;
  goal: string;
  unit: string;
  latestActual: string | null;
  onTrack: boolean | null;
}

interface Owner {
  id: string;
  name: string;
}

interface MeetingRunnerProps {
  meeting: MeetingData;
  rocks: RockData[];
  measurables: MeasurableData[];
  owners: Owner[];
  businessSlug: string;
}

const SECTIONS = [
  { id: 0, label: "Segue" },
  { id: 1, label: "Scorecard" },
  { id: 2, label: "Rocks Review" },
  { id: 3, label: "Issues (IDS)" },
  { id: 4, label: "To-Dos" },
  { id: 5, label: "Conclude" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export function MeetingRunner({ meeting, rocks, measurables, owners, businessSlug }: MeetingRunnerProps) {
  const [section, setSection] = useState(0);
  const isCompleted = !!meeting.endedAt;

  return (
    <div className="flex flex-col gap-4">
      {/* Section nav */}
      <div className="flex gap-1 flex-wrap">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              s.id === section
                ? "bg-primary text-primary-foreground"
                : "bg-muted hover:bg-muted/80 text-muted-foreground"
            }`}
          >
            {s.id + 1}. {s.label}
          </button>
        ))}
      </div>

      {/* Section content */}
      <Card>
        <CardHeader>
          <CardTitle>{SECTIONS[section].label}</CardTitle>
        </CardHeader>
        <CardContent>
          {section === 0 && (
            <SegueSection meeting={meeting} owners={owners} readOnly={isCompleted} />
          )}
          {section === 1 && (
            <ScorecardSection measurables={measurables} />
          )}
          {section === 2 && (
            <RocksSection rocks={rocks} readOnly={isCompleted} />
          )}
          {section === 3 && (
            <IssuesSection meeting={meeting} readOnly={isCompleted} />
          )}
          {section === 4 && (
            <TodosSection meeting={meeting} owners={owners} readOnly={isCompleted} />
          )}
          {section === 5 && (
            <ConcludeSection meeting={meeting} owners={owners} readOnly={isCompleted} businessSlug={businessSlug} />
          )}
        </CardContent>
      </Card>

      {/* Prev/Next */}
      <div className="flex justify-between">
        <Button
          variant="outline"
          onClick={() => setSection((s) => Math.max(0, s - 1))}
          disabled={section === 0}
        >
          <ChevronLeftIcon className="mr-1 h-4 w-4" /> Previous
        </Button>
        <Button
          onClick={() => setSection((s) => Math.min(SECTIONS.length - 1, s + 1))}
          disabled={section === SECTIONS.length - 1}
        >
          Next <ChevronRightIcon className="ml-1 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Section: Segue ───────────────────────────────────────────────────────────

function SegueSection({ meeting, owners, readOnly }: { meeting: MeetingData; owners: Owner[]; readOnly: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [selectedUser, setSelectedUser] = useState(owners[0]?.id ?? "");
  const [personal, setPersonal] = useState("");
  const [professional, setProfessional] = useState("");

  const existing = meeting.segues.find((s) => s.userId === selectedUser);

  function handleSave() {
    const fd = new FormData();
    fd.append("meetingId", meeting.id);
    fd.append("userId", selectedUser);
    fd.append("personal", personal || existing?.personal || "");
    fd.append("professional", professional || existing?.professional || "");
    startTransition(() => saveSegue(fd));
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Share a personal and professional win from the past week.</p>

      {meeting.segues.length > 0 && (
        <div className="flex flex-col gap-2 mb-2">
          {meeting.segues.map((s) => (
            <div key={s.id} className="rounded-lg bg-muted p-3">
              <p className="text-sm font-medium">{s.userName}</p>
              <p className="text-xs text-muted-foreground mt-1">Personal: {s.personal}</p>
              <p className="text-xs text-muted-foreground">Professional: {s.professional}</p>
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <div className="flex flex-col gap-3 border rounded-lg p-4">
          <div>
            <Label>Attendee</Label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm mt-1"
            >
              {owners.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Personal Win</Label>
            <Input
              value={personal}
              onChange={(e) => setPersonal(e.target.value)}
              placeholder="Something good in your personal life..."
              className="mt-1"
            />
          </div>
          <div>
            <Label>Professional Win</Label>
            <Input
              value={professional}
              onChange={(e) => setProfessional(e.target.value)}
              placeholder="Something good at work..."
              className="mt-1"
            />
          </div>
          <Button size="sm" onClick={handleSave} disabled={isPending}>
            {isPending ? "Saving..." : "Save Segue"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Section: Scorecard ───────────────────────────────────────────────────────

function ScorecardSection({ measurables }: { measurables: MeasurableData[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground mb-2">Review KPIs against targets.</p>
      {measurables.length === 0 && (
        <p className="text-sm text-muted-foreground">No measurables configured for this business.</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-4 font-medium">Measurable</th>
              <th className="text-right py-2 pr-4 font-medium">Goal</th>
              <th className="text-right py-2 pr-4 font-medium">Actual</th>
              <th className="text-center py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {measurables.map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="py-2 pr-4">{m.name}</td>
                <td className="text-right py-2 pr-4 text-muted-foreground">
                  {m.goal}{m.unit ? ` ${m.unit}` : ""}
                </td>
                <td className="text-right py-2 pr-4">
                  {m.latestActual !== null ? `${m.latestActual}${m.unit ? ` ${m.unit}` : ""}` : "—"}
                </td>
                <td className="text-center py-2">
                  {m.onTrack === null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : m.onTrack ? (
                    <span className="inline-block w-3 h-3 rounded-full bg-green-500" title="On track" />
                  ) : (
                    <span className="inline-block w-3 h-3 rounded-full bg-red-500" title="Off track" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Section: Rocks Review ────────────────────────────────────────────────────

function RocksSection({ rocks, readOnly }: { rocks: RockData[]; readOnly: boolean }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground mb-2">Review rocks — mark Done or Not Done.</p>
      {rocks.length === 0 && (
        <p className="text-sm text-muted-foreground">No rocks for this quarter.</p>
      )}
      {rocks.map((rock) => (
        <div key={rock.id} className="flex items-center gap-3 rounded-lg border p-3">
          {!readOnly ? (
            <button
              onClick={() => startTransition(() => toggleRock(rock.id))}
              disabled={isPending}
              className="shrink-0 disabled:opacity-50"
            >
              {rock.done ? (
                <CheckCircle2Icon className="h-5 w-5 text-green-500" />
              ) : (
                <CircleIcon className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
          ) : (
            <div className="shrink-0">
              {rock.done ? (
                <CheckCircle2Icon className="h-5 w-5 text-green-500" />
              ) : (
                <CircleIcon className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className={`text-sm ${rock.done ? "line-through text-muted-foreground" : ""}`}>{rock.title}</p>
            <p className="text-xs text-muted-foreground">{rock.ownerName}</p>
          </div>
          <span className={`text-xs font-medium ${rock.done ? "text-green-600" : "text-orange-600"}`}>
            {rock.done ? "Done" : "Not Done"}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Section: Issues (IDS) ────────────────────────────────────────────────────

function IssuesSection({ meeting, readOnly }: { meeting: MeetingData; readOnly: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [newIssue, setNewIssue] = useState("");
  const [resolveNotes, setResolveNotes] = useState<Record<string, string>>({});

  function handleAdd() {
    if (!newIssue.trim()) return;
    const fd = new FormData();
    fd.append("meetingId", meeting.id);
    fd.append("title", newIssue);
    startTransition(async () => {
      await addIssue(fd);
      setNewIssue("");
    });
  }

  function handleResolve(issueId: string) {
    startTransition(() => resolveIssue(issueId, resolveNotes[issueId] ?? ""));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Identify, Discuss, Solve — add issues and resolve them.</p>

      {meeting.issues.map((issue) => (
        <div key={issue.id} className={`rounded-lg border p-3 ${issue.resolved ? "bg-muted/50 opacity-70" : ""}`}>
          <div className="flex items-start gap-2">
            <div className="mt-0.5 shrink-0">
              {issue.resolved ? (
                <CheckCircle2Icon className="h-4 w-4 text-green-500" />
              ) : (
                <CircleIcon className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${issue.resolved ? "line-through text-muted-foreground" : ""}`}>
                {issue.title}
              </p>
              {issue.notes && (
                <p className="text-xs text-muted-foreground mt-1">{issue.notes}</p>
              )}
              {!issue.resolved && !readOnly && (
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Resolution notes..."
                    value={resolveNotes[issue.id] ?? ""}
                    onChange={(e) => setResolveNotes((prev) => ({ ...prev, [issue.id]: e.target.value }))}
                    className="text-xs h-7"
                  />
                  <Button size="sm" variant="outline" onClick={() => handleResolve(issue.id)} disabled={isPending}>
                    Resolve
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}

      {!readOnly && (
        <div className="flex gap-2 mt-1">
          <Input
            placeholder="Add an issue..."
            value={newIssue}
            onChange={(e) => setNewIssue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button onClick={handleAdd} disabled={isPending || !newIssue.trim()}>
            Add
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Section: To-Dos ──────────────────────────────────────────────────────────

function TodosSection({ meeting, owners, readOnly }: { meeting: MeetingData; owners: Owner[]; readOnly: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState("");
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? "");

  function handleAdd() {
    if (!title.trim()) return;
    const fd = new FormData();
    fd.append("title", title);
    fd.append("businessId", meeting.businessId);
    fd.append("meetingId", meeting.id);
    fd.append("ownerId", ownerId);
    startTransition(async () => {
      await createTodo(fd);
      setTitle("");
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Create 7-day action items from the meeting.</p>

      {meeting.todos.map((todo) => (
        <div key={todo.id} className="flex items-center gap-3 rounded-lg border p-3">
          <SquareIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm">{todo.title}</p>
            <p className="text-xs text-muted-foreground">{todo.ownerName}</p>
          </div>
        </div>
      ))}

      {!readOnly && (
        <div className="flex flex-col gap-2 border rounded-lg p-3 mt-1">
          <div className="flex gap-2">
            <Input
              placeholder="New to-do..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            />
            <select
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            >
              {owners.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
            <Button onClick={handleAdd} disabled={isPending || !title.trim()}>
              Add
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Section: Conclude ────────────────────────────────────────────────────────

function ConcludeSection({
  meeting,
  owners,
  readOnly,
  businessSlug,
}: {
  meeting: MeetingData;
  owners: Owner[];
  readOnly: boolean;
  businessSlug: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [selectedUser, setSelectedUser] = useState(owners[0]?.id ?? "");
  const [rating, setRating] = useState(8);

  function handleSaveRating() {
    const fd = new FormData();
    fd.append("meetingId", meeting.id);
    fd.append("userId", selectedUser);
    fd.append("rating", String(rating));
    startTransition(() => saveRating(fd));
  }

  function handleEnd() {
    startTransition(async () => {
      await endMeeting(meeting.id);
      window.location.href = `/${businessSlug}/meetings`;
    });
  }

  const avgRating =
    meeting.ratings.length > 0
      ? (meeting.ratings.reduce((s, r) => s + r.rating, 0) / meeting.ratings.length).toFixed(1)
      : null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">Rate the meeting 1–10 and end the session.</p>

      {/* Existing ratings */}
      {meeting.ratings.length > 0 && (
        <div className="flex flex-col gap-1">
          {meeting.ratings.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm">
              <span>{r.userName}</span>
              <span className="font-semibold">{r.rating}/10</span>
            </div>
          ))}
          {avgRating && (
            <div className="flex items-center justify-between text-sm font-semibold border-t pt-2 mt-1">
              <span>Average</span>
              <span>{avgRating}/10</span>
            </div>
          )}
        </div>
      )}

      {!readOnly && (
        <div className="flex flex-col gap-3 border rounded-lg p-4">
          <div>
            <Label>Your Name</Label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm mt-1"
            >
              {owners.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Rating: {rating}/10</Label>
            <input
              type="range"
              min={1}
              max={10}
              value={rating}
              onChange={(e) => setRating(parseInt(e.target.value, 10))}
              className="w-full mt-1"
            />
          </div>
          <Button size="sm" onClick={handleSaveRating} disabled={isPending}>
            Save Rating
          </Button>
        </div>
      )}

      {!readOnly && (
        <Button variant="destructive" onClick={handleEnd} disabled={isPending} className="mt-2">
          End Meeting
        </Button>
      )}

      {readOnly && (
        <p className="text-sm text-green-600 font-medium">This meeting has been completed.</p>
      )}
    </div>
  );
}
