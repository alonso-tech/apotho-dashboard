"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createTodo,
  toggleTodo,
  deleteTodo,
  killTodo,
  reviveTodo,
  updateTodoOwner,
  updateTodoTitle,
  updateTodoDates,
  updateTodoMilestone,
} from "@/app/actions/todos";
import {
  CheckCircle2Icon,
  CircleIcon,
  TrashIcon,
  PlusIcon,
  PencilIcon,
  CheckIcon,
  XIcon,
  CalendarIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  BanIcon,
  RotateCcwIcon,
} from "lucide-react";

type TodoItem = {
  id: string;
  title: string;
  done: boolean;
  killed: boolean;
  ownerName: string;
  ownerId: string;
  dueDate: string | null;
  milestoneId: string | null;
  startDate: string | null;
  endDate: string | null;
};

type MilestoneRef = {
  id: string;
  title: string;
};

export function RockTodoList({
  todos,
  rockId,
  businessId,
  users,
  currentUserId,
  milestones,
}: {
  todos: TodoItem[];
  rockId: string;
  businessId: string;
  users: { id: string; name: string }[];
  currentUserId: string;
  milestones: MilestoneRef[];
}) {
  const [newTitle, setNewTitle] = useState("");
  const [newOwnerId, setNewOwnerId] = useState(currentUserId);
  const [newMilestoneId, setNewMilestoneId] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [showDates, setShowDates] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editingDatesId, setEditingDatesId] = useState<string | null>(null);
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [showKilled, setShowKilled] = useState(false);

  // Scroll to and highlight a todo when navigating via #todo-{id}
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.startsWith("#todo-")) return;
    const targetId = hash.slice(1); // "todo-{id}"
    const el = document.getElementById(targetId);
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightId(targetId);
        setTimeout(() => setHighlightId(null), 2000);
      }, 300);
    }
  }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    setAdding(true);
    const fd = new FormData();
    fd.set("title", newTitle.trim());
    fd.set("businessId", businessId);
    fd.set("ownerId", newOwnerId);
    fd.set("rockId", rockId);
    if (newMilestoneId) fd.set("milestoneId", newMilestoneId);
    if (newStartDate) fd.set("startDate", newStartDate);
    if (newEndDate) fd.set("endDate", newEndDate);
    await createTodo(fd);
    setNewTitle("");
    setNewStartDate("");
    setNewEndDate("");
    setAdding(false);
  }

  function startEditing(todo: TodoItem) {
    setEditingId(todo.id);
    setEditTitle(todo.title);
  }

  async function saveEdit(todoId: string) {
    if (!editTitle.trim()) return;
    await updateTodoTitle(todoId, editTitle.trim());
    setEditingId(null);
    setEditTitle("");
  }

  function startEditingDates(todo: TodoItem) {
    setEditingDatesId(todo.id);
    setEditStartDate(todo.startDate || "");
    setEditEndDate(todo.endDate || "");
  }

  async function saveDates(todoId: string) {
    await updateTodoDates(todoId, editStartDate || null, editEndDate || null);
    setEditingDatesId(null);
  }

  function toggleGroup(key: string) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Split active vs killed
  const activeTodos = todos.filter((t) => !t.killed);
  const killedTodos = todos.filter((t) => t.killed);

  // Group active todos by milestone
  const grouped: { key: string; label: string; items: TodoItem[] }[] = [];
  const byMilestone: Record<string, TodoItem[]> = {};
  const unlinked: TodoItem[] = [];

  for (const todo of activeTodos) {
    if (todo.milestoneId) {
      (byMilestone[todo.milestoneId] ??= []).push(todo);
    } else {
      unlinked.push(todo);
    }
  }

  for (const m of milestones) {
    if (byMilestone[m.id]) {
      grouped.push({ key: m.id, label: m.title, items: byMilestone[m.id] });
    }
  }
  if (unlinked.length > 0 || grouped.length === 0) {
    grouped.push({ key: "__unlinked", label: milestones.length > 0 ? "Other Tasks" : "", items: unlinked });
  }

  function renderTodo(todo: TodoItem) {
    return (
      <div
        key={todo.id}
        id={`todo-${todo.id}`}
        className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 group hover:bg-muted/30 transition-all scroll-mt-24 ${
          highlightId === `todo-${todo.id}` ? "ring-2 ring-primary bg-primary/5" : ""
        }`}
      >
        <button onClick={() => toggleTodo(todo.id)} className="shrink-0 mt-0.5">
          {todo.done ? (
            <CheckCircle2Icon className="h-4.5 w-4.5 text-green-600" />
          ) : (
            <CircleIcon className="h-4.5 w-4.5 text-muted-foreground hover:text-foreground" />
          )}
        </button>
        <div className="flex-1 min-w-0">
          {editingId === todo.id ? (
            <div className="flex items-center gap-1.5">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveEdit(todo.id);
                  if (e.key === "Escape") { setEditingId(null); setEditTitle(""); }
                }}
                className="h-7 text-sm"
                autoFocus
              />
              <button onClick={() => saveEdit(todo.id)} className="shrink-0 text-green-600 hover:text-green-700">
                <CheckIcon className="h-4 w-4" />
              </button>
              <button onClick={() => { setEditingId(null); setEditTitle(""); }} className="shrink-0 text-muted-foreground hover:text-foreground">
                <XIcon className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5">
                <span className={`text-sm ${todo.done ? "line-through text-muted-foreground" : ""}`}>
                  {todo.title}
                </span>
                <button
                  onClick={() => startEditing(todo)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  <PencilIcon className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                </button>
              </div>
              {/* Date range display */}
              {editingDatesId === todo.id ? (
                <div className="flex items-center gap-1.5">
                  <Input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)} className="h-6 text-xs w-[120px]" />
                  <span className="text-xs text-muted-foreground">&rarr;</span>
                  <Input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)} className="h-6 text-xs w-[120px]" />
                  <button onClick={() => saveDates(todo.id)} className="text-green-600 hover:text-green-700">
                    <CheckIcon className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => setEditingDatesId(null)} className="text-muted-foreground hover:text-foreground">
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  {todo.startDate && todo.endDate ? (
                    <button
                      onClick={() => startEditingDates(todo)}
                      className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <CalendarIcon className="h-3 w-3" />
                      {new Date(todo.startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      {" → "}
                      {new Date(todo.endDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </button>
                  ) : (
                    <button
                      onClick={() => startEditingDates(todo)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      <CalendarIcon className="h-3 w-3" />
                      Add dates
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Milestone assignment */}
          {milestones.length > 0 && (
            <select
              value={todo.milestoneId || ""}
              onChange={(e) => updateTodoMilestone(todo.id, e.target.value || null)}
              className="h-6 rounded border border-input bg-transparent px-1 text-[11px] max-w-[100px] opacity-0 group-hover:opacity-100 transition-opacity"
              title="Assign to milestone"
            >
              <option value="">No milestone</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>{m.title}</option>
              ))}
            </select>
          )}
          <select
            value={todo.ownerId}
            onChange={(e) => updateTodoOwner(todo.id, e.target.value)}
            className="h-6 rounded border border-input bg-transparent px-1 text-[11px]"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <button
            onClick={() => killTodo(todo.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            title="Kill to-do"
          >
            <BanIcon className="h-3.5 w-3.5 text-muted-foreground hover:text-red-500" />
          </button>
          <button
            onClick={() => deleteTodo(todo.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete to-do"
          >
            <TrashIcon className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      </div>
    );
  }

  function renderKilledTodo(todo: TodoItem) {
    return (
      <div
        key={todo.id}
        className="flex items-center gap-2.5 rounded-lg border border-red-200/50 dark:border-red-900/30 px-3 py-2 group bg-red-50/50 dark:bg-red-950/10"
      >
        <BanIcon className="h-4 w-4 text-red-400 shrink-0" />
        <span className="flex-1 text-sm line-through text-muted-foreground">{todo.title}</span>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => reviveTodo(todo.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            title="Revive to-do"
          >
            <RotateCcwIcon className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
          <button
            onClick={() => deleteTodo(todo.id)}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete to-do"
          >
            <TrashIcon className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {activeTodos.length === 0 && killedTodos.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">No to-dos yet. Add one below.</p>
      )}

      {grouped.map((group) => (
        <div key={group.key} className="flex flex-col gap-1.5">
          {group.label && (
            <button
              onClick={() => toggleGroup(group.key)}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground py-1"
            >
              {collapsedGroups.has(group.key) ? (
                <ChevronRightIcon className="h-3.5 w-3.5" />
              ) : (
                <ChevronDownIcon className="h-3.5 w-3.5" />
              )}
              {group.label}
              <span className="text-[11px] font-normal">
                ({group.items.filter((t) => t.done).length}/{group.items.length})
              </span>
            </button>
          )}
          {!collapsedGroups.has(group.key) &&
            group.items.map((todo) => renderTodo(todo))
          }
        </div>
      ))}

      {/* Killed todos section */}
      {killedTodos.length > 0 && (
        <div className="flex flex-col gap-1.5 mt-2 pt-3 border-t border-dashed">
          <button
            onClick={() => setShowKilled(!showKilled)}
            className="flex items-center gap-1.5 text-xs font-semibold text-red-500/70 hover:text-red-500 py-1"
          >
            {showKilled ? (
              <ChevronDownIcon className="h-3.5 w-3.5" />
            ) : (
              <ChevronRightIcon className="h-3.5 w-3.5" />
            )}
            <BanIcon className="h-3 w-3" />
            Killed ({killedTodos.length})
          </button>
          {showKilled && killedTodos.map((todo) => renderKilledTodo(todo))}
        </div>
      )}

      {/* Add todo form */}
      <form onSubmit={handleAdd} className="flex flex-col gap-2 mt-2 pt-3 border-t">
        <div className="flex items-center gap-2">
          <PlusIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <Input
            placeholder="Add a to-do..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="flex-1 h-8 text-sm"
          />
          <select
            value={newOwnerId}
            onChange={(e) => setNewOwnerId(e.target.value)}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
          >
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
          <Button type="submit" size="sm" disabled={adding || !newTitle.trim()}>
            {adding ? "..." : "Add"}
          </Button>
        </div>

        <div className="flex items-center gap-2 ml-6">
          {milestones.length > 0 && (
            <select
              value={newMilestoneId}
              onChange={(e) => setNewMilestoneId(e.target.value)}
              className="h-7 rounded-md border border-input bg-transparent px-2 text-xs flex-1"
            >
              <option value="">No milestone</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>{m.title}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={() => setShowDates(!showDates)}
            className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border transition-colors ${
              showDates ? "border-primary/30 bg-primary/5 text-primary" : "border-input text-muted-foreground hover:text-foreground"
            }`}
          >
            <CalendarIcon className="h-3 w-3" />
            Dates
          </button>
        </div>

        {showDates && (
          <div className="flex items-center gap-2 ml-6">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[11px] text-muted-foreground">Start</label>
              <Input
                type="date"
                value={newStartDate}
                onChange={(e) => setNewStartDate(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[11px] text-muted-foreground">End</label>
              <Input
                type="date"
                value={newEndDate}
                onChange={(e) => setNewEndDate(e.target.value)}
                className="h-7 text-xs"
              />
            </div>
          </div>
        )}
      </form>
    </div>
  );
}
