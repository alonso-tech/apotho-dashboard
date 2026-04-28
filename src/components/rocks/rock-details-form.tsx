"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { updateRockDetails, updateRockOwners } from "@/app/actions/rocks";
import { SaveIcon, XIcon } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "not-started", label: "Not Started", dot: "bg-zinc-400" },
  { value: "in-progress", label: "In Progress", dot: "bg-blue-500" },
  { value: "at-risk", label: "At Risk", dot: "bg-red-500" },
  { value: "complete", label: "Complete", dot: "bg-green-500" },
];

interface Business {
  id: string;
  name: string;
  slug: string;
}

export function RockDetailsForm({
  rockId,
  initialTitle,
  initialStatus,
  initialTargetDate,
  initialOwnerIds,
  initialQuarter,
  initialYear,
  initialBusinessId,
  users,
  businesses,
}: {
  rockId: string;
  initialTitle: string;
  initialStatus: string;
  initialTargetDate: string | null;
  initialOwnerIds: string[];
  initialQuarter: number;
  initialYear: number;
  initialBusinessId: string;
  users: { id: string; name: string }[];
  businesses: Business[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initialTitle);
  const [status, setStatus] = useState(initialStatus);
  const [targetDate, setTargetDate] = useState(initialTargetDate || "");
  const [ownerIds, setOwnerIds] = useState<string[]>(initialOwnerIds);
  const [quarter, setQuarter] = useState(initialQuarter);
  const [year, setYear] = useState(initialYear);
  const [businessId, setBusinessId] = useState(initialBusinessId);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  function addOwner(id: string) {
    if (!ownerIds.includes(id)) {
      setOwnerIds([...ownerIds, id]);
      setDirty(true);
    }
  }

  function removeOwner(id: string) {
    if (ownerIds.length > 1) {
      setOwnerIds(ownerIds.filter((o) => o !== id));
      setDirty(true);
    }
  }

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

    const idsChanged =
      ownerIds.length !== initialOwnerIds.length ||
      ownerIds.some((id) => !initialOwnerIds.includes(id));
    if (idsChanged) {
      const ofd = new FormData();
      ofd.set("rockId", rockId);
      for (const id of ownerIds) ofd.append("ownerIds", id);
      await updateRockOwners(ofd);
    }

    if (businessId !== initialBusinessId) {
      const newBiz = businesses.find((b) => b.id === businessId);
      if (newBiz) {
        router.push(`/${newBiz.slug}/rocks/${rockId}`);
        return;
      }
    }

    setSaving(false);
    setDirty(false);
    router.refresh();
  }

  const availableUsers = users.filter((u) => !ownerIds.includes(u.id));
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  function field(label: string, children: React.ReactNode) {
    return (
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">{label}</label>
        {children}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {field("Title",
        <Input
          value={title}
          onChange={(e) => { setTitle(e.target.value); setDirty(true); }}
          className="h-8 text-sm"
        />
      )}

      {field("Status",
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => { setStatus(s.value); setDirty(true); }}
              className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border transition-colors ${
                status === s.value
                  ? "border-primary bg-primary/5 text-foreground"
                  : "border-transparent hover:bg-muted text-muted-foreground"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        {field("Company",
          <select
            value={businessId}
            onChange={(e) => { setBusinessId(e.target.value); setDirty(true); }}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            {businesses.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        )}
        {field("Target Date",
          <Input
            type="date"
            value={targetDate}
            onChange={(e) => { setTargetDate(e.target.value); setDirty(true); }}
            className="h-8 text-sm"
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {field("Quarter",
          <select
            value={quarter}
            onChange={(e) => { setQuarter(Number(e.target.value)); setDirty(true); }}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            {[1, 2, 3, 4].map((q) => (
              <option key={q} value={q}>Q{q}</option>
            ))}
          </select>
        )}
        {field("Year",
          <Input
            type="number"
            value={year}
            onChange={(e) => { setYear(Number(e.target.value)); setDirty(true); }}
            min={2024}
            max={2030}
            className="h-8 text-sm"
          />
        )}
      </div>

      {field("Owners",
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-1.5">
            {ownerIds.map((id) => (
              <span
                key={id}
                className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20"
              >
                {userMap[id] || "Unknown"}
                {ownerIds.length > 1 && (
                  <button type="button" onClick={() => removeOwner(id)} className="hover:text-red-600">
                    <XIcon className="h-3 w-3" />
                  </button>
                )}
              </span>
            ))}
          </div>
          {availableUsers.length > 0 && (
            <select
              value=""
              onChange={(e) => { if (e.target.value) addOwner(e.target.value); }}
              className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value="">+ Add owner...</option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {dirty && (
        <Button size="sm" onClick={handleSave} disabled={saving || !title.trim()} className="w-full">
          <SaveIcon className="h-3.5 w-3.5 mr-1.5" />
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      )}
    </div>
  );
}
