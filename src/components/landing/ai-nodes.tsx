'use client';

import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { geist } from '@/lib/fonts';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import { 
  Bot, 
  Sparkles, 
  MessageSquare, 
  TrendingUp, 
  Cpu, 
  Brain, 
  Terminal,
  Search,
  Command,
  ArrowUpRight,
  ShieldCheck,
  Zap
} from 'lucide-react';

const useCases = [
  {
    title: 'Semantic Content Engine',
    description: 'Autonomous content generation with deep context awareness and brand voice alignment.',
    icon: Sparkles,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-400/10',
    borderColor: 'group-hover:border-cyan-500/50',
  },
  {
    title: 'Predictive Lead Intelligence',
    description: 'Analyze behavioral patterns to predict intent and score leads with 98% accuracy.',
    icon: TrendingUp,
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    borderColor: 'group-hover:border-blue-500/50',
  },
  {
    title: 'Cognitive Support Agents',
    description: 'Deploy self-learning agents that resolve complex multi-step customer inquiries.',
    icon: MessageSquare,
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
    borderColor: 'group-hover:border-purple-500/50',
  },
];

const models = [
  { name: 'GPT-4o', provider: 'OpenAI', color: 'text-emerald-400' },
  { name: 'Claude 3.5', provider: 'Anthropic', color: 'text-orange-400' },
  { name: 'Gemini 1.5', provider: 'Google', color: 'text-blue-400' },
  { name: 'Llama 3', provider: 'Meta', color: 'text-purple-400' },
];

const logs = [
  "Initializing cognitive layer...",
  "Analyzing payload context...",
  "Routing to GPT-4o-pro...",
  "Generating semantic mapping...",
  "Validating output safety...",
  "Execution successful."
];

export default function AINodesSection() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });
  const [activeLog, setActiveLog] = useState(0);
  const [activeModel, setActiveModel] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const interval = setInterval(() => {
      setActiveLog((prev) => (prev + 1) % logs.length);
      if (Math.random() > 0.7) setActiveModel((prev) => (prev + 1) % models.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [isInView]);

  return (
    <section
      ref={sectionRef}
      id="ai-nodes"
      className="relative overflow-hidden py-24 sm:py-32 bg-[#020202]"
    >
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,#0ea5e915,transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,#a855f715,transparent_50%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:64px_64px]" />
      
      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          
          {/* Left Side: Content */}
          <div className="lg:col-span-6">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-8">
                <Cpu className="w-3 h-3" /> AI Native Framework
              </div>
              
              <motion.h2 
                className={cn(
                  "text-4xl md:text-7xl font-bold tracking-tight text-white mb-8",
                  geist.className
                )}
              >
                Intelligence <br />
                <motion.span 
                  animate={{ 
                    backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                  }}
                  transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                  className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 bg-[length:200%_auto]"
                >
                  Without Limits.
                </motion.span>
              </motion.h2>
              
              <p className="text-zinc-400 text-lg md:text-xl max-w-xl mb-12 leading-relaxed">
                Connect your logic to the world&apos;s most advanced LLMs. 
                Our native AI nodes handle prompt engineering, context management, and rate-limiting automatically.
              </p>

              <div className="grid gap-4">
                {useCases.map((useCase, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.3 + idx * 0.1 }}
                    className="group relative p-6 rounded-2xl border border-white/5 bg-white/[0.02] backdrop-blur-xl hover:bg-white/[0.05] transition-all duration-500"
                  >
                    <div className="flex gap-5">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-500 group-hover:scale-110",
                        useCase.bgColor
                      )}>
                        <useCase.icon className={cn("w-6 h-6", useCase.color)} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-white mb-2 group-hover:text-cyan-400 transition-colors">
                          {useCase.title}
                        </h3>
                        <p className="text-zinc-500 text-sm leading-relaxed">
                          {useCase.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right Side: High-End Visual */}
          <div className="lg:col-span-6 relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="relative aspect-square max-w-xl mx-auto"
            >
              {/* Central Core */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-full h-full rounded-3xl overflow-hidden border border-white/10 shadow-[0_0_50px_-12px_rgba(14,165,233,0.3)] bg-zinc-900/50 backdrop-blur-3xl">
                  <Image 
                    src="/images/ai-core.png" 
                    alt="AI Core" 
                    fill
                    className="object-cover opacity-60 scale-110 animate-pulse"
                    style={{ animationDuration: '8s' }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/40" />
                  
                  {/* Orbiting Elements */}
                  <div className="absolute inset-0 pointer-events-none">
                    {models.map((model, i) => (
                      <motion.div
                        key={model.name}
                        className="absolute"
                        animate={{ 
                          rotate: 360,
                        }}
                        transition={{ 
                          duration: 20 + i * 5, 
                          repeat: Infinity, 
                          ease: "linear" 
                        }}
                        style={{ 
                          width: '100%', 
                          height: '100%',
                          top: 0,
                          left: 0,
                        }}
                      >
                        <motion.div 
                          className="absolute bg-black/60 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2 shadow-2xl"
                          style={{ 
                            top: `${20 + i * 15}%`, 
                            left: '-10%',
                          }}
                          animate={{ rotate: -360 }}
                          transition={{ 
                            duration: 20 + i * 5, 
                            repeat: Infinity, 
                            ease: "linear" 
                          }}
                        >
                          <div className={cn("w-2 h-2 rounded-full", model.color.replace('text-', 'bg-'))} />
                          <span className="text-[10px] font-bold text-white tracking-tighter">{model.name}</span>
                        </motion.div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Terminal Overlay */}
                  <div className="absolute bottom-6 inset-x-6 h-32 bg-black/80 backdrop-blur-md border border-white/10 rounded-xl p-4 overflow-hidden font-mono">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-red-500/50" />
                        <div className="w-2 h-2 rounded-full bg-amber-500/50" />
                        <div className="w-2 h-2 rounded-full bg-emerald-500/50" />
                      </div>
                      <span className="text-[8px] text-zinc-500 uppercase tracking-widest">Active Inference</span>
                    </div>
                    <div className="space-y-1">
                      <AnimatePresence mode="popLayout">
                        <motion.div
                          key={activeLog}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 10 }}
                          className="text-[10px] text-cyan-400/80 flex items-center gap-2"
                        >
                          <span className="text-zinc-600">[{new Date().toLocaleTimeString()}]</span>
                          {logs[activeLog]}
                        </motion.div>
                      </AnimatePresence>
                      <div className="text-[9px] text-zinc-600">
                        &gt; model: {models[activeModel].name} ({models[activeModel].provider})
                      </div>
                      <div className="text-[9px] text-zinc-600">
                        &gt; latency: {(Math.random() * 200 + 100).toFixed(0)}ms
                      </div>
                    </div>
                  </div>

                  {/* Processing Visuals */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32">
                    <motion.div 
                      animate={{ 
                        scale: [1, 1.2, 1],
                        opacity: [0.1, 0.3, 0.1],
                      }}
                      transition={{ duration: 4, repeat: Infinity }}
                      className="absolute inset-0 bg-cyan-500 rounded-full blur-[40px]"
                    />
                    <Brain className="absolute inset-0 m-auto w-12 h-12 text-white/20 animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Floating Badges */}
              <motion.div 
                className="absolute -top-6 -right-6 p-4 rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl backdrop-blur-xl z-20"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/20 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">Security</div>
                    <div className="text-xs font-bold text-white">PII Redaction Active</div>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                className="absolute -bottom-6 -left-6 p-4 rounded-2xl bg-zinc-900 border border-white/10 shadow-2xl backdrop-blur-xl z-20"
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                    <Zap className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">Performance</div>
                    <div className="text-xs font-bold text-white">Edge Optimized</div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          </div>

        </div>

        {/* Ecosystem Footer */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-24 pt-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-8"
        >
          <div className="flex items-center gap-4">
             <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10">
                <Command className="w-5 h-5 text-zinc-400" />
             </div>
             <div>
                <div className="text-sm font-bold text-white">Native Integrations</div>
                <div className="text-xs text-zinc-500">First-class support for 50+ AI providers</div>
             </div>
          </div>

          <div className="flex flex-wrap justify-center gap-8 md:gap-12 opacity-40 hover:opacity-100 transition-opacity duration-500 grayscale hover:grayscale-0">
             {models.map(m => (
               <div key={m.name} className="flex flex-col items-center group cursor-default">
                  <span className="text-white text-lg font-bold tracking-tight group-hover:text-cyan-400 transition-colors">{m.name}</span>
                  <span className="text-[9px] text-zinc-600 uppercase tracking-[0.2em]">{m.provider}</span>
               </div>
             ))}
          </div>

          <button className="flex items-center gap-2 text-zinc-400 text-sm font-medium hover:text-white transition-colors group">
            View AI documentation <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </motion.div>
      </div>
    </section>
  );
}
