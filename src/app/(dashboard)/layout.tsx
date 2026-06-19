import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

const Layout = ({ children }: { children: React.ReactNode; }) => {
  return (
    <SidebarProvider className="bg-[#e4e5f1] dark:bg-zinc-950 p-2 gap-2 font-sans h-screen overflow-hidden">
      <AppSidebar />
      <SidebarInset className="bg-transparent flex flex-col gap-2 m-0 overflow-hidden min-h-0">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Layout;
