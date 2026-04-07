"use client";

import Link from "next/link";
import { BuildingIcon } from "lucide-react";
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenu,
} from "@/components/ui/sidebar";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function BusinessSwitcher({ businesses }: { businesses: unknown[] }) {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton size="lg" render={<Link href="/" />}>
          <div className="flex aspect-square size-9 items-center justify-center rounded-lg gradient-primary text-white shadow-md shadow-primary/30">
            <BuildingIcon className="size-4" />
          </div>
          <div className="flex flex-col gap-0.5 leading-none text-left">
            <span className="font-semibold tracking-tight text-base">Apotho</span>
            <span className="text-xs text-sidebar-foreground/60">
              Improvements
            </span>
          </div>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
