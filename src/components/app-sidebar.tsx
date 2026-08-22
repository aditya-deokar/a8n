"use client";

import {
  BotIcon,
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
import { useEntitlementSnapshot } from "@/features/subscriptions/hooks/use-entitlement-snapshot";

function formatResetDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return null;
  }
}

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
      {
        title: "Agent",
        icon: BotIcon,
        url: "/agent",
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
              <Image src="/logos/logo.svg" alt="a8n" width={32} height={32} className="brightness-0 invert" style={{ width: 'auto', height: 'auto' }} />
              <span className="font-bold text-xl tracking-tight">a8n</span>
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
        <UsageMeter onUpgrade={() => authClient.checkout({ slug: "pro" })} />
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

// ─── Usage meter + grandfathered banner ─────────────────────

interface UsageMeterProps {
  onUpgrade: () => void;
}

function UsageMeter({ onUpgrade }: UsageMeterProps) {
  const { data: snapshot, isError, isLoading } = useEntitlementSnapshot();

  // Meters are cosmetic — render nothing while loading or on errors so a
  // billing hiccup never breaks the sidebar.
  if (isLoading || isError || !snapshot) return null;

  const rows: Array<{ label: string; used: number; limit: number | null }> = [
    { label: "Workflows", used: snapshot.workflows.used, limit: snapshot.workflows.limit },
    { label: "Credentials", used: snapshot.credentials.used, limit: snapshot.credentials.limit },
    { label: "Chats", used: snapshot.chats.used, limit: snapshot.chats.limit },
  ].filter((row) => row.limit !== null);

  const resetLabel = formatResetDate(snapshot.chats.windowResetAt);
  const isOverWorkflowLimit =
    snapshot.workflows.limit !== null &&
    snapshot.workflows.used > snapshot.workflows.limit;

  return (
    <div className="mb-3 rounded-xl bg-white/10 px-3 py-2.5 text-white">
      <div className="space-y-1.5">
        {rows.map((row) => {
          const atLimit = row.limit !== null && row.used >= row.limit;
          const overLimit = row.limit !== null && row.used > row.limit;
          return (
            <div
              key={row.label}
              className="flex items-center justify-between text-[11px] leading-none"
            >
              <span className={overLimit ? "font-medium text-amber-200" : "text-white/80"}>
                {row.label}
              </span>
              <span
                className={`tabular-nums ${
                  overLimit
                    ? "text-amber-300 font-medium"
                    : atLimit
                      ? "text-rose-200 font-medium"
                      : "text-white/70"
                }`}
              >
                {row.used}
                {row.limit !== null ? `/${row.limit}` : ""}
              </span>
            </div>
          );
        })}
      </div>

      {resetLabel && (
        <p className="mt-1.5 text-[10px] leading-none text-white/50">
          Chats reset {resetLabel}
        </p>
      )}

      {isOverWorkflowLimit && (
        <button
          type="button"
          onClick={onUpgrade}
          className="mt-2 w-full rounded-lg bg-amber-400/90 px-2 py-1.5 text-left text-[10px] font-medium leading-tight text-amber-950 transition-colors hover:bg-amber-300"
        >
          You have {snapshot.workflows.used} of {snapshot.workflows.limit}{" "}
          workflows. Delete some, or resubscribe to create new ones.
        </button>
      )}
    </div>
  );
}
