import { AppHeader, AppHeaderActions } from "@/components/app-header";
import { SidebarTrigger } from "@/components/ui/sidebar";

const Layout = ({ children }: { children: React.ReactNode; }) => {
  return (
    <>
      <div className="flex items-stretch gap-2 shrink-0">
        <div className="bg-[#f6f8fb] dark:bg-zinc-900 rounded-[1.5rem] border-4 border-white/40 dark:border-zinc-800/40 shadow-sm flex items-center justify-center px-6 shrink-0">
          <SidebarTrigger className="bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 shadow-sm border border-gray-100 dark:border-zinc-800 rounded-xl size-10 [&>svg]:size-5" />
        </div>
        <div className="bg-[#f6f8fb] dark:bg-zinc-900 rounded-[1.5rem] border-4 border-white/40 dark:border-zinc-800/40 shadow-sm flex-1">
          <AppHeader />
        </div>
        <div className="bg-[#f6f8fb] dark:bg-zinc-900 rounded-[1.5rem] border-4 border-white/40 dark:border-zinc-800/40 shadow-sm flex items-center justify-center px-6 shrink-0">
          <AppHeaderActions />
        </div>
      </div>
      <main className="bg-[#f6f8fb] dark:bg-zinc-900 rounded-[1.5rem] border-4 border-white/40 dark:border-zinc-800/40 shadow-sm flex-1 overflow-auto">
        {children}
      </main>
    </>
  );
};

export default Layout;
