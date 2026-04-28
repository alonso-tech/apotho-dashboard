import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { TodoToggle } from "@/components/todos/todo-toggle";
import { TargetIcon, MilestoneIcon } from "lucide-react";

interface SearchParams {
  filter?: string;
}

export default async function MyTodosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return null;

  const filter = searchParams.filter ?? "open";

  const todos = await prisma.todo.findMany({
    where: {
      ownerId: session.user.id,
      ...(filter === "open" ? { done: false } : filter === "done" ? { done: true } : {}),
    },
    include: {
      business: true,
      rock: { select: { id: true, title: true } },
      milestone: { select: { id: true, title: true } },
    },
    orderBy: [{ done: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });

  // Group by business, then by rock within each business
  const byBusiness = todos.reduce<Record<string, typeof todos>>((acc, todo) => {
    const key = todo.business.name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(todo);
    return acc;
  }, {});

  // Within each business, group by rock
  function groupByRock(bizTodos: typeof todos) {
    const rockGroups: { rockId: string | null; rockTitle: string | null; slug: string; todos: typeof todos }[] = [];
    const byRock: Record<string, typeof todos> = {};
    const noRock: typeof todos = [];

    for (const todo of bizTodos) {
      if (todo.rock) {
        const key = todo.rock.id;
        if (!byRock[key]) byRock[key] = [];
        byRock[key].push(todo);
      } else {
        noRock.push(todo);
      }
    }

    // Rocks first, then unlinked todos
    for (const [rockId, rockTodos] of Object.entries(byRock)) {
      const first = rockTodos[0];
      rockGroups.push({
        rockId,
        rockTitle: first.rock?.title ?? null,
        slug: first.business.slug,
        todos: rockTodos,
      });
    }

    if (noRock.length > 0) {
      rockGroups.push({
        rockId: null,
        rockTitle: null,
        slug: noRock[0].business.slug,
        todos: noRock,
      });
    }

    return rockGroups;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight gradient-text">My To-Dos</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {todos.filter((t) => !t.done).length} open items across all businesses
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["open", "done", "all"] as const).map((f) => (
          <Link
            key={f}
            href={`/my-todos?filter=${f}`}
            className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium border capitalize transition-colors ${
              f === filter
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-background hover:bg-accent border-input"
            }`}
          >
            {f}
          </Link>
        ))}
      </div>

      {todos.length === 0 && (
        <p className="text-sm text-muted-foreground py-4">No to-dos found.</p>
      )}

      {Object.entries(byBusiness).map(([bizName, bizTodos]) => (
        <div key={bizName}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            {bizName}
          </h2>
          <div className="flex flex-col gap-4">
            {groupByRock(bizTodos).map((group) => (
              <div key={group.rockId ?? "no-rock"} className="flex flex-col gap-1.5">
                {group.rockId ? (
                  <Link
                    href={`/${group.slug}/rocks/${group.rockId}`}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline mb-0.5"
                  >
                    <TargetIcon className="h-3 w-3" />
                    {group.rockTitle}
                  </Link>
                ) : (
                  <span className="text-xs font-medium text-muted-foreground mb-0.5">
                    Unlinked To-Dos
                  </span>
                )}
                {group.todos.map((todo) => {
                  const todoContent = (
                    <>
                      <TodoToggle todoId={todo.id} done={todo.done} />
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-medium ${todo.done ? "line-through text-muted-foreground" : ""}`}>
                          {todo.title}
                        </p>
                        {todo.milestone && (
                          <p className="text-[11px] text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                            <MilestoneIcon className="h-2.5 w-2.5" />
                            {todo.milestone.title}
                          </p>
                        )}
                      </div>
                      {todo.dueDate && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {new Date(todo.dueDate).toLocaleDateString()}
                        </span>
                      )}
                    </>
                  );
                  return todo.rock ? (
                    <Link
                      key={todo.id}
                      href={`/${todo.business.slug}/rocks/${todo.rock.id}#todo-${todo.id}`}
                      className={`flex items-start gap-3 rounded-lg border p-3 ml-4 transition-colors hover:border-primary/30 hover:bg-muted/30 ${
                        todo.done ? "bg-muted/50 opacity-70" : "bg-card"
                      }`}
                    >
                      {todoContent}
                    </Link>
                  ) : (
                    <div
                      key={todo.id}
                      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                        todo.done ? "bg-muted/50 opacity-70" : "bg-card"
                      }`}
                    >
                      {todoContent}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
