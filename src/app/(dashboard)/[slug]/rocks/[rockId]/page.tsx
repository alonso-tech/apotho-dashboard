import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { RockTodoList } from "@/components/rocks/rock-todo-list";
import { RockHeader } from "@/components/rocks/rock-header";
import { RockNotes } from "@/components/rocks/rock-notes";
import { RockMilestones } from "@/components/rocks/rock-milestones";
import { GanttChart } from "@/components/rocks/gantt-chart";
import { DeleteRockButton } from "@/components/rocks/delete-rock-button";

export default async function RockDetailPage({
  params,
  searchParams,
}: {
  params: { slug: string; rockId: string };
  searchParams: { from?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return notFound();

  const business = await prisma.business.findUnique({
    where: { slug: params.slug },
  });
  if (!business) return notFound();

  const rock = await prisma.rock.findUnique({
    where: { id: params.rockId },
    include: {
      owner: true,
      owners: { select: { id: true, name: true } },
      integrator: true,
      todos: {
        include: { owner: true },
        orderBy: { createdAt: "asc" },
      },
      notes: {
        include: { author: true, attachments: true },
        orderBy: { createdAt: "desc" },
      },
      milestones: {
        orderBy: { startDate: "asc" },
        include: {
          todos: { select: { id: true } },
          owner: { select: { id: true, name: true } },
        },
      },
    },
  });
  if (!rock || rock.businessId !== business.id) return notFound();

  const [users, allBusinesses] = await Promise.all([
    prisma.user.findMany({ orderBy: { name: "asc" } }),
    prisma.business.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, slug: true } }),
  ]);

  const activeTodos = rock.todos.filter((t) => !t.killed);
  const completedTodos = activeTodos.filter((t) => t.done).length;
  const totalTodos = activeTodos.length;
  const progress = totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;
  const completedMilestones = rock.milestones.filter((m) => m.done).length;
  const milestoneProgress = rock.milestones.length > 0 ? Math.round((completedMilestones / rock.milestones.length) * 100) : 0;

  const targetDateStr = rock.targetCompletionDate
    ? rock.targetCompletionDate.toISOString().split("T")[0]
    : null;

  const backHref = searchParams.from === "integrator" ? "/integrator" : `/${params.slug}/rocks`;

  // Build Gantt todo data (include killed todos so they show as red)
  const ganttTodos = rock.todos
    .filter((t) => t.startDate && t.endDate)
    .map((t) => ({
      id: t.id,
      title: t.title,
      startDate: t.startDate!.toISOString(),
      endDate: t.endDate!.toISOString(),
      done: t.done,
      killed: t.killed,
      milestoneId: t.milestoneId,
    }));

  const milestoneData = rock.milestones.map((m) => ({
    id: m.id,
    title: m.title,
    startDate: m.startDate.toISOString(),
    endDate: m.endDate.toISOString(),
    done: m.done,
    todoCount: m.todos.length,
    ownerId: m.ownerId ?? null,
    ownerName: m.owner?.name ?? null,
  }));

  // Computed values for stat cards
  const overallPct = totalTodos + rock.milestones.length > 0
    ? Math.round(((completedTodos + completedMilestones) / (totalTodos + rock.milestones.length)) * 100)
    : 0;
  const daysRemaining = targetDateStr
    ? Math.ceil((new Date(targetDateStr + "T00:00:00").getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;
  const isOverdue = daysRemaining !== null && daysRemaining < 0;

  return (
    <div className="flex flex-col gap-8 animate-fade-in-up">
      {/* ── Back nav ──────────────────────────────────────────── */}
      <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit">
        <ArrowLeftIcon className="h-4 w-4" />
        {searchParams.from === "integrator" ? "Integrator Board" : "Rocks"}
      </Link>

      {/* ── Hero header area with subtle gradient backdrop ──── */}
      <div className="rounded-2xl border bg-gradient-to-br from-card via-card to-muted/40 p-6 shadow-sm">
        <RockHeader
          rockId={rock.id}
          initialTitle={rock.title}
          initialStatus={rock.status}
          initialDescription={rock.description || ""}
          initialTargetDate={targetDateStr}
          initialOwnerIds={rock.owners.map((o) => o.id)}
          initialQuarter={rock.quarter}
          initialYear={rock.year}
          initialBusinessId={rock.businessId}
          integratorName={rock.integrator?.name || null}
          users={users.map((u) => ({ id: u.id, name: u.name }))}
          businesses={allBusinesses}
          done={rock.done}
        />
      </div>

      {/* ── Stats row ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-xl border-l-4 border-l-green-500 border bg-gradient-to-br from-card to-green-500/5 p-4 shadow-sm">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">To-Dos</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums">{completedTodos}<span className="text-muted-foreground font-normal">/{totalTodos}</span></span>
          </div>
          {totalTodos > 0 && (
            <div className="w-full h-1.5 bg-green-500/15 rounded-full mt-2.5 overflow-hidden">
              <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          )}
        </div>
        <div className="rounded-xl border-l-4 border-l-blue-500 border bg-gradient-to-br from-card to-blue-500/5 p-4 shadow-sm">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Milestones</p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold tabular-nums">{completedMilestones}<span className="text-muted-foreground font-normal">/{rock.milestones.length}</span></span>
          </div>
          {rock.milestones.length > 0 && (
            <div className="w-full h-1.5 bg-blue-500/15 rounded-full mt-2.5 overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${milestoneProgress}%` }} />
            </div>
          )}
        </div>
        <div className={`rounded-xl border-l-4 border bg-gradient-to-br from-card p-4 shadow-sm ${
          isOverdue ? "border-l-red-500 to-red-500/5" : "border-l-amber-500 to-amber-500/5"
        }`}>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Target Date</p>
          <span className="text-2xl font-bold tabular-nums">
            {targetDateStr
              ? new Date(targetDateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })
              : "—"}
          </span>
          {daysRemaining !== null && (
            <p className={`text-[11px] mt-1 font-medium ${isOverdue ? "text-red-600" : "text-muted-foreground"}`}>
              {isOverdue ? `${Math.abs(daysRemaining)}d overdue` : `${daysRemaining}d remaining`}
            </p>
          )}
        </div>
        <div className={`rounded-xl border-l-4 border bg-gradient-to-br from-card p-4 shadow-sm ${
          overallPct === 100 ? "border-l-green-500 to-green-500/5" : "border-l-primary to-primary/5"
        }`}>
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1">Overall</p>
          <span className="text-2xl font-bold tabular-nums">{overallPct}%</span>
          <p className="text-[11px] text-muted-foreground mt-1">
            {completedTodos + completedMilestones}/{totalTodos + rock.milestones.length} items done
          </p>
        </div>
      </div>

      {/* ── Gantt Timeline ─────────────────────────────────────── */}
      {(rock.milestones.length > 0 || ganttTodos.length > 0) && (
        <div className="rounded-xl border bg-gradient-to-br from-card to-muted/30 overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b bg-muted/20">
            <h2 className="text-sm font-semibold">Timeline</h2>
          </div>
          <div className="p-6 overflow-x-auto">
            <GanttChart
              milestones={milestoneData.map((m) => ({
                id: m.id,
                title: m.title,
                startDate: m.startDate,
                endDate: m.endDate,
                done: m.done,
              }))}
              todos={ganttTodos}
              targetCompletionDate={targetDateStr}
            />
          </div>
        </div>
      )}

      {/* ── Milestones + To-Dos side by side on large screens ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Milestones */}
        <div className="rounded-xl border bg-gradient-to-br from-card to-blue-500/[0.03] overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b bg-muted/20 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">Milestones</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Key dates and deliverables</p>
            </div>
            {rock.milestones.length > 0 && (
              <span className="text-xs font-medium bg-blue-500/10 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">{completedMilestones}/{rock.milestones.length}</span>
            )}
          </div>
          <div className="p-6">
            <RockMilestones
              rockId={rock.id}
              milestones={milestoneData.map((m) => ({
                id: m.id,
                title: m.title,
                startDate: m.startDate.split("T")[0],
                endDate: m.endDate.split("T")[0],
                done: m.done,
                todoCount: m.todoCount,
                ownerId: m.ownerId,
                ownerName: m.ownerName,
              }))}
              users={users.map((u) => ({ id: u.id, name: u.name }))}
            />
          </div>
        </div>

        {/* To-Dos */}
        <div className="rounded-xl border bg-gradient-to-br from-card to-green-500/[0.03] overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b bg-muted/20 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold">To-Dos</h2>
              <p className="text-[11px] text-muted-foreground mt-0.5">Tasks to complete this rock</p>
            </div>
            {totalTodos > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium bg-green-500/10 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">{completedTodos}/{totalTodos}</span>
                <div className="w-16 h-1.5 bg-green-500/15 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
          </div>
          <div className="p-6">
            <RockTodoList
              todos={rock.todos.map((t) => ({
                id: t.id,
                title: t.title,
                done: t.done,
                killed: t.killed,
                ownerName: t.owner.name,
                ownerId: t.ownerId,
                dueDate: t.dueDate?.toISOString() || null,
                milestoneId: t.milestoneId,
                startDate: t.startDate ? t.startDate.toISOString().split("T")[0] : null,
                endDate: t.endDate ? t.endDate.toISOString().split("T")[0] : null,
              }))}
              rockId={rock.id}
              businessId={business.id}
              users={users.map((u) => ({ id: u.id, name: u.name }))}
              currentUserId={session.user.id}
              milestones={rock.milestones.map((m) => ({
                id: m.id,
                title: m.title,
              }))}
            />
          </div>
        </div>
      </div>

      {/* ── Notes ──────────────────────────────────────────────── */}
      <div className="rounded-xl border bg-gradient-to-br from-card to-amber-500/[0.03] overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b bg-muted/20">
          <h2 className="text-sm font-semibold">Notes & Actions</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">Track actions being taken to complete this rock</p>
        </div>
        <div className="p-6">
          <RockNotes
            rockId={rock.id}
            notes={rock.notes.map((n) => ({
              id: n.id,
              content: n.content,
              authorName: n.author.name,
              createdAt: n.createdAt.toISOString(),
              attachments: n.attachments.map((a) => ({
                id: a.id,
                fileName: a.fileName,
                fileUrl: a.fileUrl,
                fileSize: a.fileSize,
                fileType: a.fileType,
              })),
            }))}
            users={users.map((u) => ({ id: u.id, name: u.name }))}
          />
        </div>
      </div>

      {/* ── Danger zone ────────────────────────────────────────── */}
      <div className="flex justify-end pb-8">
        <DeleteRockButton rockId={rock.id} backHref={backHref} />
      </div>
    </div>
  );
}
