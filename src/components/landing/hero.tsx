'use client';

import { PixelCard } from '@/components/ui/landing/pixel-card';
import { geist } from '@/lib/fonts';
import { cn } from '@/lib/utils';
import { CloudLightning, MoveRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import HomeBadge from '@/components/ui/landing/home-badge';
import { Beam } from '@/components/ui/landing/grid-beam';
import { useEffect, useState } from 'react';
import { CardHoverEffect } from '@/components/ui/landing/pulse-card';
import { motion } from 'framer-motion';
import Link from 'next/link';
import Image from 'next/image';
import { ThemeToggle } from '@/components/theme-toggle';


const PIXEL_SCRIPT_URL =
  'https://hebbkx1anhila5yf.public.blob.vercel-storage.com/pixel-RKkUKH2OXWk9adKbDnozmndkwseTQh.js';

export default function Hero() {
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  useEffect(() => {
    // Use Intersection Observer to load the script only when the component is in view
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          import('@/lib/load-script').then(({ loadScript }) => {
            loadScript(PIXEL_SCRIPT_URL)
              .then(() => {
                setIsScriptLoaded(true);
              })
              .catch((error) => {
                console.error('Error loading pixel script:', error);
              });
          });
          observer.disconnect();
        }
      },
      { threshold: 0.1 },
    );

    const heroElement = document.getElementById('hero-section');
    if (heroElement) {
      observer.observe(heroElement);
    }

    return () => {
      observer.disconnect();
    };
  }, []);

  const cards = [
    {
      title: 'Workflow Automation',
      description: 'Connect your apps and automate repetitive tasks visually.',
      icon: <CloudLightning className="h-full w-full" />,
      variant: 'rose',
      showGridLines: true,
    },
    {
      title: 'AI Native',
      description: 'Built-in AI nodes to power your workflows with LLMs.',
      icon: <Sparkles className="h-full w-full" />,
      variant: 'rose',
      showGridLines: true,
    },
  ] as const;

  const cardConfigurations = [
    {
      color: 'rose',
      icon: 'Blocks',
      label: 'Nodes',
      canvasProps: { gap: 3, speed: 80, colors: '#fff, #fda4af, #e11d48' },
      number: 400,
      desc: 'Integrations available',
    },
    {
      color: 'rose',
      icon: 'f',
      label: 'Templates',
      canvasProps: { gap: 3, speed: 80, colors: '#fff, #fda4af, #e11d48' },
      number: 1000,
      desc: 'Automation templates',
    },
  ];

  return (
    <div
      id="hero-section"
      className="bg-background relative min-h-screen w-full overflow-x-hidden py-32 md:px-6"
    >
      <div className="fixed top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      <Image
        src="https://i.postimg.cc/9FdVdN2J/vector1.webp"
        alt="Vector"
        width={300}
        draggable={false}
        height={300}
        className="absolute top-0 right-0 z-[1] object-cover object-center select-none pointer-events-none opacity-20"
      />
      <Image
        src="https://i.postimg.cc/qR6Hz1Qc/vector2.png"
        alt="Vector"
        width={300}
        height={300}
        draggable={false}
        className="absolute top-0 left-0 z-[1] object-cover object-center select-none pointer-events-none opacity-20"
      />
      
      <div className="container mx-auto px-4 2xl:max-w-[1400px] relative z-10">
        <motion.div
          className="flex justify-center"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.1 }}
        >
          <HomeBadge />
        </motion.div>
        <div className="mx-auto mt-5 max-w-5xl text-center relative">
          <div className="absolute inset-0 z-0 pointer-events-none overflow-visible">
            <Beam />
          </div>
          <motion.h1
            className={cn(
              'from-foreground/80 via-foreground to-foreground/80 dark:from-muted-foreground/60 dark:via-foreground dark:to-muted-foreground/60 max-w-5xl bg-gradient-to-r bg-clip-text text-center text-5xl font-bold tracking-tighter text-transparent sm:text-6xl xl:text-8xl/none py-4',
              geist.className,
            )}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.2 }}
          >
            Automate without
            <Image
              src="https://i.postimg.cc/Bb5yKkFF/rose.webp"
              alt="Logo"
              width={500}
              height={500}
              draggable={false}
              className="mx-6 mb-3 inline-block h-14 w-14 md:h-20 md:w-20"
            />
            limits.
          </motion.h1>
        </div>
        <motion.div
          className="mx-auto mt-5 max-w-3xl text-center"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.3 }}
        >
          <p className="text-muted-foreground text-xl md:text-2xl leading-relaxed">
            The technical workflow automation tool that lets you build complex systems 
            without fighting the framework. Open-source, flexible, and AI-ready.
          </p>
        </motion.div>
        <motion.div
          className="mt-8 flex justify-center gap-3"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.4 }}
        >
          <Link prefetch={false} href="/workflows">
            <Button size="lg" className="bg-gradient-to-b from-rose-500 to-rose-700 text-base text-white shadow-[0px_2px_0px_0px_rgba(255,255,255,0.3)_inset] px-8">
              Launch App
            </Button>
          </Link>
          <Link prefetch={false} href="/docs">
            <Button size="lg" variant={'secondary'} className="px-8">
              Read Docs <MoveRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </motion.div>
        
        <div className="mx-auto mt-24 max-w-7xl relative">
          {isScriptLoaded && (
            <motion.div
              className="bg-background absolute -top-40 -left-20 z-0 hidden h-[340px] w-[260px] 2xl:block opacity-60 hover:opacity-100 transition-opacity duration-500"
              initial={{ opacity: 0, x: -50 }}
              animate={{ opacity: 0.6, x: 0 }}
              transition={{ duration: 1, delay: 0.8 }}
            >
              <PixelCard
                key={cardConfigurations[0].label}
                label={cardConfigurations[0].label}
                canvasProps={cardConfigurations[0].canvasProps}
                number={cardConfigurations[0].number}
                icon={cardConfigurations[0].icon}
                desc={cardConfigurations[0].desc}
                color={cardConfigurations[1].color}
              />
            </motion.div>
          )}
          {isScriptLoaded && (
            <motion.div
              className="bg-background absolute -top-40 -right-20 z-0 hidden h-[340px] w-[260px] 2xl:block opacity-60 hover:opacity-100 transition-opacity duration-500"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 0.6, x: 0 }}
              transition={{ duration: 1, delay: 0.8 }}
            >
              <PixelCard
                color={cardConfigurations[1].color}
                icon={cardConfigurations[1].icon}
                key={cardConfigurations[1].label}
                label={cardConfigurations[1].label}
                canvasProps={cardConfigurations[1].canvasProps}
                number={cardConfigurations[1].number}
                desc={cardConfigurations[1].desc}
              />
            </motion.div>
          )}
          
          <main className="relative z-10 m-auto flex w-full flex-col items-center justify-center gap-12 p-6 text-left text-gray-800 sm:flex-row xl:p-4 dark:text-[#e3e3e3]">
            {cards.map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 1.25 }}
                className="w-full max-w-sm"
              >
                <CardHoverEffect
                  title={card.title}
                  description={card.description}
                  icon={card.icon}
                  variant={card.variant}
                  glowEffect={true}
                  size={'lg'}
                  showGridLines={card.showGridLines}
                />
              </motion.div>
            ))}
          </main>
        </div>
      </div>

      <Image
        src="https://i.postimg.cc/25Kfksd8/vector5.webp"
        alt="Vector"
        width={300}
        draggable={false}
        height={300}
        className="absolute bottom-0 -left-44 z-[1] -rotate-90 object-cover object-center select-none pointer-events-none opacity-10"
      />
      <Image
        src="https://i.postimg.cc/bvJhjytB/vector6.png"
        alt="Vector"
        width={300}
        draggable={false}
        height={300}
        className="absolute -right-44 bottom-0 z-[1] rotate-90 object-cover object-center select-none pointer-events-none opacity-10"
      />
    </div>
  );
}
