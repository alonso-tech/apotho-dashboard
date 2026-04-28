"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  addRockMilestone,
  toggleRockMilestone,
  deleteRockMilestone,
  updateRockMilestone,
} from "@/app/actions/rocks";
import {
  CheckCircle2Icon,
  CircleIcon,
  TrashIcon,
  PlusIcon,
  PencilIcon,
  CheckIcon,
  XIcon,
} from "lucide-react";

type Milestone = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  done: boolean;
  todoCount: number;
  ownerId: string | null;
  ownerName: string | null;
};

type UserOption = { id: string; name: string };

export function RockMilestones({
  rockId,
  milestones,
  users,
}: {
  rockId: string;
  milestones: Milestone[];
  users: UserOption[];
}) {
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [adding, setAdding] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Inline editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editStartDate, setEditStartDate] = useState("");
  const [editEndDate, setEditEndDate] = useState("");
  const [editOwnerId, setEditOwnerId] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !startDate || !endDate) return;
    setAdding(true);
    const fd = new FormData();
    fd.set("rockId", rockId);
    fd.set("title", title.trim());
    fd.set("startDate", startDate);
    fd.set("endDate", endDate);
    if (ownerId) fd.set("ownerId", ownerId);
    await addRockMilestone(fd);
    setTitle("");
    setStartDate("");
    setEndDate("");
    setOwnerId("");
    setAdding(false);
    setShowForm(false);
  }

  function startEdit(m: Milestone) {
    setEditingId(m.id);
    setEditTitle(m.title);
    setEditStartDate(m.startDate);
    setEditEndDate(m.endDate);
    setEditOwnerId(m.ownerId || "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(milestoneId: string) {
    if (!editTitle.trim() || !editStartDate || !editEndDate) return;
    setSaving(true);
    await updateRockMilestone(milestoneId, {
      title: editTitle,
      startDate: editStartDate,
      endDate: editEndDate,
      ownerId: editOwnerId || null,
    });
    setEditingId(null);
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-2">
      {milestones.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground py-2">
          No milestones yet. Add key dates to build a timeline.
        </p>
      )}

      {milestones.map((m) => (
        <div key={m.id} className="rounded-lg border group hover:bg-muted/30 transition-colors">
          {editingId === m.id ? (
            /* Edit mode */
            <div className="px-3 py-2.5 flex flex-col gap-2">
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="h-8 text-sm font-medium"
                autoFocus
              />
              <div className="flex gap-2">
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-[11px] text-muted-foreground">Start</label>
                  <Input
                    type="date"
                    value={editStartDate}
                    onChange={(e) => setEditStartDate(e.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-[11px] text-muted-foreground">End</label>
                  <Input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    className="h-8"
                  />
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <label className="text-[11px] text-muted-foreground">Owner</label>
                  <select
                    value={editOwnerId}
                    onChange={(e) => setEditOwnerId(e.target.value)}
                    className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
                  >
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => saveEdit(m.id)}
                  disabled={saving || !editTitle.trim() || !editStartDate || !editEndDate}
                  className="text-green-600 hover:text-green-700 disabled:opacity-50"
                >
                  <CheckIcon className="h-4 w-4" />
                </button>
                <button onClick={cancelEdit} className="text-muted-foreground hover:text-foreground">
                  <XIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Display mode */
            <div className="flex items-center gap-2.5 px-3 py-2.5">
              <button onClick={() => toggleRockMilestone(m.id)} className="shrink-0">
                {m.done ? (
                  <CheckCircle2Icon className="h-4.5 w-4.5 text-green-600" />
                ) : (
                  <CircleIcon className="h-4.5 w-4.5 text-muted-foreground hover:text-foreground" />
                )}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${m.done ? "line-through text-muted-foreground" : ""}`}>
                    {m.title}
                  </span>
                  <button
                    onClick={() => startEdit(m)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                  >
                    <PencilIcon className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                  </button>
                  {m.todoCount > 0 && (
                    <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                      {m.todoCount} to-do{m.todoCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">
                    {new Date(m.startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    {" → "}
                    {new Date(m.endDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </span>
                  {m.ownerName && (
                    <span className="text-xs text-muted-foreground">
                      · {m.ownerName}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => deleteRockMilestone(m.id)}
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
              >
                <TrashIcon className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          )}
        </div>
      ))}

      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground pt-2 border-t"
        >
          <PlusIcon className="h-4 w-4" /> Add milestone
        </button>
      ) : (
        <form onSubmit={handleAdd} className="flex flex-col gap-2 pt-2 border-t">
          <Input
            placeholder="Milestone name..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-8"
            autoFocus
          />
          <div className="flex gap-2">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[11px] text-muted-foreground">Start</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[11px] text-muted-foreground">End</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-8"
              />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-[11px] text-muted-foreground">Owner</label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
              >
                <option value="">Unassigned</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={adding || !title.trim() || !startDate || !endDate}>
              {adding ? "..." : "Add Milestone"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
