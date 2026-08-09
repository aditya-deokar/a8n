"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { FolderOpenIcon, KeyIcon, HistoryIcon, ServerIcon, BotIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const menuItems = [
  { title: "Workflows", icon: FolderOpenIcon, url: "/workflows" },
  { title: "Credentials", icon: KeyIcon, url: "/credentials" },
  { title: "Executions", icon: HistoryIcon, url: "/executions" },
  { title: "MCP Server", icon: ServerIcon, url: "/mcp" },
  { title: "Agent", icon: BotIcon, url: "/agent" },
];

export const MobileBottomNav = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { data, isPending } = authClient.useSession();
  const user = data?.user;

  return (
    <div className="md:hidden flex items-center justify-between px-4 py-2.5 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-t border-gray-100 dark:border-zinc-800 sticky bottom-0 z-50 shrink-0 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] safe-area-bottom">
      {menuItems.map((item) => {
        const isActive = pathname.startsWith(item.url);
        return (
          <Link 
            key={item.title} 
            href={item.url} 
            prefetch
            className={cn(
              "flex flex-col items-center gap-1 min-w-[56px] transition-colors duration-200", 
              isActive ? "text-[#5c54a4] dark:text-indigo-400" : "text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300"
            )}
          >
            <item.icon className="size-5" />
            <span className="text-[10px] font-medium tracking-tight">{item.title}</span>
          </Link>
        )
      })}
      
      {/* Profile Icon / Menu */}
      <div className="flex flex-col items-center gap-1 min-w-[56px]">
        {isPending ? (
          <Skeleton className="size-5 rounded-full" />
        ) : user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="outline-none ring-0 focus-visible:ring-0 flex items-center justify-center">
                <Avatar className="size-5 border border-gray-200 dark:border-zinc-700 shadow-sm">
                  <AvatarImage src={user.image || ""} alt={user.name} />
                  <AvatarFallback className="bg-[#5c54a4] text-white font-medium text-[9px]">
                    {user.name?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 rounded-xl mb-2" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user.name}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={() => authClient.signOut({
                  fetchOptions: {
                    onSuccess: () => {
                      router.push("/login");
                    },
                  },
                })}
                className="text-red-500 focus:text-red-600 focus:bg-red-50"
              >
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <span className="text-[10px] font-medium tracking-tight text-gray-400 dark:text-zinc-500">Profile</span>
      </div>
    </div>
  );
};
