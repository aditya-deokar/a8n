"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { SearchIcon, PlusIcon, CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
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
import { useRouter } from "next/navigation";

export const AppHeader = () => {
  const { data, isPending } = authClient.useSession();
  const user = data?.user;
  const router = useRouter();
  return (
    <header className="flex h-20 shrink-0 items-center justify-between gap-4 px-8 bg-transparent">
      <div className="flex items-center gap-4 flex-1">
        <SidebarTrigger className="bg-white hover:bg-gray-50 shadow-sm border border-gray-100 rounded-xl" />
        <div className="relative hidden md:flex items-center w-full max-w-md">
          <SearchIcon className="absolute left-3 size-4 text-gray-400" />
          <input 
            type="text" 
            placeholder="Search workflows, clients..." 
            className="w-full bg-white h-10 pl-10 pr-4 rounded-xl text-sm border-none shadow-[0_2px_10px_rgba(0,0,0,0.02)] focus:outline-none focus:ring-2 focus:ring-[#6b62bd]/20 transition-all placeholder:text-gray-400"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center bg-white rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-1 border border-gray-50">
          <button className="px-4 py-1.5 rounded-lg bg-[#5c54a4] text-white text-sm font-medium transition-all shadow-sm">Daily</button>
          <button className="px-4 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 text-sm font-medium transition-all">Weekly</button>
          <button className="px-4 py-1.5 rounded-lg text-gray-500 hover:text-gray-900 text-sm font-medium transition-all">Monthly</button>
        </div>
        <Button variant="outline" size="icon" className="h-10 w-10 bg-white border-none shadow-[0_2px_10px_rgba(0,0,0,0.02)] rounded-xl text-gray-500 hover:text-gray-900 hidden sm:flex">
          <CalendarIcon className="size-4" />
        </Button>

        <ThemeToggle className="h-10 w-10 border-gray-100 bg-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] text-gray-500 hover:text-gray-900 rounded-xl hidden sm:flex dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300" />

        {isPending ? (
          <Skeleton className="size-10 rounded-xl" />
        ) : user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative size-10 rounded-xl p-0 hover:bg-transparent">
                <Avatar className="size-10 rounded-xl border border-gray-100 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
                  <AvatarImage src={user.image || ""} alt={user.name} />
                  <AvatarFallback className="rounded-xl bg-[#5c54a4] text-white font-medium">
                    {user.name?.charAt(0).toUpperCase() || "U"}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 rounded-xl" align="end" forceMount>
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

        <Button className="h-10 bg-[#4f46e5] hover:bg-[#4338ca] text-white rounded-xl px-4 shadow-md shadow-[#4f46e5]/20 gap-2 transition-all">
          <PlusIcon className="size-4" />
          <span>New Action</span>
        </Button>
      </div>
    </header>
  );
};
