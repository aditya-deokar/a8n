'use client';

import { useTheme } from 'next-themes';
import Globe from '@/components/ui/landing/globe';
import ScrambleHover from '@/components/ui/landing/scramble';
import { motion, useInView } from 'framer-motion';
import { Suspense, useEffect, useRef, useState } from 'react';
import { geist } from '@/lib/fonts';
import { cn } from '@/lib/utils';
import Image from 'next/image';

export default function Features() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, amount: 0.2 });
  const { theme } = useTheme();
  const [isHovering, setIsHovering] = useState(false);

  const [baseColor, setBaseColor] = useState<[number, number, number]>(
    theme === 'dark' ? [1, 0, 0.3] : [1, 1, 1],
  );

  const [glowColor, setGlowColor] = useState<[number, number, number]>(
    theme === 'dark' ? [1, 0, 0.4] : [1, 0.3, 0.4],
  );

  const [dark, setDark] = useState<number>(theme === 'dark' ? 1 : 0);

  useEffect(() => {
    if (theme === 'dark') {
      setBaseColor([1, 0, 0.3]);
      setDark(1);
      setGlowColor([1, 0, 0.4]);
    } else {
      setBaseColor([1, 1, 1]);
      setDark(0);
      setGlowColor([1, 0.3, 0.4]);
    }
  }, [theme]);

  return (
    <section
      id="features"
      className="text-foreground relative overflow-hidden py-24 sm:py-32"
    >
      <div className="bg-rose-500 absolute -top-10 left-1/2 h-16 w-44 -translate-x-1/2 rounded-full opacity-20 blur-3xl select-none"></div>
      
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 50 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
        transition={{ duration: 0.75 }}
        className="container mx-auto px-4"
      >
        <div className="flex flex-col items-center mb-16">
          <h2
            className={cn(
              'bg-gradient-to-b from-white to-zinc-500 bg-clip-text text-center text-4xl font-bold tracking-tighter text-transparent md:text-6xl',
              geist.className,
            )}
          >
            Powerful Automation
          </h2>
          <p className="text-muted-foreground mt-4 text-center text-lg max-w-2xl">
            Everything you need to build, deploy, and scale your workflows 
            with enterprise-grade reliability and open-source flexibility.
          </p>
        </div>

        <div className="grid grid-cols-12 gap-6">
          {/* Feature 1: Visual Builder */}
          <motion.div
            className="group border-zinc-800/50 bg-zinc-900/20 backdrop-blur-sm text-card-foreground relative col-span-12 flex flex-col overflow-hidden rounded-3xl border p-8 shadow-2xl transition-all md:col-span-6 xl:col-span-4"
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <div className="z-10 flex flex-col gap-4">
              <h3 className="text-2xl font-bold tracking-tight">
                🎨 Visual Workflow Builder
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Design complex logic visually. Connect nodes, handle errors, 
                and transform data without writing a single line of code.
              </p>
            </div>
            <div className="mt-8 relative h-64 w-full flex items-center justify-center">
               <div className="absolute inset-0 bg-gradient-to-t from-rose-500/10 to-transparent rounded-2xl" />
               <Image 
                 src="https://i.postimg.cc/L6NQFz3m/mobile-dark.webp" 
                 alt="UI Preview" 
                 width={200} 
                 height={400} 
                 className="rounded-t-xl shadow-2xl transform group-hover:scale-105 transition-transform duration-500"
               />
            </div>
          </motion.div>

          {/* Feature 2: 400+ Integrations */}
          <motion.div
            className="group border-zinc-800/50 bg-zinc-900/20 backdrop-blur-sm text-card-foreground relative col-span-12 flex flex-col overflow-hidden rounded-3xl border p-8 shadow-2xl transition-all md:col-span-6 xl:col-span-4"
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <div className="flex flex-col gap-4">
              <h3 className="text-2xl font-bold tracking-tight">
                🛠️ 400+ Integrations
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Connect to any app with a REST API. We support everything from 
                Slack and Discord to enterprise tools like Salesforce.
              </p>
            </div>
            <div className="mt-12 grid grid-cols-3 gap-4 opacity-40 group-hover:opacity-100 transition-opacity duration-500">
               {[1, 2, 3, 4, 5, 6].map((i) => (
                 <div key={i} className="aspect-square bg-zinc-800/50 rounded-xl border border-white/5 flex items-center justify-center">
                    <div className="w-8 h-8 bg-rose-500/20 rounded-full animate-pulse" />
                 </div>
               ))}
            </div>
          </motion.div>

          {/* Feature 3: Global Scale */}
          <motion.div
            className="group border-zinc-800/50 bg-zinc-900/20 backdrop-blur-sm text-card-foreground relative col-span-12 flex flex-col overflow-hidden rounded-3xl border p-8 shadow-2xl transition-all md:col-span-12 xl:col-span-4"
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <div className="flex flex-col gap-4">
              <h3 className="text-2xl font-bold tracking-tight">
                🌍 Deploy Anywhere
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Self-host on your own infrastructure or use our managed cloud. 
                Keep your data secure and compliant.
              </p>
            </div>
            <div className="flex min-h-[300px] flex-col items-center justify-center relative">
              <h4 className="mt-8 text-3xl font-bold">
                <ScrambleHover
                  text="a8n.cloud"
                  scrambleSpeed={50}
                  maxIterations={15}
                  className="bg-gradient-to-t from-rose-400 to-rose-600 bg-clip-text text-transparent"
                  isHovering={isHovering}
                  setIsHovering={setIsHovering}
                />
              </h4>
              <div className="mt-4">
                <Suspense fallback={<div className="h-48 w-48 animate-pulse bg-zinc-800 rounded-full" />}>
                  <Globe
                    baseColor={baseColor}
                    glowColor={glowColor}
                    dark={dark}
                  />
                </Suspense>
              </div>
            </div>
          </motion.div>
        </div>
      </motion.div>
    </section>
  );
}
