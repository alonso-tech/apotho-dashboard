import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { HomeIcon, BuildingIcon } from "lucide-react";
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

  return (
    <Sidebar>
      <SidebarHeader>
        <BusinessSwitcher businesses={businesses} />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/" />}
                  tooltip="Portfolio"
                >
                  <HomeIcon />
                  <span>Portfolio</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

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
