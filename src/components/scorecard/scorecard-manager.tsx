"use client";

import { useState, useTransition } from "react";
import { createMeasurable, deleteMeasurable, saveEntry, updateMeasurable, reorderMeasurables } from "@/app/actions/scorecard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusIcon, Trash2Icon, PencilIcon, CheckIcon, XIcon, GripVerticalIcon } from "lucide-react";
import Link from "next/link";

interface EntryData {
  id: string;
  weekOf: string;
  actual: string;
  onTrack: boolean;
}

interface MeasurableData {
  id: string;
  name: string;
  goal: string;
  unit: string;
  goalDirection: string; // gte, lte, gt, lt, eq
  entries: EntryData[];
}

const DIRECTION_OPTIONS = [
  { value: "gte", label: ">=" },
  { value: "lte", label: "<=" },
  { value: "gt", label: ">" },
  { value: "lt", label: "<" },
  { value: "eq", label: "=" },
];

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

interface ScorecardManagerProps {
  businessId: string;
  businessSlug: string;
  measurables: MeasurableData[];
  weeks: string[];
  selectedQuarter: number;
  selectedYear: number;
}

function formatWeek(iso: string) {
  const d = new Date(iso);
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
}

export function ScorecardManager({
  businessId,
  businessSlug,
  measurables,
  weeks,
  selectedQuarter,
  selectedYear,
}: ScorecardManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editingCell, setEditingCell] = useState<{ measurableId: string; weekOf: string } | null>(null);
  const [cellValue, setCellValue] = useState("");

  // Drag reorder state
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [localOrder, setLocalOrder] = useState<MeasurableData[]>(measurables);

  // Keep localOrder in sync with props
  if (measurables !== localOrder && measurables.length !== localOrder.length || measurables.some((m, i) => m.id !== localOrder[i]?.id)) {
    setLocalOrder(measurables);
  }

  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  function handleDragOver(e: React.DragEvent, idx: number) {
    e.preventDefault();
    setDragOverIdx(idx);
  }

  function handleDrop(idx: number) {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const newOrder = [...localOrder];
    const [moved] = newOrder.splice(dragIdx, 1);
    newOrder.splice(idx, 0, moved);
    setLocalOrder(newOrder);
    setDragIdx(null);
    setDragOverIdx(null);

    // Persist the new order
    startTransition(async () => {
      await reorderMeasurables(newOrder.map((m) => m.id));
    });
  }

  // Inline measurable editing
  const [editingMeasurable, setEditingMeasurable] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editGoal, setEditGoal] = useState("");
  const [editUnit, setEditUnit] = useState("");
  const [editDirection, setEditDirection] = useState("gte");

  function getEntry(mId: string, weekIso: string): EntryData | null {
    const m = localOrder.find((x) => x.id === mId);
    if (!m) return null;
    const weekKey = weekIso.split("T")[0];
    return m.entries.find((e) => e.weekOf.split("T")[0] === weekKey) ?? null;
  }

  function handleCellClick(measurableId: string, weekOf: string) {
    const entry = getEntry(measurableId, weekOf);
    setEditingCell({ measurableId, weekOf });
    setCellValue(entry?.actual ?? "");
  }

  function handleCellSave() {
    if (!editingCell) return;
    const fd = new FormData();
    fd.append("measurableId", editingCell.measurableId);
    fd.append("weekOf", editingCell.weekOf);
    fd.append("actual", cellValue);
    startTransition(async () => {
      await saveEntry(fd);
      setEditingCell(null);
      setCellValue("");
    });
  }

  function handleDelete(measurableId: string) {
    if (!confirm("Delete this measurable and all its data?")) return;
    startTransition(() => deleteMeasurable(measurableId));
  }

  function startEditMeasurable(m: MeasurableData) {
    setEditingMeasurable(m.id);
    setEditName(m.name);
    setEditGoal(m.goal);
    setEditUnit(m.unit);
    setEditDirection(m.goalDirection || "gte");
  }

  function cancelEditMeasurable() {
    setEditingMeasurable(null);
  }

  function saveEditMeasurable(id: string) {
    if (!editName.trim() || !editGoal.trim()) return;
    startTransition(async () => {
      await updateMeasurable(id, editName.trim(), editGoal.trim(), editUnit.trim() || null, editDirection);
      setEditingMeasurable(null);
    });
  }

  // Determine which week is "today" (UTC)
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const todayTime = today.getTime();

  return (
    <div className="flex flex-col gap-4">
      {/* Quarter selector */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4].map((q) => (
            <Link
              key={q}
              href={`/${businessSlug}/scorecard?q=${q}&year=${selectedYear}`}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                q === selectedQuarter
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              Q{q}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1">
          {[selectedYear - 1, selectedYear, selectedYear + 1].map((y) => (
            <Link
              key={y}
              href={`/${businessSlug}/scorecard?q=${selectedQuarter}&year=${y}`}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                y === selectedYear
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80 text-muted-foreground"
              }`}
            >
              {y}
            </Link>
          ))}
        </div>
      </div>

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
                  <th
                    key={w}
                    className={`text-center py-2 px-2 font-medium min-w-[56px] ${
                      isCurrentWeek ? "bg-primary/10" : ""
                    }`}
                  >
                    {formatWeek(w)}
                  </th>
                );
              })}
              <th className="text-center py-2 px-2 font-medium min-w-[64px] bg-muted/70 border-l">Avg</th>
              <th className="py-2 px-2" />
            </tr>
          </thead>
          <tbody>
            {measurables.length === 0 && (
              <tr>
                <td colSpan={weeks.length + 3} className="text-center py-8 text-muted-foreground">
                  No measurables yet. Add one below.
                </td>
              </tr>
            )}
            {localOrder.map((m, rowIdx) => (
              <tr
                key={m.id}
                className={`border-b last:border-0 hover:bg-muted/20 ${
                  dragOverIdx === rowIdx ? "border-t-2 border-t-primary" : ""
                }`}
                draggable
                onDragStart={() => handleDragStart(rowIdx)}
                onDragOver={(e) => handleDragOver(e, rowIdx)}
                onDrop={() => handleDrop(rowIdx)}
                onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
              >
                <td className="py-2 px-1 sticky left-0 bg-card z-10">
                  <div className="flex items-center gap-1">
                    <GripVerticalIcon className="h-4 w-4 text-muted-foreground/40 cursor-grab shrink-0" />
                  {editingMeasurable === m.id ? (
                    <div className="flex flex-col gap-1">
                      <Input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="h-7 text-sm"
                        placeholder="Name"
                        autoFocus
                      />
                      <div className="flex gap-1">
                        <Input
                          value={editUnit}
                          onChange={(e) => setEditUnit(e.target.value)}
                          className="h-6 text-xs flex-1"
                          placeholder="Unit"
                        />
                        <select
                          value={editDirection}
                          onChange={(e) => setEditDirection(e.target.value)}
                          className="h-6 rounded border border-input bg-transparent px-1 text-xs"
                          title="Goal direction"
                        >
                          {DIRECTION_OPTIONS.map((d) => (
                            <option key={d.value} value={d.value}>{d.label} goal</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex gap-1 mt-0.5">
                        <button
                          onClick={() => saveEditMeasurable(m.id)}
                          className="text-green-600 hover:text-green-700"
                          disabled={isPending}
                        >
                          <CheckIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={cancelEditMeasurable}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 group/name">
                      <div>
                        <span className="font-medium">{m.name}</span>
                        {m.unit && <span className="text-xs text-muted-foreground ml-1">({m.unit})</span>}
                      </div>
                      <button
                        onClick={() => startEditMeasurable(m)}
                        className="opacity-0 group-hover/name:opacity-100 transition-opacity shrink-0"
                      >
                        <PencilIcon className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                      </button>
                    </div>
                  )}
                  </div>
                </td>
                <td className="text-right py-2 px-3 sticky left-[160px] bg-card z-10">
                  {editingMeasurable === m.id ? (
                    <Input
                      value={editGoal}
                      onChange={(e) => setEditGoal(e.target.value)}
                      className="h-7 w-20 text-sm text-right ml-auto"
                      placeholder="Goal"
                    />
                  ) : (
                    <span className="text-muted-foreground">
                      <span className="text-[10px] opacity-60">{DIRECTION_OPTIONS.find((d) => d.value === m.goalDirection)?.label || ">="} </span>
                      {m.goal}
                    </span>
                  )}
                </td>
                {weeks.map((w) => {
                  const entry = getEntry(m.id, w);
                  const isEditing = editingCell?.measurableId === m.id && editingCell?.weekOf === w;
                  const wDate = new Date(w);
                  const isCurrentWeek = todayTime >= wDate.getTime() && todayTime < wDate.getTime() + 7 * 86400000;
                  return (
                    <td key={w} className={`text-center py-1 px-1 ${isCurrentWeek ? "bg-primary/5" : ""}`}>
                      {isEditing ? (
                        <div className="flex gap-1 items-center justify-center">
                          <Input
                            value={cellValue}
                            onChange={(e) => setCellValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleCellSave();
                              if (e.key === "Escape") setEditingCell(null);
                            }}
                            className="h-7 w-16 text-center text-xs p-1"
                            autoFocus
                          />
                          <button
                            onClick={handleCellSave}
                            className="text-xs text-primary hover:underline"
                            disabled={isPending}
                          >
                            Save
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCellClick(m.id, w)}
                          className={`w-full h-8 rounded px-1 text-xs font-medium transition-colors ${
                            entry
                              ? entry.onTrack
                                ? "bg-green-100 text-green-700 hover:bg-green-200"
                                : "bg-red-100 text-red-700 hover:bg-red-200"
                              : "hover:bg-muted/50 text-muted-foreground"
                          }`}
                        >
                          {entry?.actual ?? "—"}
                        </button>
                      )}
                    </td>
                  );
                })}
                <td className="text-center py-1 px-1 bg-muted/30 border-l">
                  {(() => {
                    const vals = weeks
                      .map((w) => getEntry(m.id, w))
                      .filter((e) => e != null)
                      .map((e) => parseFloat(e!.actual))
                      .filter((v) => !isNaN(v));
                    if (vals.length === 0) return <span className="text-xs text-muted-foreground">—</span>;
                    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
                    const goalNum = parseFloat(m.goal.replace(/,/g, ""));
                    const onTrack = !isNaN(goalNum) ? checkOnTrack(avg, goalNum, m.goalDirection) : false;
                    const formatted = avg >= 1000 ? Math.round(avg).toLocaleString() : avg % 1 === 0 ? String(avg) : avg.toFixed(1);
                    return (
                      <span className={`inline-block w-full h-8 leading-8 rounded px-1 text-xs font-semibold ${
                        onTrack ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                      }`}>
                        {formatted}
                      </span>
                    );
                  })()}
                </td>
                <td className="py-2 px-2">
                  <button
                    onClick={() => handleDelete(m.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors"
                    title="Delete measurable"
                  >
                    <Trash2Icon className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add measurable */}
      {showAdd ? (
        <AddMeasurableForm
          businessId={businessId}
          onDone={() => setShowAdd(false)}
        />
      ) : (
        <Button variant="outline" size="sm" onClick={() => setShowAdd(true)} className="self-start">
          <PlusIcon className="mr-1 h-4 w-4" /> Add Measurable
        </Button>
      )}
    </div>
  );
}

function AddMeasurableForm({ businessId, onDone }: { businessId: string; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();

  function handleSubmit(fd: FormData) {
    fd.append("businessId", businessId);
    startTransition(async () => {
      await createMeasurable(fd);
      onDone();
    });
  }

  return (
    <form action={handleSubmit} className="rounded-lg border p-4 flex flex-col gap-3">
      <div className="grid grid-cols-3 gap-3">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" placeholder="e.g. Revenue" required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="goal">Goal</Label>
          <Input id="goal" name="goal" placeholder="e.g. 50000" required className="mt-1" />
        </div>
        <div>
          <Label htmlFor="unit">Unit</Label>
          <Input id="unit" name="unit" placeholder="e.g. $, %, leads" className="mt-1" />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? "Saving..." : "Add"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
