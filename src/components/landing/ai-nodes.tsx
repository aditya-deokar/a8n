'use client';

import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { geist } from '@/lib/fonts';
import { cn } from '@/lib/utils';
import { 
  Sparkles, 
  MessageSquare, 
  TrendingUp, 
  Cpu, 
  Brain, 
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
  { name: 'GPT-4o', provider: 'OpenAI', color: 'text-emerald-400', bg: 'bg-emerald-400' },
  { name: 'Claude 3.5', provider: 'Anthropic', color: 'text-orange-400', bg: 'bg-orange-400' },
  { name: 'Gemini 1.5', provider: 'Google', color: 'text-blue-400', bg: 'bg-blue-400' },
  { name: 'Llama 3', provider: 'Meta', color: 'text-purple-400', bg: 'bg-purple-400' },
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
      className="relative overflow-hidden py-24 sm:py-32 bg-background border-t border-border"
    >
      {/* Dynamic Background Elements */}
      <div className="absolute top-1/4 -right-1/4 w-[800px] h-[800px] bg-cyan-500/5 rounded-full blur-[150px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-1/4 -left-1/4 w-[800px] h-[800px] bg-purple-500/5 rounded-full blur-[150px] pointer-events-none mix-blend-screen" />
      <div 
        className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:64px_64px]" 
        style={{
          maskImage: 'radial-gradient(50% 50% at 50% 50%, black 60%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(50% 50% at 50% 50%, black 60%, transparent 100%)'
        }}
      />
      
      <div className="container mx-auto px-4 lg:px-8 max-w-[1400px] relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-center">
          
          {/* Left Side: Content */}
          <div className="lg:col-span-6">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              animate={isInView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.8, ease: "easeOut" }}
            >
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold uppercase tracking-widest mb-8 shadow-sm">
                <Cpu className="w-4 h-4" /> AI Native Framework
              </div>
              
              <motion.h2 
                className={cn(
                  "text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground mb-8 leading-[1.1]",
                  geist.className
                )}
              >
                Intelligence <br />
                <motion.span 
                  animate={{ 
                    backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                  }}
                  transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                  className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-purple-400 to-cyan-400 bg-[length:200%_auto]"
                >
                  Without Limits.
                </motion.span>
              </motion.h2>
              
              <p className="text-muted-foreground text-lg md:text-xl max-w-xl mb-12 leading-relaxed">
                Connect your logic to the world&apos;s most advanced LLMs. 
                Our native AI nodes handle prompt engineering, context management, and rate-limiting automatically.
              </p>

              <div className="grid gap-4">
                {useCases.map((useCase, idx) => (
                  <motion.div 
                    key={idx}
                    initial={{ opacity: 0, y: 20 }}
                    animate={isInView ? { opacity: 1, y: 0 } : {}}
                    transition={{ delay: 0.3 + idx * 0.1, duration: 0.5 }}
                    className={cn(
                      "group relative p-6 rounded-2xl border border-white/5 bg-card/40 backdrop-blur-md transition-all duration-500",
                      "hover:bg-card hover:shadow-xl hover:scale-[1.01]"
                    )}
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent rounded-2xl pointer-events-none" />
                    
                    <div className="flex gap-5 relative z-10">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-500 group-hover:scale-110 shadow-inner",
                        useCase.bgColor
                      )}>
                        <useCase.icon className={cn("w-6 h-6", useCase.color)} />
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground mb-2 group-hover:text-cyan-400 transition-colors">
                          {useCase.title}
                        </h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {useCase.description}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>

          {/* Right Side: High-End Generative UI Visual */}
          <div className="lg:col-span-6 relative mt-12 lg:mt-0">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
              animate={isInView ? { opacity: 1, scale: 1, filter: "blur(0px)" } : {}}
              transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
              className="relative aspect-square max-w-2xl mx-auto w-full group"
            >
              {/* Central Core Glass Container */}
              <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden border border-white/5 bg-black/40 backdrop-blur-3xl shadow-[0_0_80px_rgba(0,0,0,0.6)] flex items-center justify-center ring-1 ring-white/10">
                
                {/* Internal Ambient Lights */}
                <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10 opacity-60 group-hover:opacity-100 transition-opacity duration-700" />
                
                {/* The Animated Neural Core */}
                <div className="relative w-full h-full flex items-center justify-center pointer-events-none">
                  
                  {/* Central Glow */}
                  <motion.div 
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-0 m-auto w-48 h-48 bg-cyan-500/40 rounded-full blur-[60px]"
                  />

                  {/* Rotating Orbital Rings */}
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 m-auto w-[280px] h-[280px] border border-cyan-500/20 rounded-full border-dashed"
                  />
                  <motion.div 
                    animate={{ rotate: -360 }}
                    transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 m-auto w-[400px] h-[400px] border border-purple-500/20 rounded-full"
                  />
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 100, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 m-auto w-[520px] h-[520px] border border-white/5 rounded-full border-dotted"
                  />
                  
                  {/* The Physical Core */}
                  <div className="w-24 h-24 bg-card/80 rounded-full border border-cyan-500/40 shadow-[0_0_40px_rgba(34,211,238,0.3)] flex items-center justify-center z-10 backdrop-blur-xl relative">
                    <div className="absolute inset-0 rounded-full border-t border-cyan-400 animate-spin" style={{ animationDuration: '3s' }} />
                    <Brain className="w-12 h-12 text-cyan-400 animate-pulse" />
                  </div>

                  {/* Orbiting LLM Nodes */}
                  {models.map((model, i) => {
                    // Place models on different orbital rings
                    const radii = [140, 200, 260, 140];
                    const radius = radii[i];
                    const durations = [20, 25, 30, 22];
                    const startAngle = (i * 360) / models.length;

                    return (
                      <motion.div
                        key={model.name}
                        className="absolute top-1/2 left-1/2 w-0 h-0 z-20"
                        initial={{ rotate: startAngle }}
                        animate={{ rotate: startAngle + 360 }}
                        transition={{ duration: durations[i], repeat: Infinity, ease: "linear" }}
                      >
                        <motion.div 
                          className="absolute flex items-center gap-2 px-3 py-1.5 rounded-full bg-card/90 backdrop-blur-xl border border-white/10 shadow-2xl"
                          style={{
                            x: radius,
                            y: 0,
                            marginTop: '-16px', 
                            marginLeft: '-40px'
                          }}
                          // Counter-rotate to keep text upright
                          initial={{ rotate: -startAngle }}
                          animate={{ rotate: -(startAngle + 360) }}
                          transition={{ duration: durations[i], repeat: Infinity, ease: "linear" }}
                        >
                          <div className={cn("w-2 h-2 rounded-full shadow-[0_0_10px_currentColor]", model.bg)} />
                          <span className="text-[10px] font-bold text-foreground tracking-tight whitespace-nowrap">{model.name}</span>
                        </motion.div>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Floating Terminal Overlay */}
                <div className="absolute bottom-6 inset-x-6 h-32 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-5 overflow-hidden font-mono shadow-2xl">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex gap-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-red-500/50" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500/50" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                      <span className="text-[9px] text-muted-foreground uppercase tracking-widest font-bold">Inference Engine</span>
                    </div>
                  </div>
                  <div className="space-y-1.5 relative">
                    <AnimatePresence mode="popLayout">
                      <motion.div
                        key={activeLog}
                        initial={{ opacity: 0, x: -10, filter: "blur(4px)" }}
                        animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
                        exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
                        transition={{ duration: 0.4 }}
                        className="text-[11px] text-cyan-400 font-medium flex items-center gap-2"
                      >
                        <span className="text-muted-foreground/60">[{new Date().toLocaleTimeString()}]</span>
                        {logs[activeLog]}
                      </motion.div>
                    </AnimatePresence>
                    <div className="text-[10px] text-muted-foreground/80 mt-2">
                      <span className="text-purple-400">root@core</span>:~$ route request --model {models[activeModel].name} --provider {models[activeModel].provider}
                    </div>
                    <div className="text-[10px] text-emerald-400/80">
                      &gt; execution completed in {(Math.random() * 200 + 100).toFixed(0)}ms
                    </div>
                  </div>
                </div>

              </div>

              {/* External Floating Badges */}
              <motion.div 
                className="absolute -top-6 -right-6 p-4 rounded-2xl bg-card border border-border shadow-2xl backdrop-blur-xl z-30"
                animate={{ y: [0, -12, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shadow-inner">
                    <ShieldCheck className="w-6 h-6 text-purple-400" />
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Security</div>
                    <div className="text-sm font-bold text-foreground">PII Redaction</div>
                  </div>
                </div>
              </motion.div>

              <motion.div 
                className="absolute -bottom-6 -left-6 p-4 rounded-2xl bg-card border border-border shadow-2xl backdrop-blur-xl z-30"
                animate={{ y: [0, 12, 0] }}
                transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shadow-inner">
                    <Zap className="w-6 h-6 text-cyan-400" />
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Performance</div>
                    <div className="text-sm font-bold text-foreground">Edge Optimized</div>
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
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-32 pt-12 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-8 relative z-10"
        >
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 rounded-full bg-card flex items-center justify-center border border-border shadow-sm">
                <Command className="w-5 h-5 text-muted-foreground" />
             </div>
             <div>
                <div className="text-base font-bold text-foreground">Native Integrations</div>
                <div className="text-sm text-muted-foreground">First-class support for 50+ AI providers</div>
             </div>
          </div>

          <div className="flex flex-wrap justify-center gap-10 opacity-50 hover:opacity-100 transition-opacity duration-700 grayscale hover:grayscale-0">
             {models.map(m => (
               <div key={m.name} className="flex flex-col items-center group cursor-default">
                  <span className="text-foreground text-xl font-bold tracking-tight group-hover:text-cyan-400 transition-colors duration-300">{m.name}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mt-1">{m.provider}</span>
               </div>
             ))}
          </div>

          <button className="flex items-center gap-2 text-muted-foreground text-sm font-bold hover:text-foreground transition-colors group">
            View AI documentation <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
          </button>
        </motion.div>
      </div>
    </section>
  );
}
