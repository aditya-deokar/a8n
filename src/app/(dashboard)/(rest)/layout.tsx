import { AppHeader, AppHeaderActions } from "@/components/app-header";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { MobileBottomNav } from "@/components/mobile-bottom-nav";

const Layout = ({ children }: { children: React.ReactNode; }) => {
  return (
    <>
      <header className="hidden md:flex items-center justify-between gap-3 px-4 sm:px-6 py-3 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-gray-100 dark:border-zinc-800 sticky top-0 z-50 shrink-0">
        <SidebarTrigger className="hidden md:flex size-10 bg-transparent shadow-none border-none hover:bg-gray-100 dark:hover:bg-zinc-800 [&>svg]:size-5 shrink-0" />
        <div className="flex-1 min-w-0 md:ml-0 -ml-2">
          <AppHeader />
        </div>
        <div className="shrink-0">
          <AppHeaderActions />
        </div>
      </header>
      <main className="flex-1 overflow-hidden min-h-0 flex flex-col">
        {children}
      </main>
      <MobileBottomNav />
    </>
  );
};

export default Layout;
