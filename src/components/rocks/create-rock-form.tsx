"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createRock } from "@/app/actions/rocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusIcon, XIcon } from "lucide-react";

interface Business {
  id: string;
  name: string;
  slug: string;
}

interface User {
  id: string;
  name: string;
}

export function CreateRockForm({
  businesses,
  users,
  defaultQuarter,
  defaultYear,
  integratorId,
  currentUserId,
}: {
  businesses: Business[];
  users: User[];
  defaultQuarter: number;
  defaultYear: number;
  integratorId?: string;
  currentUserId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedOwners, setSelectedOwners] = useState<string[]>(currentUserId ? [currentUserId] : []);
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? "");
  const [quarter, setQuarter] = useState(defaultQuarter);
  const [year, setYear] = useState(defaultYear);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  function addOwner(id: string) {
    if (id && !selectedOwners.includes(id)) {
      setSelectedOwners([...selectedOwners, id]);
    }
  }

  function removeOwner(id: string) {
    setSelectedOwners(selectedOwners.filter((o) => o !== id));
  }

  function reset() {
    formRef.current?.reset();
    setSelectedOwners(currentUserId ? [currentUserId] : []);
    setBusinessId(businesses[0]?.id ?? "");
    setOpen(false);
  }

  function handleSubmit(formData: FormData) {
    formData.set("businessId", businessId);
    formData.set("quarter", String(quarter));
    formData.set("year", String(year));
    if (integratorId) formData.set("integratorId", integratorId);
    for (const id of selectedOwners) {
      formData.append("ownerIds", id);
    }
    if (selectedOwners.length > 0) {
      formData.set("ownerId", selectedOwners[0]);
    }
    startTransition(async () => {
      await createRock(formData);
      reset();
      router.refresh();
    });
  }

  const availableUsers = users.filter((u) => !selectedOwners.includes(u.id));
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)} className="btn-shine">
        <PlusIcon className="mr-1 h-4 w-4" /> Create Rock
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in-up">
      <form
        ref={formRef}
        action={handleSubmit}
        className="bg-card border rounded-xl shadow-2xl p-6 w-full max-w-lg flex flex-col gap-4 mx-4"
      >
        <h2 className="text-lg font-bold gradient-text">Create New Rock</h2>

        <div>
          <Label htmlFor="cr-title">Rock Title</Label>
          <Input
            id="cr-title"
            name="title"
            placeholder="What needs to be done?"
            required
            autoFocus
          />
        </div>

        <div>
          <Label htmlFor="cr-desc">Description (optional)</Label>
          <textarea
            id="cr-desc"
            name="description"
            placeholder="Add details..."
            rows={2}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm resize-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Company</Label>
            <select
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Quarter</Label>
              <select
                value={quarter}
                onChange={(e) => setQuarter(Number(e.target.value))}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
              >
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>
                    Q{q}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label>Year</Label>
              <Input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                min={2024}
                max={2030}
                className="h-9"
              />
            </div>
          </div>
        </div>

        <div>
          <Label>Owners</Label>
          {selectedOwners.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {selectedOwners.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20"
                >
                  {userMap[id]}
                  <button
                    type="button"
                    onClick={() => removeOwner(id)}
                    className="hover:text-red-600 ml-0.5"
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
          {availableUsers.length > 0 && (
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) addOwner(e.target.value);
              }}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
            >
              <option value="">
                {selectedOwners.length === 0
                  ? "Select owner(s)..."
                  : "+ Add another owner..."}
              </option>
              {availableUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            type="submit"
            size="sm"
            disabled={isPending || selectedOwners.length === 0 || !businessId}
            className="btn-shine"
          >
            {isPending ? "Creating..." : "Create Rock"}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={reset}>
            Cancel
          </Button>
        </div>
      </form>
    </div>
  );
}
