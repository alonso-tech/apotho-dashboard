"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { updateRockDetails, updateRockOwners, updateRockDescription } from "@/app/actions/rocks";
import {
  CheckCircleIcon,
  CircleIcon,
  PencilIcon,
  CheckIcon,
  XIcon,
  SaveIcon,
  UserIcon,
  BuildingIcon,
  CalendarIcon,
  TargetIcon,
} from "lucide-react";

const STATUS_OPTIONS = [
  { value: "not-started", label: "Not Started", dot: "bg-zinc-400", bg: "bg-zinc-100 dark:bg-zinc-800", text: "text-zinc-700 dark:text-zinc-300" },
  { value: "in-progress", label: "In Progress", dot: "bg-blue-500", bg: "bg-blue-50 dark:bg-blue-950", text: "text-blue-700 dark:text-blue-300" },
  { value: "at-risk", label: "At Risk", dot: "bg-red-500", bg: "bg-red-50 dark:bg-red-950", text: "text-red-700 dark:text-red-300" },
  { value: "complete", label: "Complete", dot: "bg-green-500", bg: "bg-green-50 dark:bg-green-950", text: "text-green-700 dark:text-green-300" },
];

interface Business { id: string; name: string; slug: string; }

export function RockHeader({
  rockId,
  initialTitle,
  initialStatus,
  initialDescription,
  initialTargetDate,
  initialOwnerIds,
  initialQuarter,
  initialYear,
  initialBusinessId,
  integratorName,
  users,
  businesses,
  done,
}: {
  rockId: string;
  initialTitle: string;
  initialStatus: string;
  initialDescription: string;
  initialTargetDate: string | null;
  initialOwnerIds: string[];
  initialQuarter: number;
  initialYear: number;
  initialBusinessId: string;
  integratorName: string | null;
  users: { id: string; name: string }[];
  businesses: Business[];
  done: boolean;
}) {
  const router = useRouter();

  // All editable state
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState(initialStatus);
  const [description, setDescription] = useState(initialDescription);
  const [targetDate, setTargetDate] = useState(initialTargetDate || "");
  const [ownerIds, setOwnerIds] = useState<string[]>(initialOwnerIds);
  const [quarter, setQuarter] = useState(initialQuarter);
  const [year, setYear] = useState(initialYear);
  const [businessId, setBusinessId] = useState(initialBusinessId);

  // Editing states
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  // Track what changed
  const isDirty =
    title !== initialTitle ||
    status !== initialStatus ||
    targetDate !== (initialTargetDate || "") ||
    quarter !== initialQuarter ||
    year !== initialYear ||
    businessId !== initialBusinessId ||
    ownerIds.length !== initialOwnerIds.length ||
    ownerIds.some((id) => !initialOwnerIds.includes(id));

  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const st = STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0];
  const statusRef = useRef<HTMLDivElement>(null);

  async function handleSave() {
    setSaving(true);

    const fd = new FormData();
    fd.set("rockId", rockId);
    fd.set("status", status);
    fd.set("targetCompletionDate", targetDate);
    fd.set("title", title);
    fd.set("quarter", String(quarter));
    fd.set("year", String(year));
    fd.set("businessId", businessId);
    await updateRockDetails(fd);

    // Update owners if changed
    const idsChanged =
      ownerIds.length !== initialOwnerIds.length ||
      ownerIds.some((id) => !initialOwnerIds.includes(id));
    if (idsChanged) {
      const ofd = new FormData();
      ofd.set("rockId", rockId);
      for (const id of ownerIds) ofd.append("ownerIds", id);
      await updateRockOwners(ofd);
    }

    // Update description if changed
    if (description !== initialDescription) {
      await updateRockDescription(rockId, description);
    }

    if (businessId !== initialBusinessId) {
      const newBiz = businesses.find((b) => b.id === businessId);
      if (newBiz) {
        router.push(`/${newBiz.slug}/rocks/${rockId}`);
        return;
      }
    }

    setSaving(false);
    router.refresh();
  }

  function addOwner(id: string) {
    if (!ownerIds.includes(id)) setOwnerIds([...ownerIds, id]);
  }

  function removeOwner(id: string) {
    if (ownerIds.length > 1) setOwnerIds(ownerIds.filter((o) => o !== id));
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Title row ──────────────────────────────────── */}
      <div className="flex items-start gap-3">
        <div className="mt-1 shrink-0">
          {done ? (
            <CheckCircleIcon className="h-7 w-7 text-green-600" />
          ) : (
            <CircleIcon className="h-7 w-7 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <div className="flex items-center gap-2">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") setEditingTitle(false);
                  if (e.key === "Escape") { setTitle(initialTitle); setEditingTitle(false); }
                }}
                className="text-2xl font-bold h-auto py-1"
                autoFocus
              />
              <button onClick={() => setEditingTitle(false)} className="text-green-600 hover:text-green-700">
                <CheckIcon className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <h1
              className="text-2xl font-bold tracking-tight cursor-pointer hover:text-primary/80 transition-colors group inline-flex items-center gap-2"
              onClick={() => setEditingTitle(true)}
            >
              {title}
              <PencilIcon className="h-4 w-4 opacity-0 group-hover:opacity-50 transition-opacity" />
            </h1>
          )}
        </div>

        {/* Save button — floats right when dirty */}
        {isDirty && (
          <Button onClick={handleSave} disabled={saving || !title.trim()} size="sm" className="shrink-0">
            <SaveIcon className="h-3.5 w-3.5 mr-1.5" />
            {saving ? "Saving..." : "Save"}
          </Button>
        )}
      </div>

      {/* ── Meta fields row — all inline-editable ──────── */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 ml-10">
        {/* Status pill — click to change */}
        <div className="relative" ref={statusRef}>
          <button
            onClick={() => setShowStatusPicker(!showStatusPicker)}
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full transition-all hover:ring-2 hover:ring-ring/20 ${st.bg} ${st.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
            {st.label}
          </button>
          {showStatusPicker && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-popover border rounded-lg shadow-lg p-1 min-w-[160px]">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s.value}
                  onClick={() => { setStatus(s.value); setShowStatusPicker(false); }}
                  className={`w-full flex items-center gap-2 text-xs px-3 py-2 rounded-md hover:bg-muted transition-colors ${
                    s.value === status ? "bg-muted font-semibold" : ""
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${s.dot}`} />
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Company — inline dropdown */}
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <BuildingIcon className="h-3.5 w-3.5" />
          <select
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            className="bg-transparent border-none text-sm text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none"
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </span>

        {/* Quarter + Year */}
        <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <CalendarIcon className="h-3.5 w-3.5" />
          <select
            value={quarter}
            onChange={(e) => setQuarter(Number(e.target.value))}
            className="bg-transparent border-none text-sm text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none w-[45px]"
          >
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>Q{q}</option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            min={2024}
            max={2030}
            className="bg-transparent border-none text-sm text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none w-[55px] tabular-nums"
          />
        </span>

        {/* Target date */}
        <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
          <TargetIcon className="h-3.5 w-3.5" />
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="bg-transparent border-none text-sm text-muted-foreground hover:text-foreground cursor-pointer focus:outline-none"
          />
        </span>

        {/* Integrator */}
        {integratorName && (
          <span className="text-sm text-muted-foreground">
            Integrator: {integratorName}
          </span>
        )}
      </div>

      {/* ── Owners row ─────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-2 ml-10">
        <UserIcon className="h-3.5 w-3.5 text-muted-foreground" />
        {ownerIds.map((id) => (
          <span
            key={id}
            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20"
          >
            {userMap[id] || "Unknown"}
            {ownerIds.length > 1 && (
              <button type="button" onClick={() => removeOwner(id)} className="hover:text-red-600 ml-0.5">
                <XIcon className="h-3 w-3" />
              </button>
            )}
          </span>
        ))}
        <select
          value=""
          onChange={(e) => { if (e.target.value) addOwner(e.target.value); }}
          className="h-6 rounded-full border border-dashed border-input bg-transparent px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <option value="">+ Add</option>
          {users.filter((u) => !ownerIds.includes(u.id)).map((u) => (
            <option key={u.id} value={u.id}>{u.name}</option>
          ))}
        </select>
      </div>

      {/* ── Description — click to edit ─────────────────── */}
      <div className="ml-10">
        {editingDesc ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-ring"
              autoFocus
              placeholder="Add a description..."
            />
            <div className="flex gap-1.5">
              <button
                onClick={() => setEditingDesc(false)}
                className="text-xs font-medium px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
              >
                Done
              </button>
              <button
                onClick={() => { setDescription(initialDescription); setEditingDesc(false); }}
                className="text-xs font-medium px-2.5 py-1 rounded-md hover:bg-muted text-muted-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div
            className="group cursor-pointer"
            onClick={() => setEditingDesc(true)}
          >
            {description ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap hover:text-foreground transition-colors">
                {description}
                <PencilIcon className="inline h-3 w-3 ml-1.5 opacity-0 group-hover:opacity-50 transition-opacity" />
              </p>
            ) : (
              <p className="text-sm text-muted-foreground/50 italic hover:text-muted-foreground transition-colors">
                Click to add description...
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
