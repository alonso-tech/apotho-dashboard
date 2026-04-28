"use client";

import { useState, useTransition } from "react";
import { updateUserRole, addUserToBusiness, removeUserFromBusiness, createUser } from "@/app/actions/users";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { XIcon, PlusIcon, ShieldIcon, EyeIcon, UserIcon, MailIcon, UserPlusIcon } from "lucide-react";

interface UserData {
  id: string;
  name: string;
  email: string;
  role: string;
  businesses: { id: string; name: string; role: string }[];
}

interface Props {
  users: UserData[];
  allBusinesses: { id: string; name: string }[];
}

const ROLE_LABELS: Record<string, { label: string; icon: typeof ShieldIcon; color: string }> = {
  integrator: { label: "Integrator", icon: ShieldIcon, color: "text-purple-600 bg-purple-100" },
  visionary: { label: "Visionary", icon: EyeIcon, color: "text-blue-600 bg-blue-100" },
  member: { label: "Member", icon: UserIcon, color: "text-gray-600 bg-gray-100" },
};

export function UserManagement({ users, allBusinesses }: Props) {
  const [isPending, startTransition] = useTransition();
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [addingBusiness, setAddingBusiness] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteResult, setInviteResult] = useState<{ tempPassword: string } | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  function handleRoleChange(userId: string, newRole: string) {
    startTransition(() => updateUserRole(userId, newRole));
  }

  function handleAddBusiness(userId: string, businessId: string) {
    startTransition(async () => {
      await addUserToBusiness(userId, businessId);
      setAddingBusiness(null);
    });
  }

  function handleRemoveBusiness(userId: string, businessId: string) {
    if (!confirm("Remove this business access?")) return;
    startTransition(() => removeUserFromBusiness(userId, businessId));
  }

  function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setInviteError(null);
    setInviteResult(null);
    startTransition(async () => {
      try {
        const result = await createUser(inviteName.trim(), inviteEmail.trim());
        setInviteResult({ tempPassword: result.tempPassword });
        setInviteName("");
        setInviteEmail("");
      } catch (err) {
        setInviteError(err instanceof Error ? err.message : "Failed to create user");
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Invite new user */}
      {showInvite ? (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <UserPlusIcon className="h-4 w-4" /> Invite New User
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Name</label>
                  <Input
                    placeholder="John Smith"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    className="h-9"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Email</label>
                  <Input
                    type="email"
                    placeholder="john@company.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    className="h-9"
                    required
                  />
                </div>
              </div>
              {inviteError && (
                <p className="text-xs text-destructive">{inviteError}</p>
              )}
              {inviteResult && (
                <div className="rounded-md bg-green-50 border border-green-200 p-3 text-sm">
                  <p className="font-medium text-green-800 flex items-center gap-1.5">
                    <MailIcon className="h-4 w-4" /> User created & invitation sent
                  </p>
                  <p className="text-green-700 text-xs mt-1">
                    Temp password: <code className="bg-green-100 px-1.5 py-0.5 rounded font-mono">{inviteResult.tempPassword}</code>
                  </p>
                  <p className="text-green-600 text-xs mt-1">
                    Share this password if the email doesn&apos;t arrive. You can now assign them a role and businesses below.
                  </p>
                </div>
              )}
              <div className="flex gap-2">
                <Button type="submit" size="sm" disabled={isPending || !inviteName.trim() || !inviteEmail.trim()}>
                  {isPending ? "Creating..." : "Create & Send Invite"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setShowInvite(false); setInviteResult(null); setInviteError(null); }}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" onClick={() => setShowInvite(true)} className="self-start">
          <UserPlusIcon className="h-4 w-4 mr-2" /> Invite User
        </Button>
      )}

      {users.map((user) => {
        const roleInfo = ROLE_LABELS[user.role] || ROLE_LABELS.member;
        const RoleIcon = roleInfo.icon;
        const isExpanded = expandedUser === user.id;
        const assignedIds = user.businesses.map((b) => b.id);
        const availableBusinesses = allBusinesses.filter((b) => !assignedIds.includes(b.id));

        return (
          <Card key={user.id} className="overflow-hidden">
            <CardHeader
              className="cursor-pointer hover:bg-muted/30 transition-colors py-3"
              onClick={() => setExpandedUser(isExpanded ? null : user.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${roleInfo.color}`}>
                    <RoleIcon className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-sm font-semibold">{user.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={user.role}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleRoleChange(user.id, e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    disabled={isPending}
                    className="h-8 rounded-md border border-input bg-transparent px-2 text-xs font-medium"
                  >
                    <option value="integrator">Integrator</option>
                    <option value="visionary">Visionary</option>
                    <option value="member">Member</option>
                  </select>
                  <span className="text-xs text-muted-foreground">
                    {user.businesses.length} business{user.businesses.length !== 1 ? "es" : ""}
                  </span>
                </div>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="border-t pt-3">
                {user.role === "member" ? (
                  <p className="text-xs text-muted-foreground mb-3">
                    Members only see businesses assigned below. Add or remove businesses to control access.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mb-3">
                    {roleInfo.label}s have access to all businesses. Assignments below are for organizational tracking.
                  </p>
                )}

                {/* Current business assignments */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {user.businesses.length === 0 && (
                    <span className="text-xs text-muted-foreground italic">No businesses assigned</span>
                  )}
                  {user.businesses.map((biz) => (
                    <span
                      key={biz.id}
                      className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium"
                    >
                      {biz.name}
                      <button
                        onClick={() => handleRemoveBusiness(user.id, biz.id)}
                        className="ml-0.5 hover:text-destructive transition-colors"
                        disabled={isPending}
                      >
                        <XIcon className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>

                {/* Add business */}
                {addingBusiness === user.id ? (
                  <div className="flex items-center gap-2">
                    <select
                      className="h-8 rounded-md border border-input bg-transparent px-2 text-xs flex-1"
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) handleAddBusiness(user.id, e.target.value);
                      }}
                      disabled={isPending}
                    >
                      <option value="" disabled>Select a business...</option>
                      {availableBusinesses.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAddingBusiness(null)}
                      className="h-8"
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  availableBusinesses.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAddingBusiness(user.id)}
                      className="h-7 text-xs"
                    >
                      <PlusIcon className="h-3 w-3 mr-1" /> Add Business
                    </Button>
                  )
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
