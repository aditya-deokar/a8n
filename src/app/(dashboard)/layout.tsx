import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"

const Layout = ({ children }: { children: React.ReactNode; }) => {
  return (
    <SidebarProvider className="bg-[#e4e5f1] p-2 gap-2 font-sans">
      <AppSidebar />
      <SidebarInset className="bg-[#f6f8fb] rounded-[1.5rem] overflow-hidden flex-1 border-4 border-white/40 shadow-sm m-0">
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
};

export default Layout;
