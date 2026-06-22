'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/theme-toggle';
import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Menu } from 'lucide-react';
import { authClient } from '@/lib/auth-client';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { data, isPending } = authClient.useSession();
  const user = data?.user;
  const router = useRouter();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className={cn(
        'fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center justify-between px-6 py-3 transition-all duration-300 w-[calc(100%-2rem)] max-w-[1400px] rounded-2xl',
        scrolled
          ? 'bg-background/80 backdrop-blur-lg border border-border/50 shadow-lg'
          : 'bg-background/30 backdrop-blur-md border border-border/20 shadow-sm'
      )}
    >
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/logos/logo.svg"
            alt="a8n logo"
            width={32}
            height={32}
            className="dark:brightness-0 dark:invert transition-all"
            style={{ width: 'auto', height: 'auto' }}
          />
          <span className="font-bold text-xl tracking-tight">a8n</span>
        </Link>
        
        <nav className="hidden md:flex items-center gap-6">
          <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Features
          </Link>
          <Link href="#integrations" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Integrations
          </Link>
          <Link href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Pricing
          </Link>
          <Link href="/docs" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
            Docs
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-3">
          <ThemeToggle className="h-10 w-10 border-gray-100 bg-white shadow-sm text-gray-500 hover:text-gray-900 rounded-xl dark:bg-zinc-900 dark:border-zinc-800 dark:text-gray-300 transition-all duration-300 hover:bg-gray-50 dark:hover:bg-zinc-800 flex" />
          {isPending ? (
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-16" />
              <Skeleton className="h-9 w-24" />
            </div>
          ) : user ? (
            <div className="flex items-center gap-3">
              <Link href="/workflows">
                <Button className="h-10 bg-[#5c54a4] hover:bg-[#4a4387] text-white rounded-xl px-4 shadow-md shadow-[#5c54a4]/20 transition-all duration-300 hover:shadow-lg border-0 text-sm font-medium">
                  Dashboard
                </Button>
              </Link>
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
                    className="text-red-500 focus:text-red-600 focus:bg-red-50 cursor-pointer"
                  >
                    Log out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost" className="h-10 rounded-xl px-4 text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all">
                  Sign In
                </Button>
              </Link>
              <Link href="/signup">
                <Button className="h-10 bg-[#5c54a4] hover:bg-[#4a4387] text-white rounded-xl px-4 shadow-md shadow-[#5c54a4]/20 transition-all duration-300 hover:shadow-lg border-0 text-sm font-medium">
                  Get Started
                </Button>
              </Link>
            </>
          )}
        </div>
        
        {/* Mobile Menu Toggle */}
        <div className="md:hidden flex items-center gap-3">
          <ThemeToggle className="h-10 w-10 border-gray-100 bg-white shadow-sm text-gray-500 hover:text-gray-900 rounded-xl dark:bg-zinc-900 dark:border-zinc-800 dark:text-gray-300 transition-all duration-300 hover:bg-gray-50 dark:hover:bg-zinc-800 flex" />
          <Button variant="outline" size="icon" className="md:hidden h-10 w-10 border-gray-100 bg-white shadow-sm text-gray-500 hover:text-gray-900 rounded-xl dark:bg-zinc-900 dark:border-zinc-800 dark:text-gray-300 transition-all duration-300 hover:bg-gray-50 dark:hover:bg-zinc-800">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </motion.header>
  );
}
