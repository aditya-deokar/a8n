import Image from "next/image";
import Link from "next/link";

export const AuthLayout = ({ children }: { children: React.ReactNode; }) => {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <Link href="/" className="flex items-center gap-2 font-medium">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
              <Image src="/logos/logo.svg" alt="a8n" width={20} height={20} className="invert dark:invert-0" style={{ width: 'auto', height: 'auto' }} />
            </div>
            <span className="text-xl font-bold tracking-tight">a8n</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-sm">
            {children}
          </div>
        </div>
      </div>
      <div className="relative hidden bg-muted lg:block border-l overflow-hidden">
        <div className="absolute inset-0 h-full w-full bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] dark:bg-[radial-gradient(#1f2937_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div>
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent"></div>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent"></div>
        <div className="flex items-center justify-center h-full flex-col gap-6 relative z-10 px-10">
          <div className="p-8 rounded-2xl bg-background/40 backdrop-blur-md border border-white/10 shadow-2xl max-w-md relative overflow-hidden">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-primary/20 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-32 h-32 bg-blue-500/20 rounded-full blur-3xl"></div>
            
            <h2 className="text-3xl font-bold mb-4 tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-foreground to-foreground/70">
              Automate your workflow, seamlessly.
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed relative z-10">
              Connect your favorite apps and automate repetitive tasks without writing a single line of code. Join thousands of builders making magic happen.
            </p>
            <div className="mt-8 flex items-center gap-4 relative z-10">
              <div className="flex -space-x-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="w-10 h-10 rounded-full border-2 border-background bg-muted flex items-center justify-center overflow-hidden shadow-sm">
                    <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`} alt="Avatar" width={40} height={40} />
                  </div>
                ))}
              </div>
              <div className="text-sm font-medium flex flex-col">
                <span className="text-foreground font-semibold">10,000+</span>
                <span className="text-muted-foreground text-xs">Active users</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
