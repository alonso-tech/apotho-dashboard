"use client";

import { useState } from "react";
import { addBusinessOwner, removeBusinessOwner, updateBusinessOwnerRole } from "@/app/actions/business";
import { Button } from "@/components/ui/button";
import { PlusIcon, TrashIcon, ShieldIcon, UserIcon } from "lucide-react";

type Owner = {
  id: string;
  userId: string;
  userName: string;
  role: string;
};

type User = {
  id: string;
  name: string;
};

const ROLES = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "member", label: "Member" },
  { value: "viewer", label: "Viewer" },
];

export function BusinessAccessManager({
  businessId,
  currentOwners,
  allUsers,
}: {
  businessId: string;
  currentOwners: Owner[];
  allUsers: User[];
}) {
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("member");
  const [removing, setRemoving] = useState<string | null>(null);

  const currentUserIds = currentOwners.map((o) => o.userId);
  const availableUsers = allUsers.filter((u) => !currentUserIds.includes(u.id));

  async function handleAdd() {
    if (!selectedUserId) return;
    setAdding(true);
    await addBusinessOwner(businessId, selectedUserId, selectedRole);
    setSelectedUserId("");
    setSelectedRole("member");
    setAdding(false);
  }

  async function handleRemove(ownershipId: string) {
    setRemoving(ownershipId);
    await removeBusinessOwner(ownershipId);
    setRemoving(null);
  }

  async function handleRoleChange(ownershipId: string, newRole: string) {
    await updateBusinessOwnerRole(ownershipId, newRole);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
      >
        <ShieldIcon className="h-3.5 w-3.5" />
        Manage Access
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-lg border p-4 bg-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <ShieldIcon className="h-4 w-4" />
          Business Access
        </h3>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>

      {/* Current owners */}
      <div className="flex flex-col gap-2 mb-4">
        {currentOwners.map((owner) => (
          <div
            key={owner.id}
            className="flex items-center gap-3 rounded-md border px-3 py-2 group"
          >
            <UserIcon className="h-4 w-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium flex-1">{owner.userName}</span>
            <select
              value={owner.role}
              onChange={(e) => handleRoleChange(owner.id, e.target.value)}
              className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => handleRemove(owner.id)}
              disabled={removing === owner.id}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive disabled:opacity-50"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {/* Add new user */}
      {availableUsers.length > 0 && (
        <div className="flex items-center gap-2 pt-2 border-t">
          <PlusIcon className="h-4 w-4 text-muted-foreground shrink-0" />
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="h-8 flex-1 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Select a user to add...</option>
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="h-8 rounded-md border border-input bg-transparent px-2 text-xs"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={adding || !selectedUserId}
          >
            {adding ? "..." : "Add"}
          </Button>
        </div>
      )}

      {availableUsers.length === 0 && currentOwners.length > 0 && (
        <p className="text-xs text-muted-foreground pt-2 border-t">
          All users have been added to this business.
        </p>
      )}
    </div>
  );
}
