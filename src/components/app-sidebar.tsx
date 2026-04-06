import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HomeIcon, BuildingIcon, TargetIcon, CheckSquareIcon, LayoutDashboardIcon } from "lucide-react";
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
  const businesses = await prisma.business.findMany({
    orderBy: { name: "asc" },
  });

  // Check if user is an integrator on any rock
  const isIntegrator = session?.user?.id
    ? await prisma.rock.findFirst({ where: { integratorId: session.user.id } })
    : null;

  return (
    <Sidebar>
      <SidebarHeader>
        <BusinessSwitcher businesses={businesses} />
      </SidebarHeader>

      <SidebarContent>
        {/* Integrator — always at top for integrators */}
        {isIntegrator && (
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
