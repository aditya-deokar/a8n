"use client";

import {
  CreditCardIcon,
  FolderOpenIcon,
  HistoryIcon,
  KeyIcon,
  LogOutIcon,
  StarIcon,
  ServerIcon,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { useHasActiveSubscription } from "@/features/subscriptions/hooks/use-subscription";

const menuItems = [
  {
    title: "Main",
    items: [
      {
        title: "Workflows",
        icon: FolderOpenIcon,
        url: "/workflows",
      },
      {
        title: "Credentials",
        icon: KeyIcon,
        url: "/credentials",
      },
      {
        title: "Executions",
        icon: HistoryIcon,
        url: "/executions",
      },
      {
        title: "MCP Server",
        icon: ServerIcon,
        url: "/mcp",
      },
    ],
  }
];

export const AppSidebar = () => {
  const router = useRouter();
  const pathname = usePathname();
  const { hasActiveSubscription, isLoading } = useHasActiveSubscription();

  return (
    <Sidebar 
      variant="floating" 
      collapsible="icon" 
      className="mt-2 ml-2 mb-2 h-[calc(100vh-1rem)] shadow-xl text-white bg-gradient-to-b from-[#5c54a4] to-[#9187ce] rounded-2xl overflow-hidden border-none"
      style={{
        "--sidebar": "transparent",
        "--sidebar-border": "transparent",
        "--sidebar-accent": "rgba(255,255,255,0.15)",
        "--sidebar-accent-foreground": "white",
        "--sidebar-foreground": "white"
      } as React.CSSProperties}
    >
      <SidebarHeader className="pt-6 pb-4">
        <SidebarMenuItem>
          <SidebarMenuButton asChild className="gap-x-4 h-12 px-4 hover:bg-white/10 text-white">
            <Link href="/" prefetch>
              <Image src="/logos/logo.svg" alt="Nodebase" width={32} height={32} className="brightness-0 invert" />
              <span className="font-bold text-xl tracking-tight">Nodebase</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarHeader>
      <SidebarContent className="px-3 gap-y-2">
        {menuItems.map((group) => (
          <SidebarGroup key={group.title} className="p-0">
            <SidebarGroupContent>
              <SidebarMenu className="gap-y-2">
                {group.items.map((item) => {
                  const isActive = item.url === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        tooltip={item.title}
                        isActive={isActive}
                        asChild
                        className={`gap-x-4 h-12 px-4 rounded-xl transition-all duration-200 ${
                          isActive 
                            ? "shadow-[0_0_15px_rgba(255,255,255,0.1)] font-medium" 
                            : "text-white/70"
                        }`}
                      >
                        <Link href={item.url} prefetch>
                          <item.icon className={`size-5 ${isActive ? "text-white" : "text-white/70"}`} />
                          <span className="text-base">{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter className="pb-6 px-3">
        <SidebarMenu className="gap-y-2">
          {!hasActiveSubscription && !isLoading && (
            <SidebarMenuItem>
              <SidebarMenuButton
                tooltip="Upgrade to Pro"
                className="gap-x-4 h-12 px-4 rounded-xl text-white/70 transition-all duration-200"
                onClick={() => authClient.checkout({ slug: "pro" })}
              >
                <StarIcon className="size-5 text-white/70" />
                <span className="text-base">Upgrade to Pro</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Billing Portal"
              className="gap-x-4 h-12 px-4 rounded-xl text-white/70 transition-all duration-200"
              onClick={() => authClient.customer.portal()}
            >
              <CreditCardIcon className="size-5 text-white/70" />
              <span className="text-base">Billing Portal</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Sign out"
              className="gap-x-4 h-12 px-4 rounded-xl text-white/70 transition-all duration-200"
              onClick={() => authClient.signOut({
                fetchOptions: {
                  onSuccess: () => {
                    router.push("/login");
                  },
                },
              })}
            >
              <LogOutIcon className="size-5 text-white/70" />
              <span className="text-base">Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};
