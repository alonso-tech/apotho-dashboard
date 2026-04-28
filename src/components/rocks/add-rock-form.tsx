"use client";

import { useRef, useState, useTransition } from "react";
import { createRock } from "@/app/actions/rocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusIcon, XIcon } from "lucide-react";

interface Owner {
  id: string;
  name: string;
}

interface AddRockFormProps {
  businessId: string;
  businessSlug: string;
  owners: Owner[];
  defaultQuarter: number;
  defaultYear: number;
}

export function AddRockForm({ businessId, owners, defaultQuarter, defaultYear }: AddRockFormProps) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  function addOwner(id: string) {
    if (id && !selectedOwners.includes(id)) {
      setSelectedOwners([...selectedOwners, id]);
    }
  }

  function removeOwner(id: string) {
    setSelectedOwners(selectedOwners.filter((o) => o !== id));
  }

  function handleSubmit(formData: FormData) {
    // Add selected owner IDs to form data
    for (const id of selectedOwners) {
      formData.append("ownerIds", id);
    }
    // Set primary ownerId for backwards compat
    if (selectedOwners.length > 0) {
      formData.set("ownerId", selectedOwners[0]);
    }
    startTransition(async () => {
      await createRock(formData);
      formRef.current?.reset();
      setSelectedOwners([]);
      setOpen(false);
    });
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <PlusIcon className="mr-1 h-4 w-4" /> Add Rock
      </Button>
    );
  }

  const availableOwners = owners.filter((o) => !selectedOwners.includes(o.id));
  const ownerMap = Object.fromEntries(owners.map((o) => [o.id, o.name]));

  return (
    <form ref={formRef} action={handleSubmit} className="rounded-lg border p-4 flex flex-col gap-3">
      <input type="hidden" name="businessId" value={businessId} />
      <input type="hidden" name="quarter" value={defaultQuarter} />
      <input type="hidden" name="year" value={defaultYear} />
      <div>
        <Label htmlFor="title">Rock Title</Label>
        <Input id="title" name="title" placeholder="What needs to be done this quarter?" required />
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
                {ownerMap[id]}
                <button type="button" onClick={() => removeOwner(id)} className="hover:text-red-600 ml-0.5">
                  <XIcon className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
        {availableOwners.length > 0 && (
          <select
            value=""
            onChange={(e) => { if (e.target.value) addOwner(e.target.value); }}
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
          >
            <option value="">{selectedOwners.length === 0 ? "Select owner(s)..." : "+ Add another owner..."}</option>
            {availableOwners.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending || selectedOwners.length === 0}>
          {isPending ? "Saving..." : "Save Rock"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => { setOpen(false); setSelectedOwners([]); }}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
