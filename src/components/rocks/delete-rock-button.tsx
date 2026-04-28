"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteRock } from "@/app/actions/rocks";
import { Button } from "@/components/ui/button";
import { Trash2Icon } from "lucide-react";

export function DeleteRockButton({ rockId, backHref }: { rockId: string; backHref: string }) {
  const [confirming, setConfirming] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (!confirming) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setConfirming(true)} className="text-red-600 hover:text-red-700 hover:bg-red-50">
        <Trash2Icon className="h-4 w-4 mr-1" /> Delete
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-red-600 font-medium">Delete this rock?</span>
      <Button
        variant="destructive"
        size="sm"
        disabled={isPending}
        onClick={() => {
          startTransition(async () => {
            await deleteRock(rockId);
            router.push(backHref);
          });
        }}
      >
        {isPending ? "Deleting..." : "Yes, delete"}
      </Button>
      <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </div>
  );
}
