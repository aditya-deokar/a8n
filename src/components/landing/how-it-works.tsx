'use client';

import { motion, useScroll, useSpring, useTransform } from 'framer-motion';
import { useRef } from 'react';
import { geist } from '@/lib/fonts';
import { cn } from '@/lib/utils';
import { Link, MousePointer2, Rocket, ArrowRight, Zap, CheckCircle2, Globe } from 'lucide-react';
import Image from 'next/image';

const steps = [
  {
    step: '01',
    title: 'Connect',
    description: 'Set up triggers like manual starts, Stripe events, or Google Forms. Connect your data sources and external services in a single click.',
    icon: Link,
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/10',
    borderColor: 'border-rose-500/20',
    glow: 'from-rose-500/20 to-transparent'
  },
  {
    step: '02',
    title: 'Orchestrate',
    description: 'Use our powerful visual editor to link triggers to AI models, HTTP requests, or messaging platforms. Build complex logic with zero code.',
    icon: MousePointer2,
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
    borderColor: 'border-violet-500/20',
    glow: 'from-violet-500/20 to-transparent'
  },
  {
    step: '03',
    title: 'Deploy',
    description: 'Execute with confidence. Nodebase handles the reliability, scaling, and real-time monitoring. Your workflows never fail silently.',
    icon: Rocket,
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/20',
    glow: 'from-blue-500/20 to-transparent'
  },
];

export default function HowItWorks() {
  const containerRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const scaleY = useSpring(scrollYProgress, {
    stiffness: 100,
    damping: 30,
    restDelta: 0.001
  });

  return (
    <section id="how-it-works" ref={containerRef} className="py-24 sm:py-32 bg-black relative overflow-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
         <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-[radial-gradient(circle,rgba(255,255,255,0.03)_0%,transparent_70%)]" />
      </div>

      <div className="container mx-auto px-4 relative">
        <div className="text-center mb-20">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className={cn(
              "text-4xl md:text-7xl font-bold tracking-tighter text-white mb-6",
              geist.className
            )}>
              Simple Process, <br /> Industrial Power.
            </h2>
            <p className="text-zinc-500 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              Transitioning from idea to production-ready automation has never been this fluid.
            </p>
          </motion.div>
        </div>

        <div className="relative max-w-5xl mx-auto">
          {/* Connecting Line */}
          <div className="absolute left-[21px] md:left-1/2 md:-translate-x-1/2 top-0 bottom-0 w-[2px] bg-zinc-900 overflow-hidden">
            <motion.div 
              className="w-full h-full bg-gradient-to-b from-rose-500 via-violet-500 to-blue-500 origin-top"
              style={{ scaleY }}
            />
          </div>

          <div className="space-y-24 md:space-y-32">
            {steps.map((step, idx) => (
              <div key={idx} className={cn(
                "relative flex flex-col md:flex-row items-start md:items-center gap-12 md:gap-24",
                idx % 2 === 1 ? "md:flex-row-reverse" : ""
              )}>
                
                {/* Step Indicator Dot */}
                <div className="absolute left-0 md:left-1/2 md:-translate-x-1/2 w-11 h-11 rounded-full bg-black border-2 border-zinc-800 flex items-center justify-center z-20">
                   <div className={cn("w-2 h-2 rounded-full", step.color.replace('text-', 'bg-'))} />
                </div>

                {/* Content Area */}
                <motion.div 
                  className="flex-1 pl-16 md:pl-0"
                  initial={{ opacity: 0, x: idx % 2 === 1 ? 50 : -50 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8, delay: 0.1 }}
                >
                  <div className="relative p-8 rounded-3xl border border-white/5 bg-zinc-950/50 backdrop-blur-xl group hover:border-white/10 transition-colors">
                    <div className={cn(
                      "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-10 transition-opacity duration-500 rounded-[inherit]",
                      step.glow
                    )} />
                    
                    <div className="flex items-center gap-4 mb-6">
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", step.bgColor)}>
                        <step.icon className={cn("w-6 h-6", step.color)} />
                      </div>
                      <div className="text-sm font-mono text-zinc-600 tracking-widest uppercase">Step {step.step}</div>
                    </div>
                    
                    <h3 className="text-3xl font-bold text-white mb-4">{step.title}</h3>
                    <p className="text-zinc-500 text-lg leading-relaxed mb-6 group-hover:text-zinc-400 transition-colors">
                      {step.description}
                    </p>
                    
                    <ul className="space-y-3">
                      {[1, 2].map((_, i) => (
                        <li key={i} className="flex items-center gap-3 text-sm text-zinc-600">
                          <CheckCircle2 className={cn("w-4 h-4", step.color)} />
                          <span>Enterprise-grade {step.title.toLowerCase()} support</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </motion.div>

                {/* Visual/Image Area */}
                <motion.div 
                  className="flex-1 w-full"
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, margin: "-100px" }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                >
                  <div className="relative aspect-video rounded-3xl overflow-hidden border border-white/5 bg-zinc-900 group">
                    <Image 
                      src="/images/how-it-works.png" 
                      alt={step.title}
                      fill
                      className="object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    
                    {/* Abstract Overlay to make it feel custom for each step */}
                    <div className={cn(
                       "absolute inset-0 mix-blend-overlay opacity-30 group-hover:opacity-50 transition-opacity",
                       step.glow.replace('from-', 'bg-')
                    )} />
                  </div>
                </motion.div>

              </div>
            ))}
          </div>

          <motion.div 
            className="mt-24 md:mt-32 text-center"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <button className="px-8 py-4 rounded-full bg-white text-black font-bold text-lg hover:bg-zinc-200 transition-colors flex items-center gap-2 mx-auto group">
              Start Building Now <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
            </button>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
