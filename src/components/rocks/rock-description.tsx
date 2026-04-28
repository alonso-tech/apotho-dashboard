"use client";

import { useState } from "react";
import { updateRockDescription } from "@/app/actions/rocks";
import { PencilIcon, CheckIcon, XIcon } from "lucide-react";

export function RockDescription({
  rockId,
  initialDescription,
}: {
  rockId: string;
  initialDescription: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialDescription);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await updateRockDescription(rockId, value);
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={4}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-ring"
          autoFocus
          placeholder="Add a description..."
        />
        <div className="flex gap-1.5">
          <button
            onClick={handleSave}
            disabled={saving}
            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <CheckIcon className="h-3 w-3" />
            {saving ? "Saving..." : "Save"}
          </button>
          <button
            onClick={() => { setValue(initialDescription); setEditing(false); }}
            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md hover:bg-muted"
          >
            <XIcon className="h-3 w-3" />
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative">
      {initialDescription ? (
        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{initialDescription}</p>
      ) : (
        <p className="text-sm text-muted-foreground/60 italic">No description</p>
      )}
      <button
        onClick={() => setEditing(true)}
        className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-muted"
      >
        <PencilIcon className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
    </div>
  );
}
