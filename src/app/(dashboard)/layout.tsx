import AppSidebar from '@/components/app-sidebar'
import { Card } from '@/components/ui/card'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import React from 'react'

const layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <SidebarProvider>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />

        <SidebarInset className="flex-1 overflow-hidden p-2 sm:p-3 md:p-2">
          <Card className="h-full w-full overflow-auto transition-all duration-300  bg-accent/20 border-none backdrop-blur-sm">
            {/* <div className="p-4 sm:p-6 md:p-8"> */}
              {children}
            {/* </div> */}
          </Card>
        </SidebarInset>
      </div>
    </SidebarProvider>
  )
}

export default layout
