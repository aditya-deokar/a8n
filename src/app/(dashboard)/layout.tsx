import AppSidebar from '@/components/app-sidebar'
import { Card } from '@/components/ui/card'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import React from 'react'

const SIDEBAR_WIDTH = "16rem"

const layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">

        <AppSidebar />

        <SidebarInset className="bg-accent/20">
         
              {children}
         
        </SidebarInset>

      </div>
    </SidebarProvider>
  )
}

export default layout
