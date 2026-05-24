'use client';

import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function HomeBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "group relative flex items-center gap-2 rounded-full px-4 py-1.5",
        "bg-white/10 backdrop-blur-md border border-white/20 shadow-xl",
        "dark:bg-black/20 dark:border-white/10"
      )}
    >
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-rose-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <Sparkles className="h-3.5 w-3.5 text-rose-500 animate-pulse" />
      <span className="text-xs font-medium tracking-wide text-zinc-800 dark:text-zinc-200">
        Introducing a8n Advanced
      </span>
      <div className="h-3 w-[1px] bg-zinc-300 dark:bg-zinc-700 mx-1" />
      <span className="text-xs text-rose-600 dark:text-rose-400 font-semibold">
        Build faster →
      </span>
    </motion.div>
  );
}
