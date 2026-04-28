"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { changePassword, updateProfile } from "@/app/actions/account";
import { CheckIcon, AlertCircleIcon, UserIcon, LockIcon } from "lucide-react";

export function SettingsForm({ userName, userEmail }: { userName: string; userEmail: string }) {
  const [name, setName] = useState(userName);
  const [nameStatus, setNameStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [nameSaving, setNameSaving] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwStatus, setPwStatus] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [pwSaving, setPwSaving] = useState(false);

  async function handleNameSave(e: React.FormEvent) {
    e.preventDefault();
    setNameSaving(true);
    setNameStatus(null);
    const result = await updateProfile(name);
    if (result.error) {
      setNameStatus({ type: "error", message: result.error });
    } else {
      setNameStatus({ type: "success", message: "Name updated. Refresh to see changes in the sidebar." });
    }
    setNameSaving(false);
  }

  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    setPwStatus(null);

    if (newPassword.length < 8) {
      setPwStatus({ type: "error", message: "New password must be at least 8 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPwStatus({ type: "error", message: "Passwords do not match." });
      return;
    }

    setPwSaving(true);
    const result = await changePassword(currentPassword, newPassword);
    if (result.error) {
      setPwStatus({ type: "error", message: result.error });
    } else {
      setPwStatus({ type: "success", message: "Password changed successfully." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
    setPwSaving(false);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Profile Section */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b bg-muted/20 flex items-center gap-2">
          <UserIcon className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Profile</h2>
        </div>
        <form onSubmit={handleNameSave} className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Email</label>
            <Input value={userEmail} disabled className="bg-muted/30" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Display Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
            />
          </div>
          {nameStatus && (
            <div className={`flex items-center gap-1.5 text-sm ${nameStatus.type === "error" ? "text-red-600" : "text-green-600"}`}>
              {nameStatus.type === "error" ? <AlertCircleIcon className="h-4 w-4" /> : <CheckIcon className="h-4 w-4" />}
              {nameStatus.message}
            </div>
          )}
          <Button type="submit" disabled={nameSaving || name === userName} className="w-fit">
            {nameSaving ? "Saving..." : "Save Name"}
          </Button>
        </form>
      </div>

      {/* Password Section */}
      <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b bg-muted/20 flex items-center gap-2">
          <LockIcon className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Change Password</h2>
        </div>
        <form onSubmit={handlePasswordChange} className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Current Password</label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="Enter current password"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">New Password</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground">Confirm New Password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              required
            />
          </div>
          {pwStatus && (
            <div className={`flex items-center gap-1.5 text-sm ${pwStatus.type === "error" ? "text-red-600" : "text-green-600"}`}>
              {pwStatus.type === "error" ? <AlertCircleIcon className="h-4 w-4" /> : <CheckIcon className="h-4 w-4" />}
              {pwStatus.message}
            </div>
          )}
          <Button type="submit" disabled={pwSaving || !currentPassword || !newPassword || !confirmPassword} className="w-fit">
            {pwSaving ? "Changing..." : "Change Password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
