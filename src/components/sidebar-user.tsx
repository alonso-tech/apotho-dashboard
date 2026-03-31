"use client";

import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { SidebarFooter } from "@/components/ui/sidebar";
import { LogOutIcon } from "lucide-react";

interface SidebarUserProps {
  name: string;
  email: string;
}

export function SidebarUser({ name, email }: SidebarUserProps) {
  return (
    <SidebarFooter className="border-t border-sidebar-border">
      <div className="flex items-center justify-between gap-2 px-1 py-1">
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium">{name}</span>
          <span className="truncate text-xs text-sidebar-foreground/60">
            {email}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => signOut({ callbackUrl: "/sign-in" })}
          title="Sign out"
        >
          <LogOutIcon />
          <span className="sr-only">Sign out</span>
        </Button>
      </div>
    </SidebarFooter>
  );
}
