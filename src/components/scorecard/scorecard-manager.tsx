"use client";

import { useState, useTransition } from "react";
import { createMeasurable, deleteMeasurable, saveEntry } from "@/app/actions/scorecard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusIcon, Trash2Icon } from "lucide-react";

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
  entries: EntryData[];
}

interface ScorecardManagerProps {
  businessId: string;
  businessSlug: string;
  measurables: MeasurableData[];
  weeks: string[]; // ISO strings of Mondays
}

function formatWeek(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function ScorecardManager({ businessId, measurables, weeks }: ScorecardManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [editingCell, setEditingCell] = useState<{ measurableId: string; weekOf: string } | null>(null);
  const [cellValue, setCellValue] = useState("");

  // Build an entry lookup: measurableId -> weekOf (date string) -> entry
  function getEntry(mId: string, weekIso: string): EntryData | null {
    const m = measurables.find((x) => x.id === mId);
    if (!m) return null;
    const weekDate = new Date(weekIso).toDateString();
    return m.entries.find((e) => new Date(e.weekOf).toDateString() === weekDate) ?? null;
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

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left py-2 px-3 font-medium min-w-[160px]">Measurable</th>
              <th className="text-right py-2 px-3 font-medium">Goal</th>
              {weeks.map((w) => (
                <th key={w} className="text-center py-2 px-2 font-medium min-w-[56px]">
                  {formatWeek(w)}
                </th>
              ))}
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
            {measurables.map((m) => (
              <tr key={m.id} className="border-b last:border-0 hover:bg-muted/20">
                <td className="py-2 px-3">
                  <div>
                    <span className="font-medium">{m.name}</span>
                    {m.unit && <span className="text-xs text-muted-foreground ml-1">({m.unit})</span>}
                  </div>
                </td>
                <td className="text-right py-2 px-3 text-muted-foreground">{m.goal}</td>
                {weeks.map((w) => {
                  const entry = getEntry(m.id, w);
                  const isEditing = editingCell?.measurableId === m.id && editingCell?.weekOf === w;
                  return (
                    <td key={w} className="text-center py-1 px-1">
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
