import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getVisibleBusinesses, isAdmin } from "@/lib/access";
import { HomeIcon, BuildingIcon, TargetIcon, CheckSquareIcon, LayoutDashboardIcon, UsersIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { BusinessSwitcher } from "@/components/business-switcher";
import { SidebarUser } from "@/components/sidebar-user";

export async function AppSidebar() {
  const session = await getServerSession(authOptions);
  const businesses = session?.user?.id
    ? await getVisibleBusinesses(session.user.id, session.user.role)
    : await prisma.business.findMany({ orderBy: { name: "asc" } });

  // Show integrator board for admins (integrator/visionary) or users who are integrator on any rock
  let showIntegratorBoard = isAdmin(session?.user?.role);
  if (!showIntegratorBoard) {
    try {
      const rockCheck = session?.user?.id
        ? await prisma.rock.findFirst({ where: { integratorId: session.user.id } })
        : null;
      showIntegratorBoard = !!rockCheck;
    } catch {
      // integratorId column may not exist yet during migration
    }
  }

  return (
    <Sidebar>
      <SidebarHeader>
        <BusinessSwitcher businesses={businesses} />
      </SidebarHeader>

      <SidebarContent>
        {/* Integrator — always at top for integrators */}
        {showIntegratorBoard && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link href="/integrator" />} tooltip="Integrator Board">
                    <LayoutDashboardIcon />
                    <span className="font-semibold">Integrator Board</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        {/* Main nav */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/" />} tooltip="Portfolio">
                  <HomeIcon />
                  <span>Portfolio</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/my-rocks" />} tooltip="My Rocks">
                  <TargetIcon />
                  <span>My Rocks</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton render={<Link href="/my-todos" />} tooltip="My To-Dos">
                  <CheckSquareIcon />
                  <span>My To-Dos</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {isAdmin(session?.user?.role) && (
                <SidebarMenuItem>
                  <SidebarMenuButton render={<Link href="/admin/users" />} tooltip="Manage Users">
                    <UsersIcon />
                    <span>Manage Users</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Businesses */}
        <SidebarGroup>
          <SidebarGroupLabel>Businesses</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {businesses.map((business) => (
                <SidebarMenuItem key={business.id}>
                  <SidebarMenuButton
                    render={<Link href={`/${business.slug}`} />}
                    tooltip={business.name}
                  >
                    <BuildingIcon />
                    <span>{business.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {session?.user && (
        <SidebarUser
          name={session.user.name ?? "Owner"}
          email={session.user.email ?? ""}
        />
      )}
    </Sidebar>
  );
}
