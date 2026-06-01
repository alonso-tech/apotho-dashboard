"use client";

import { useState, useTransition } from "react";
import { saveSegue, addIssue, resolveIssue, saveRating, endMeeting } from "@/app/actions/meetings";
import { toggleRock } from "@/app/actions/rocks";
import { createTodo, toggleTodo, updateTodoRock, updateTodoOwner, killTodo } from "@/app/actions/todos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2Icon, CircleIcon, CheckSquareIcon, SquareIcon, ChevronRightIcon, ChevronLeftIcon, ArrowRightIcon, BanIcon, ListPlusIcon } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MeetingData {
  id: string;
  businessId: string;
  endedAt: string | null;
  segues: Array<{ id: string; userId: string; userName: string; personal: string; professional: string }>;
  issues: Array<{ id: string; title: string; notes: string; resolved: boolean; meetingId: string }>;
  ratings: Array<{ id: string; userId: string; userName: string; rating: number }>;
  todos: Array<{ id: string; title: string; done: boolean; ownerName: string; ownerId: string; rockId: string | null }>;
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
  goalDirection: string;
  entries: Array<{ weekOf: string; actual: string; onTrack: boolean }>;
}

interface Owner {
  id: string;
  name: string;
}

type TodoItem = { id: string; title: string; done: boolean; ownerName: string; ownerId: string; rockId: string | null };
type IssueItem = { id: string; title: string; notes: string; resolved: boolean; meetingId: string };

interface MeetingRunnerProps {
  meeting: MeetingData;
  rocks: RockData[];
  measurables: MeasurableData[];
  scorecardWeeks: string[];
  previousTodos: TodoItem[];
  previousIssues: IssueItem[];
  owners: Owner[];
  businessSlug: string;
}

const SECTIONS = [
  { id: 0, label: "Segue" },
  { id: 1, label: "Scorecard" },
  { id: 2, label: "Previous To-Dos" },
  { id: 3, label: "Rocks Review" },
  { id: 4, label: "Issues (IDS)" },
  { id: 5, label: "New To-Dos" },
  { id: 6, label: "Conclude" },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export function MeetingRunner({ meeting, rocks, measurables, scorecardWeeks, previousTodos, previousIssues, owners, businessSlug }: MeetingRunnerProps) {
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
            <ScorecardSection measurables={measurables} weeks={scorecardWeeks} />
          )}
          {section === 2 && (
            <PreviousTodosSection todos={previousTodos} rocks={rocks} meeting={meeting} owners={owners} />
          )}
          {section === 3 && (
            <RocksSection rocks={rocks} readOnly={isCompleted} />
          )}
          {section === 4 && (
            <IssuesSection meeting={meeting} previousIssues={previousIssues} owners={owners} readOnly={isCompleted} />
          )}
          {section === 5 && (
            <TodosSection meeting={meeting} owners={owners} rocks={rocks} readOnly={isCompleted} />
          )}
          {section === 6 && (
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

function formatWeekLabel(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

function checkOnTrack(actual: number, goal: number, dir: string): boolean {
  switch (dir) {
    case "gte": return actual >= goal;
    case "lte": return actual <= goal;
    case "gt":  return actual > goal;
    case "lt":  return actual < goal;
    case "eq":  return actual === goal;
    default:    return actual >= goal;
  }
}

function ScorecardSection({ measurables, weeks }: { measurables: MeasurableData[]; weeks: string[] }) {
  const now = new Date();
  const todayTime = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());

  function getEntry(m: MeasurableData, weekIso: string) {
    const weekKey = weekIso.split("T")[0];
    return m.entries.find((e) => e.weekOf.split("T")[0] === weekKey) ?? null;
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground mb-2">Review KPIs against targets.</p>
      {measurables.length === 0 && (
        <p className="text-sm text-muted-foreground">No measurables configured for this business.</p>
      )}
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left py-2 px-3 font-medium min-w-[160px] sticky left-0 bg-muted/50 z-10">Measurable</th>
              <th className="text-right py-2 px-3 font-medium sticky left-[160px] bg-muted/50 z-10">Goal</th>
              {weeks.map((w) => {
                const wDate = new Date(w);
                const isCurrentWeek = todayTime >= wDate.getTime() && todayTime < wDate.getTime() + 7 * 86400000;
                return (
                  <th key={w} className={`text-center py-2 px-2 font-medium min-w-[56px] ${isCurrentWeek ? "bg-primary/10" : ""}`}>
                    {formatWeekLabel(w)}
                  </th>
                );
              })}
              <th className="text-center py-2 px-2 font-medium min-w-[64px] bg-muted/70 border-l">Avg</th>
            </tr>
          </thead>
          <tbody>
            {measurables.map((m) => (
              <tr key={m.id} className="border-b last:border-0 hover:bg-muted/20">
                <td className="py-2 px-3 sticky left-0 bg-card z-10">
                  <span className="font-medium">{m.name}</span>
                  {m.unit && <span className="text-xs text-muted-foreground ml-1">({m.unit})</span>}
                </td>
                <td className="text-right py-2 px-3 sticky left-[160px] bg-card z-10 text-muted-foreground">{m.goal}</td>
                {weeks.map((w) => {
                  const entry = getEntry(m, w);
                  const wDate = new Date(w);
                  const isCurrentWeek = todayTime >= wDate.getTime() && todayTime < wDate.getTime() + 7 * 86400000;
                  return (
                    <td key={w} className={`text-center py-1 px-1 ${isCurrentWeek ? "bg-primary/5" : ""}`}>
                      <span className={`inline-block w-full h-8 leading-8 rounded px-1 text-xs font-medium ${
                        entry
                          ? entry.onTrack
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                          : "text-muted-foreground"
                      }`}>
                        {entry?.actual ?? "—"}
                      </span>
                    </td>
                  );
                })}
                <td className="text-center py-1 px-1 bg-muted/30 border-l">
                  {(() => {
                    const vals = weeks.map((w) => getEntry(m, w)).filter((e) => e != null).map((e) => parseFloat(e!.actual)).filter((v) => !isNaN(v));
                    if (vals.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
                    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
                    const goalNum = parseFloat(m.goal.replace(/,/g, ""));
                    const onTrack = !isNaN(goalNum) ? checkOnTrack(avg, goalNum, m.goalDirection) : false;
                    const formatted = avg >= 1000 ? Math.round(avg).toLocaleString() : avg % 1 === 0 ? String(avg) : avg.toFixed(1);
                    return (
                      <span className={`inline-block w-full h-8 leading-8 rounded px-1 text-xs font-semibold ${onTrack ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {formatted}
                      </span>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Section: Previous To-Dos ─────────────────────────────────────────────────

function PreviousTodosSection({ todos, rocks, meeting, owners }: { todos: TodoItem[]; rocks: RockData[]; meeting: MeetingData; owners: Owner[] }) {
  const [isPending, startTransition] = useTransition();

  function handleToggle(todoId: string) {
    startTransition(() => toggleTodo(todoId));
  }

  function handlePush(todo: TodoItem) {
    // Create a new to-do in this meeting from the previous one
    const fd = new FormData();
    fd.append("title", todo.title);
    fd.append("businessId", meeting.businessId);
    fd.append("meetingId", meeting.id);
    fd.append("ownerId", todo.ownerId);
    startTransition(() => createTodo(fd));
  }

  function handleKill(todoId: string) {
    startTransition(() => killTodo(todoId));
  }

  function handleRockChange(todoId: string, rockId: string) {
    startTransition(() => updateTodoRock(todoId, rockId || null));
  }

  function handleOwnerChange(todoId: string, newOwnerId: string) {
    startTransition(() => updateTodoOwner(todoId, newOwnerId));
  }

  if (todos.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">No to-dos from the previous meeting.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Review to-dos from the previous meeting. <strong>Done</strong> = mark complete, <strong>Push</strong> = carry to new to-dos, <strong>Kill</strong> = move to issues.</p>

      {todos.map((todo) => (
        <div key={todo.id} className={`flex items-center gap-2 rounded-lg border p-3 ${todo.done ? "bg-muted/50" : ""}`}>
          <button onClick={() => handleToggle(todo.id)} disabled={isPending} className="shrink-0 disabled:opacity-50" title="Done">
            {todo.done ? <CheckSquareIcon className="h-5 w-5 text-green-500" /> : <SquareIcon className="h-5 w-5 text-muted-foreground" />}
          </button>
          <div className="flex-1 min-w-0">
            <p className={`text-sm ${todo.done ? "line-through text-muted-foreground" : ""}`}>{todo.title}</p>
            <p className="text-xs text-muted-foreground">{todo.ownerName}</p>
          </div>
          <select
            value={todo.ownerId}
            onChange={(e) => handleOwnerChange(todo.id, e.target.value)}
            disabled={isPending}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm max-w-[120px] disabled:opacity-50"
          >
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select
            value={todo.rockId ?? ""}
            onChange={(e) => handleRockChange(todo.id, e.target.value)}
            disabled={isPending}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm max-w-[150px] disabled:opacity-50"
          >
            <option value="">No rock</option>
            {rocks.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
          {!todo.done && (
            <>
              <Button size="sm" variant="outline" onClick={() => handlePush(todo)} disabled={isPending} title="Push to new to-dos" className="h-8 px-2">
                <ArrowRightIcon className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" variant="outline" onClick={() => handleKill(todo.id)} disabled={isPending} title="Kill — move to issues" className="h-8 px-2 text-red-500 hover:text-red-600">
                <BanIcon className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      ))}
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

function IssuesSection({ meeting, previousIssues, owners, readOnly }: { meeting: MeetingData; previousIssues: IssueItem[]; owners: Owner[]; readOnly: boolean }) {
  const [isPending, startTransition] = useTransition();
  const [newIssue, setNewIssue] = useState("");
  const [resolveNotes, setResolveNotes] = useState<Record<string, string>>({});

  // Combine previous unresolved issues with current meeting issues
  const previousUnresolved = previousIssues.filter((i) => !i.resolved && !meeting.issues.some((mi) => mi.title === i.title));
  const allIssues = [...meeting.issues];

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

  function handlePushToTodo(issueTitle: string, ownerId: string) {
    const fd = new FormData();
    fd.append("title", issueTitle);
    fd.append("businessId", meeting.businessId);
    fd.append("meetingId", meeting.id);
    fd.append("ownerId", ownerId);
    startTransition(() => createTodo(fd));
  }

  // Carry over a previous issue into this meeting
  function handleCarryIssue(issue: IssueItem) {
    const fd = new FormData();
    fd.append("meetingId", meeting.id);
    fd.append("title", issue.title);
    startTransition(() => addIssue(fd));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Identify, Discuss, Solve — add issues and resolve them.</p>

      {/* Previous unresolved issues */}
      {previousUnresolved.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-medium text-muted-foreground mb-1">Unresolved from previous meeting:</p>
          {previousUnresolved.map((issue) => (
            <div key={issue.id} className="flex items-center gap-2 rounded-lg border border-dashed border-orange-300 p-2 mb-1">
              <CircleIcon className="h-4 w-4 text-orange-400 shrink-0" />
              <p className="text-sm flex-1">{issue.title}</p>
              {!readOnly && (
                <Button size="sm" variant="outline" onClick={() => handleCarryIssue(issue)} disabled={isPending} className="h-7 text-xs">
                  Add to this meeting
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {allIssues.map((issue) => (
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
            {!issue.resolved && !readOnly && (
              <Button size="sm" variant="outline" onClick={() => handlePushToTodo(issue.title, owners[0]?.id)} disabled={isPending} title="Create to-do from this issue" className="h-8 px-2 shrink-0">
                <ListPlusIcon className="h-3.5 w-3.5" />
              </Button>
            )}
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

// ─── Section: New To-Dos ──────────────────────────────────────────────────────

function TodosSection({ meeting, owners, rocks, readOnly }: { meeting: MeetingData; owners: Owner[]; rocks: RockData[]; readOnly: boolean }) {
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

  function handleToggle(todoId: string) {
    startTransition(() => toggleTodo(todoId));
  }

  function handleRockChange(todoId: string, rockId: string) {
    startTransition(() => updateTodoRock(todoId, rockId || null));
  }

  function handleOwnerChange(todoId: string, newOwnerId: string) {
    startTransition(() => updateTodoOwner(todoId, newOwnerId));
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">Create 7-day action items from the meeting.</p>

      {meeting.todos.map((todo) => (
        <div key={todo.id} className={`flex items-center gap-2 rounded-lg border p-3 ${todo.done ? "bg-muted/50" : ""}`}>
          <button onClick={() => handleToggle(todo.id)} disabled={isPending} className="shrink-0 disabled:opacity-50">
            {todo.done ? <CheckSquareIcon className="h-5 w-5 text-green-500" /> : <SquareIcon className="h-5 w-5 text-muted-foreground" />}
          </button>
          <div className="flex-1 min-w-0">
            <p className={`text-sm ${todo.done ? "line-through text-muted-foreground" : ""}`}>{todo.title}</p>
            <p className="text-xs text-muted-foreground">{todo.ownerName}</p>
          </div>
          <select
            value={todo.ownerId}
            onChange={(e) => handleOwnerChange(todo.id, e.target.value)}
            disabled={isPending}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm max-w-[120px] disabled:opacity-50"
          >
            {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
          </select>
          <select
            value={todo.rockId ?? ""}
            onChange={(e) => handleRockChange(todo.id, e.target.value)}
            disabled={isPending}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs shadow-sm max-w-[150px] disabled:opacity-50"
          >
            <option value="">No rock</option>
            {rocks.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
          </select>
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
      <p className="text-sm text-muted-foreground">Rate the meeting 1–10 and end the session. Ending will email each person their to-dos.</p>

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
