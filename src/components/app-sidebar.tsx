"use client"

import { FolderOpenIcon, HistoryIcon, KeyIcon, ArrowRight, Crown, CreditCard, LogOut, ChevronUp, UserIcon } from "lucide-react"
import { 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupContent, 
  SidebarGroupLabel,
  SidebarHeader, 
  SidebarMenuButton, 
  SidebarMenuItem,
  SidebarMenu,
  SidebarFooter
} from "./ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { authClient } from "@/lib/auth-client"
import { useHasActiveSubscription } from "@/features/subscriptions/hooks/use-subscription"

const menuItems = [
  {
    title: "Main",
    items: [
      {
        title: "Workflows",
        icon: FolderOpenIcon,
        url: "/workflows",
        shortcut: "⌘W"
      },
      {
        title: "Credentials",
        icon: KeyIcon,
        url: "/credentials",
        shortcut: "⌘C"
      },
      {
        title: "Executions",
        icon: HistoryIcon,
        url: "/executions",
        shortcut: "⌘E"
      },
    ]
  }
]

const AppSidebar = () => {
  const pathname = usePathname();
  const router = useRouter();

  const { hasActiveSubscription , isLoading } = useHasActiveSubscription()
  

  return (
    <Sidebar variant="floating" collapsible="icon" className="">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              asChild 
              className="gap-x-4 h-12 px-4 hover:bg-accent hover:text-accent-foreground transition-all duration-200"
            >
              <Link href="/" prefetch>
                <div className="flex items-center justify-center size-8 rounded-lg bg-primary text-primary-foreground">
                  <Image 
                    src="/logos/logo.svg" 
                    alt="n8n logo" 
                    width={20} 
                    height={20}
                    priority
                  />
                </div>
                <span className="font-bold text-base">n8n</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {menuItems.map((group) => (
          <SidebarGroup key={group.title}>
            <SidebarGroupLabel className="text-xs uppercase tracking-wider text-muted-foreground">
              {group.title}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = pathname === item.url
                  
                  return (
                    <SidebarMenuItem key={item.title} className="group/item">
                      <SidebarMenuButton
                        tooltip={{
                          children: (
                            <div className="flex flex-col gap-1">
                              <span className="font-medium">{item.title}</span>
                              {item.shortcut && (
                                <span className="text-xs text-muted-foreground">
                                  {item.shortcut}
                                </span>
                              )}
                            </div>
                          ),
                          side: "right"
                        }}
                        isActive={isActive}
                        asChild
                        className={cn(
                          "gap-x-3 h-10 px-3 transition-all duration-300 ease-out",
                          "hover:bg-accent hover:text-accent-foreground",
                          "relative overflow-hidden",
                          isActive && "bg-accent text-accent-foreground font-medium"
                        )}
                      >
                        <Link href={item.url} prefetch>
                          <item.icon 
                            className={cn(
                              "size-4 transition-transform duration-300",
                              "group-hover/item:-translate-x-1",
                              isActive && "text-primary"
                            )} 
                          />
                          <span className="flex-1">{item.title}</span>

                          {/* Stacked Arrow Animation - Agency Style */}
                          <div className="relative size-4 overflow-hidden">
                            {/* First Arrow - slides out */}
                            <ArrowRight 
                              className={cn(
                                "absolute size-4 transition-all duration-300 ease-out",
                                "translate-x-0 opacity-100",
                                "group-hover/item:-translate-x-6 group-hover/item:opacity-0"
                              )} 
                            />
                            
                            {/* Second Arrow - slides in */}
                            <ArrowRight 
                              className={cn(
                                "absolute size-4 transition-all duration-300 ease-out",
                                "translate-x-6 opacity-0",
                                "group-hover/item:translate-x-0 group-hover/item:opacity-100"
                              )} 
                            />
                          </div>

                          {/* Active indicator line */}
                          {isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-primary rounded-r-full" />
                          )}
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t">
        <SidebarMenu>
         {/* Upgrade to Pro Button */}
         {!hasActiveSubscription && !isLoading && (
             <SidebarMenuItem>
            <SidebarMenuButton 
              className="gap-x-3 h-10 px-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-medium transition-all duration-200 group/upgrade"
              onClick={() => authClient.checkout({ slug: "n8n"})}
            >
              <Crown className="size-4 transition-transform duration-200 group-hover/upgrade:scale-110" />
              <span>Upgrade to Pro</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
         )}
         

          {/* User Profile with Dropdown */}
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton 
                  className="gap-x-3 h-auto py-2 px-3 hover:bg-accent hover:text-accent-foreground transition-all duration-200"
                >
                  <div className="flex items-center justify-center size-8 rounded-full from-purple-500 to-pink-500 text-white font-semibold">
                    U
                  </div>
                  <div className="flex flex-col items-start flex-1 min-w-0">
                    <span className="text-sm font-medium truncate w-full">User Name</span>
                    <span className="text-xs text-muted-foreground truncate w-full">user@email.com</span>
                  </div>
                  <ChevronUp className="size-4 ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                side="top" 
                align="end"
                className="w-56"
              >
                <DropdownMenuItem 
                  className="gap-2 cursor-pointer"
                  onClick={() => {/* Handle billing */}}
                >
                  <UserIcon className="size-4" />
                  <span>Profile</span>
                </DropdownMenuItem>

                <DropdownMenuItem 
                  className="gap-2 cursor-pointer"
                  onClick={() => authClient.customer.portal()}
                >
                  <CreditCard className="size-4" />
                  <span>Billing Portal</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="gap-2 cursor-pointer text-destructive focus:text-destructive"
                  onClick={() => authClient.signOut({
                    fetchOptions:{
                        onSuccess:()=>{
                            router.push('/login')
                        }
                    }
                  })}
                >
                  <LogOut className="size-4" />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}

export default AppSidebar
