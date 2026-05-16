'use client';

import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useRef, useState, useEffect, MouseEvent } from 'react';
import { geist } from '@/lib/fonts';
import { cn } from '@/lib/utils';
import { 
  Shield, 
  Layers, 
  Lock, 
  Activity, 
  Share2, 
  Zap, 
  ArrowRight, 
  Terminal, 
  Cpu, 
  Database,
  Globe,
  Key,
  Infinity as InfinityIcon,
  Pulse
} from 'lucide-react';
import Image from 'next/image';

interface Feature {
  title: string;
  description: string;
  icon: any;
  className: string;
  color: string;
  bgColor: string;
  glowColor: string;
  visual?: React.ReactNode;
}

const FeatureCard = ({ feature, index, isInView }: { feature: Feature, index: number, isInView: boolean }) => {
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay: index * 0.1 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        "group relative overflow-hidden rounded-[2.5rem] border border-white/5 bg-[#09090b]/50 backdrop-blur-3xl p-8 hover:border-white/10 transition-all duration-700",
        feature.className
      )}
    >
      {/* Spotlight Effect */}
      <div 
        className="absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none z-0"
        style={{
          background: `radial-gradient(600px circle at ${mousePos.x}px ${mousePos.y}px, ${feature.glowColor}, transparent 40%)`,
        }}
      />
      
      {/* Grid Pattern Inside Card */}
      <div className="absolute inset-0 opacity-[0.03] group-hover:opacity-[0.05] transition-opacity duration-700 pointer-events-none bg-[linear-gradient(to_right,#ffffff_1px,transparent_1px),linear-gradient(to_bottom,#ffffff_1px,transparent_1px)] bg-[size:32px_32px]" />

      <div className="relative z-10 flex flex-col h-full">
        <div className="flex justify-between items-start mb-8">
          <div className={cn(
            "w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-700 group-hover:scale-110 group-hover:rotate-6",
            feature.bgColor
          )}>
            <feature.icon className={cn("w-7 h-7", feature.color)} />
          </div>
          <div className="text-[10px] font-mono text-zinc-600 tracking-widest uppercase">
            0{index + 1}
          </div>
        </div>

        <div className="flex-1">
          <h3 className="text-2xl font-bold text-white mb-4 tracking-tight group-hover:translate-x-1 transition-transform duration-500">
            {feature.title}
          </h3>
          <p className="text-zinc-500 text-sm leading-relaxed max-w-[280px] group-hover:text-zinc-400 transition-colors duration-500 mb-6">
            {feature.description}
          </p>
          
          {feature.visual}
        </div>
        
        <div className="mt-8 flex items-center gap-3 text-[10px] font-bold text-zinc-500 group-hover:text-white transition-all duration-500 tracking-[0.2em] uppercase cursor-pointer">
          Technical Specs <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-1.5" />
        </div>
      </div>

      {/* Decorative Blur */}
      <div className={cn(
        "absolute -right-20 -bottom-20 w-64 h-64 blur-[100px] opacity-0 group-hover:opacity-20 transition-opacity duration-1000",
        feature.bgColor
      )} />
    </motion.div>
  );
};

export default function KeyFeatures() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.1 });

  const features: Feature[] = [
    {
      title: 'Fault-Tolerant Runtime',
      description: 'Distributed execution engine with multi-region failover and state-level idempotency.',
      icon: Shield,
      className: 'md:col-span-8 md:row-span-2',
      color: 'text-rose-400',
      bgColor: 'bg-rose-400/10',
      glowColor: 'rgba(244, 63, 94, 0.05)',
      visual: (
        <div className="relative h-48 w-full mt-4 rounded-2xl border border-white/5 bg-black/40 overflow-hidden flex items-center justify-center">
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff05_1px,transparent_1px)] bg-[size:20px_20px]" />
          <div className="relative flex items-center gap-12">
             {[1, 2, 3].map((i) => (
               <motion.div 
                 key={i}
                 animate={{ 
                   y: [0, -10, 0],
                   borderColor: ["rgba(255,255,255,0.1)", "rgba(244,63,94,0.4)", "rgba(255,255,255,0.1)"]
                 }}
                 transition={{ duration: 4, delay: i * 0.5, repeat: Infinity }}
                 className="w-20 h-20 rounded-xl border border-white/10 flex items-center justify-center bg-zinc-900/50 backdrop-blur-sm"
               >
                 <Database className="w-8 h-8 text-zinc-600" />
               </motion.div>
             ))}
             {/* Connection Lines */}
             <div className="absolute top-1/2 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-rose-500/20 to-transparent -translate-y-1/2 -z-10" />
          </div>
        </div>
      )
    },
    {
      title: 'Atomic Connectivity',
      description: 'High-speed triggers and action nodes with unified JSON schema validation.',
      icon: Layers,
      className: 'md:col-span-4 md:row-span-1',
      color: 'text-violet-400',
      bgColor: 'bg-violet-400/10',
      glowColor: 'rgba(167, 139, 250, 0.05)',
      visual: (
        <div className="mt-2 flex flex-wrap gap-2">
          {['Stripe', 'Discord', 'AWS', 'Slack'].map((node) => (
            <div key={node} className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] text-zinc-500 font-mono">
              {node}
            </div>
          ))}
        </div>
      )
    },
    {
      title: 'Post-Quantum Security',
      description: 'Zero-knowledge architecture with AES-GCM encryption for all sensitive metadata.',
      icon: Lock,
      className: 'md:col-span-4 md:row-span-1',
      color: 'text-amber-400',
      bgColor: 'bg-amber-400/10',
      glowColor: 'rgba(251, 191, 36, 0.05)',
      visual: (
        <div className="mt-4 h-1 w-full bg-white/5 rounded-full overflow-hidden">
           <motion.div 
             animate={{ x: ["-100%", "100%"] }}
             transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
             className="w-1/2 h-full bg-amber-500/40"
           />
        </div>
      )
    },
    {
      title: 'Deep Telemetry',
      description: 'Live performance profiling and automated bottleneck detection for every execution step.',
      icon: Activity,
      className: 'md:col-span-6 md:row-span-1',
      color: 'text-emerald-400',
      bgColor: 'bg-emerald-400/10',
      glowColor: 'rgba(52, 211, 153, 0.05)',
      visual: (
        <div className="mt-6 flex items-end gap-1.5 h-12">
          {[30, 50, 40, 80, 60, 90, 40, 70, 50, 60, 40, 80].map((h, i) => (
            <motion.div 
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ delay: i * 0.05, duration: 1, repeat: Infinity, repeatType: "reverse" }}
              className="flex-1 bg-emerald-500/20 rounded-t-sm"
            />
          ))}
        </div>
      )
    },
    {
      title: 'MCP Native',
      description: 'Direct integration with Cursor and Claude using the Model Context Protocol.',
      icon: Share2,
      className: 'md:col-span-6 md:row-span-1',
      color: 'text-blue-400',
      bgColor: 'bg-blue-400/10',
      glowColor: 'rgba(96, 165, 250, 0.05)',
      visual: (
        <div className="mt-4 flex items-center gap-4">
           <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-white/5 flex items-center justify-center text-[10px] text-zinc-400 font-bold">
              AI
           </div>
           <div className="flex-1 h-[1px] bg-gradient-to-r from-blue-500/40 to-transparent" />
           <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-white/5 flex items-center justify-center text-[10px] text-zinc-400 font-bold">
              SDK
           </div>
        </div>
      )
    },
  ];

  return (
    <section id="key-features" className="py-24 sm:py-32 relative overflow-hidden bg-[#030303]">
      {/* Premium Background Gradients */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-rose-500/[0.03] blur-[140px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/[0.03] blur-[140px] rounded-full" />
        <div className="absolute inset-0 bg-[radial-gradient(#ffffff03_1px,transparent_1px)] bg-[size:40px_40px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          ref={sectionRef}
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="flex flex-col items-center text-center mb-24"
        >
          <div className="px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-zinc-500 text-[10px] font-bold uppercase tracking-[0.3em] mb-8 backdrop-blur-sm">
            Core Infrastructure
          </div>
          <motion.h2 
            className={cn(
              "text-4xl md:text-8xl font-bold tracking-tighter text-white mb-10 leading-[0.9]",
              geist.className
            )}
          >
            Built for <br />
            <motion.span 
              animate={{ 
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
              className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-violet-500 to-rose-500 bg-[length:200%_auto]"
            >
              Absolute Reliability.
            </motion.span>
          </motion.h2>
          <p className="text-zinc-500 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Every layer of Nodebase is engineered for deterministic performance and 
            industrial-grade security in high-stakes automation.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 auto-rows-[280px] md:auto-rows-[220px]">
          {features.map((feature, idx) => (
            <FeatureCard 
              key={idx} 
              feature={feature} 
              index={idx} 
              isInView={isInView} 
            />
          ))}
        </div>
      </div>
    </section>
  );
}
