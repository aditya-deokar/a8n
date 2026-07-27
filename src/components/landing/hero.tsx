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
import { reportClientError } from '@/lib/client-logging';


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
                reportClientError(error, {
                  source: 'landing_pixel_script',
                });
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
      variant: 'primary',
      showGridLines: true,
    },
    {
      title: 'AI Native',
      description: 'Built-in AI nodes to power your workflows with LLMs.',
      icon: <Sparkles className="h-full w-full" />,
      variant: 'primary',
      showGridLines: true,
    },
  ] as const;

  const cardConfigurations = [
    {
      color: 'primary',
      icon: 'Blocks',
      label: 'Nodes',
      canvasProps: { gap: 3, speed: 80, colors: '#fff, #9187ce, #5c54a4' },
      number: 12,
      desc: 'Integrations available',
    },
    {
      color: 'primary',
      icon: 'f',
      label: 'Templates',
      canvasProps: { gap: 3, speed: 80, colors: '#fff, #9187ce, #5c54a4' },
      number: 2,
      desc: 'Automation templates',
    },
  ];

  return (
    <div
      id="hero-section"
      className="bg-transparent relative min-h-screen w-full overflow-x-hidden pt-24 sm:pt-32 pb-16 px-4 sm:px-6"
    >

      <Image
        unoptimized
        src="https://i.postimg.cc/9FdVdN2J/vector1.webp"
        alt="Vector"
        width={300}
        height={300}
        draggable={false}
        className="absolute top-0 right-0 z-[1] object-cover object-center select-none pointer-events-none opacity-20"
        style={{ 
          width: 'auto', 
          height: 'auto', 
          filter: 'hue-rotate(-90deg)',
          maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)'
        }}
      />
      <Image
        unoptimized
        src="https://i.postimg.cc/qR6Hz1Qc/vector2.png"
        alt="Vector"
        width={300}
        height={300}
        draggable={false}
        priority
        className="absolute top-0 left-0 z-[1] object-cover object-center select-none pointer-events-none opacity-20"
        style={{ 
          width: 'auto', 
          height: 'auto', 
          filter: 'hue-rotate(-90deg)',
          maskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to bottom, black 50%, transparent 100%)'
        }}
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
              'from-foreground/80 via-foreground to-foreground/80 dark:from-muted-foreground/60 dark:via-foreground dark:to-muted-foreground/60 max-w-5xl bg-gradient-to-r bg-clip-text text-center text-4xl sm:text-5xl md:text-6xl xl:text-8xl/none font-bold tracking-tighter text-transparent py-4',
              geist.className,
            )}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.75, delay: 0.2 }}
          >
            Automate without
            <svg
              viewBox="0 0 100 100"
              className="mx-1 sm:mx-2 md:mx-4 mb-1 sm:mb-2 inline-block h-10 w-10 sm:h-14 sm:w-14 md:h-20 md:w-20"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <linearGradient id="heroWg1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#5c54a4" />
                  <stop offset="100%" stopColor="#9187ce" />
                </linearGradient>
                <filter id="heroGlowIcon" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
              <g filter="url(#heroGlowIcon)">
                <path d="M 20 50 L 50 20 L 80 50 L 50 80 Z" stroke="url(#heroWg1)" strokeWidth="2" strokeDasharray="4 4" className="animate-[pulse_3s_ease-in-out_infinite]" />
                <path d="M 20 50 L 80 50 M 50 20 L 50 80" stroke="url(#heroWg1)" strokeWidth="2" opacity="0.6" />
                <circle cx="20" cy="50" r="6" fill="#9187ce" />
                <circle cx="80" cy="50" r="6" fill="#9187ce" />
                <circle cx="50" cy="20" r="6" fill="#5c54a4" />
                <circle cx="50" cy="80" r="6" fill="#5c54a4" />
                <rect x="38" y="38" width="24" height="24" rx="4" fill="url(#heroWg1)" className="animate-[spin_8s_linear_infinite]" style={{ transformOrigin: '50px 50px' }} />
                <circle cx="50" cy="50" r="4" fill="#ffffff" />
              </g>
            </svg>
            limits.
          </motion.h1>
        </div>

        <motion.div
          className="mx-auto mt-2 max-w-3xl text-center"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.3 }}
        >
          <p className="text-muted-foreground text-sm sm:text-base md:text-lg max-w-3xl leading-relaxed">
            The technical workflow automation tool that lets you build complex systems
            without fighting the framework. Open-source, flexible, and AI-ready.
          </p>
        </motion.div>

        <motion.div
          className="mt-6 flex flex-col sm:flex-row justify-center gap-3 w-full max-w-md mx-auto sm:max-w-none"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.75, delay: 0.4 }}
        >
          <Link prefetch={false} href="/workflows" className="w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto bg-gradient-to-b from-[#5c54a4] to-[#9187ce] hover:opacity-90 text-base text-primary-foreground shadow-[0px_2px_0px_0px_rgba(255,255,255,0.3)_inset] px-8 border-0">
              Launch App
            </Button>
          </Link>
          <Link prefetch={false} href="/docs" className="w-full sm:w-auto">
            <Button size="lg" variant={'secondary'} className="w-full sm:w-auto px-8">
              Read Docs <MoveRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </motion.div>

        {/* Cards Section */}
        <div className="mx-auto mt-8 sm:mt-10 max-w-7xl relative flex flex-col items-center">
          
          {/* Mobile PixelCards Container (Side-by-side) */}
          {isScriptLoaded && (
            <div className="relative z-10 flex w-full flex-row justify-center gap-3  pb-4 mb-0 2xl:hidden">
              <motion.div
                className="bg-background h-[200px] w-[165px] rounded-2xl overflow-hidden shadow-lg opacity-100 relative"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.6 }}
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
              <motion.div
                className="bg-background h-[200px] w-[165px] rounded-2xl overflow-hidden shadow-lg opacity-100 relative"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.7 }}
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
            </div>
          )}

          {/* Desktop Absolute PixelCards */}
          {isScriptLoaded && (
            <motion.div
              className="bg-background absolute -top-20 -left-10 z-0 hidden h-[280px] w-[220px] 2xl:block opacity-60 hover:opacity-100 transition-opacity duration-500 rounded-2xl overflow-hidden"
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
              className="bg-background absolute -top-20 -right-10 z-0 hidden h-[280px] w-[220px] 2xl:block opacity-60 hover:opacity-100 transition-opacity duration-500 rounded-2xl overflow-hidden"
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

          {/* Main Cards Vertical Stack on Mobile, Horizontal on Desktop */}
          <div className="relative z-10 m-auto flex w-full flex-col items-center justify-center gap-3 sm:gap-8 px-4 pb-4 pt-0 text-left text-gray-800 sm:flex-row xl:p-4 dark:text-[#e3e3e3]">
            {cards.map((card, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 1.25 }}
                className="w-full max-w-[342px] sm:max-w-[300px]"
              >
                <CardHoverEffect
                  title={card.title}
                  description={card.description}
                  icon={card.icon}
                  variant={card.variant}
                  glowEffect={true}
                  size={'sm'}
                  showGridLines={card.showGridLines}
                  className="px-4 sm:px-6 sm:py-6 sm:pt-12"
                />
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <Image
        unoptimized
        src="https://i.postimg.cc/25Kfksd8/vector5.webp"
        alt="Vector"
        width={300}
        height={300}
        draggable={false}
        className="absolute bottom-0 -left-44 z-[1] -rotate-90 object-cover object-center select-none pointer-events-none opacity-10"
        style={{ 
          width: 'auto', 
          height: 'auto', 
          filter: 'hue-rotate(-90deg)',
          maskImage: 'linear-gradient(to top, black 50%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, black 50%, transparent 100%)'
        }}
      />
      <Image
        unoptimized
        src="https://i.postimg.cc/bvJhjytB/vector6.png"
        alt="Vector"
        width={300}
        height={300}
        draggable={false}
        className="absolute -right-44 bottom-0 z-[1] rotate-90 object-cover object-center select-none pointer-events-none opacity-10"
        style={{ 
          width: 'auto', 
          height: 'auto', 
          filter: 'hue-rotate(-90deg)',
          maskImage: 'linear-gradient(to top, black 50%, transparent 100%)',
          WebkitMaskImage: 'linear-gradient(to top, black 50%, transparent 100%)'
        }}
      />
    </div>
  );
}
