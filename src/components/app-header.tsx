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

import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

export const AppHeader = () => {
  const [filter, setFilter] = useState("Daily");
  const [date, setDate] = useState<Date | undefined>(new Date());

  return (
    <header className="flex h-20 shrink-0 items-center justify-between gap-4 px-8 bg-transparent">
      <div className="flex items-center gap-4 flex-1">
        <div className="relative hidden md:flex items-center w-full max-w-md group">
          <SearchIcon className="absolute left-3.5 size-[1.1rem] text-gray-400 dark:text-zinc-500 group-focus-within:text-[#5c54a4] transition-colors duration-300" />
          <input 
            type="text" 
            placeholder="Search workflows, clients..." 
            className="w-full bg-gray-100/80 dark:bg-zinc-800/50 hover:bg-gray-200/50 dark:hover:bg-zinc-800/80 h-10 pl-10 pr-4 rounded-xl text-sm border border-transparent focus:border-[#5c54a4]/30 focus:bg-white dark:focus:bg-zinc-900 focus:outline-none focus:ring-[3px] focus:ring-[#5c54a4]/10 transition-all duration-300 placeholder:text-gray-500 dark:placeholder:text-zinc-500 text-gray-900 dark:text-zinc-100 shadow-none focus:shadow-sm"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden lg:flex items-center bg-white dark:bg-zinc-900 rounded-xl shadow-[0_2px_10px_rgba(0,0,0,0.02)] p-1 border border-gray-50 dark:border-zinc-800">
          {["Daily", "Weekly", "Monthly"].map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-300 ${
                filter === item
                  ? "bg-[#5c54a4] text-white shadow-sm"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-zinc-800"
              }`}
            >
              {item}
            </button>
          ))}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="h-10 w-10 bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 shadow-sm rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hidden sm:flex transition-all duration-300 hover:bg-gray-50 dark:hover:bg-zinc-800 outline-none ring-0 focus-visible:ring-0">
              <CalendarIcon className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent 
            align="end" 
            className="w-auto p-3 rounded-[1.25rem] border border-gray-200/50 dark:border-zinc-800/50 shadow-xl shadow-black/5 dark:shadow-black/20 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-zinc-950/60 z-50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-[0.96] data-[state=open]:zoom-in-[0.96] duration-200 ease-out"
          >
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              initialFocus
              className="p-0"
            />
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
};

export const AppHeaderActions = () => {
  const { data, isPending } = authClient.useSession();
  const user = data?.user;
  const router = useRouter();

  return (
    <div className="flex items-center gap-3 bg-transparent">
      <ThemeToggle className="h-10 w-10 border-gray-100 bg-white shadow-sm text-gray-500 hover:text-gray-900 rounded-xl hidden sm:flex dark:bg-zinc-900 dark:border-zinc-800 dark:text-gray-300 transition-all duration-300 hover:bg-gray-50 dark:hover:bg-zinc-800" />

      {isPending ? (
        <Skeleton className="size-10 rounded-xl" />
      ) : user ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative size-10 rounded-xl p-0 hover:bg-transparent transition-all duration-300 outline-none ring-0 focus-visible:ring-0">
              <Avatar className="size-10 rounded-xl border border-gray-100 dark:border-zinc-800 shadow-sm">
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

      <Button className="h-10 bg-[#5c54a4] hover:bg-[#4a4387] text-white rounded-xl px-4 shadow-md shadow-[#5c54a4]/20 gap-2 transition-all duration-300 hover:shadow-lg">
        <PlusIcon className="size-4" />
        <span>New Action</span>
      </Button>
    </div>
  );
};
