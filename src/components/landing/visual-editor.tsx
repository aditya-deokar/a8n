'use client';

import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useRef, useState, useEffect } from 'react';
import { geist } from '@/lib/fonts';
import { cn } from '@/lib/utils';
import { 
  Zap, 
  Settings, 
  Activity, 
  ArrowRight, 
  Webhook, 
  Bot, 
  MessageSquare, 
  CheckCircle2,
  Play,
  Layers,
  MousePointer2
} from 'lucide-react';

const features = [
  {
    title: 'Real-time Execution',
    description: 'Watch your data flow across nodes with sub-second latency and live visual debugging.',
    icon: Activity,
    color: 'text-rose-500',
    bgColor: 'bg-rose-500/10',
    borderColor: 'group-hover:border-rose-500/50',
    glowColor: 'bg-rose-500/20',
  },
  {
    title: 'AI-Powered Mapping',
    description: 'Automatically map data between complex JSON structures with intelligent type-safety.',
    icon: Bot,
    color: 'text-violet-500',
    bgColor: 'bg-violet-500/10',
    borderColor: 'group-hover:border-violet-500/50',
    glowColor: 'bg-violet-500/20',
  },
  {
    title: 'Durable State',
    description: 'Every execution step is persisted. Recover from failures with one-click retries.',
    icon: Zap,
    color: 'text-amber-500',
    bgColor: 'bg-amber-500/10',
    borderColor: 'group-hover:border-amber-500/50',
    glowColor: 'bg-amber-500/20',
  },
];

const nodes = [
  {
    id: 'webhook',
    type: 'trigger',
    title: 'Webhook',
    subtitle: 'Production Event',
    icon: Webhook,
    color: 'bg-emerald-500',
    position: { top: '20%', left: '10%' },
    delay: 0,
  },
  {
    id: 'ai',
    type: 'action',
    title: 'AI Analysis',
    subtitle: 'GPT-4o Model',
    icon: Bot,
    color: 'bg-violet-500',
    position: { top: '50%', left: '45%' },
    delay: 1.5,
  },
  {
    id: 'slack',
    type: 'action',
    title: 'Slack Notify',
    subtitle: 'Alert Channel',
    icon: MessageSquare,
    color: 'bg-rose-500',
    position: { top: '30%', left: '80%' },
    delay: 3,
  },
];

export default function VisualEditorSection() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 3000);
    return () => clearInterval(interval);
  }, [isInView]);

  return (
    <section
      ref={sectionRef}
      id="visual-editor"
      className="relative overflow-hidden py-24 sm:py-32 bg-[#030303]"
    >
      {/* Premium Background Elements */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,#3b076433,transparent_50%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />
      
      {/* Floating Orbs */}
      <div className="absolute top-1/4 -left-24 h-96 w-96 rounded-full bg-rose-600/10 blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 -right-24 h-96 w-96 rounded-full bg-violet-600/10 blur-[120px] animate-pulse pointer-events-none" style={{ animationDelay: '2s' }} />

      <div className="container mx-auto px-4 relative z-10">
        <div className="flex flex-col items-center mb-24 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm text-zinc-400 text-xs font-medium mb-8"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
            </span>
            Next-Gen Workflow Engine
          </motion.div>
          
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.1 }}
            className={cn(
              'text-4xl md:text-7xl font-bold tracking-tight text-white mb-8',
              geist.className
            )}
          >
            Orchestrate with <br />
            <motion.span 
              animate={{ 
                backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
              }}
              transition={{ 
                duration: 5, 
                repeat: Infinity, 
                ease: "linear" 
              }}
              className="text-transparent bg-clip-text bg-gradient-to-r from-rose-500 via-violet-500 to-rose-500 bg-[length:200%_auto]"
            >
              Visual Precision.
            </motion.span>
          </motion.h2 >
          
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-zinc-400 text-lg md:text-xl max-w-2xl leading-relaxed"
          >
            Stop wrestling with scripts. Our DAG-based visual editor provides the depth of code with the speed of drag-and-drop.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 items-start">
          {/* Main Visual Editor Mockup */}
          <motion.div
            className="lg:col-span-7 relative h-[500px] md:h-[600px]"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={isInView ? { opacity: 1, scale: 1 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-rose-500/10 to-violet-500/10 rounded-3xl border border-white/10 overflow-hidden shadow-2xl backdrop-blur-3xl">
              {/* Editor Header */}
              <div className="absolute top-0 inset-x-0 h-14 bg-white/5 border-b border-white/10 flex items-center justify-between px-6 z-20">
                <div className="flex items-center gap-4">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-zinc-700" />
                    <div className="w-3 h-3 rounded-full bg-zinc-700" />
                    <div className="w-3 h-3 rounded-full bg-zinc-700" />
                  </div>
                  <span className="text-xs font-medium text-zinc-500">workflow_v2.json</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1 rounded bg-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-wider border border-rose-500/20 flex items-center gap-2">
                    <Play className="w-3 h-3 fill-current" /> Live
                  </div>
                  <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center border border-white/10">
                    <Settings className="w-4 h-4 text-zinc-500" />
                  </div>
                </div>
              </div>

              {/* Grid Canvas */}
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff05_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />

              {/* Animated Beams / Connections */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
                <defs>
                  <linearGradient id="beamGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#f43f5e" stopOpacity="0" />
                    <stop offset="50%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                  </linearGradient>
                </defs>
                
                {/* Connection 1 to 2 */}
                <motion.path
                  d="M 180 150 C 250 150, 300 300, 420 300"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="2"
                  fill="none"
                />
                {activeStep >= 1 && (
                  <motion.path
                    d="M 180 150 C 250 150, 300 300, 420 300"
                    stroke="url(#beamGradient)"
                    strokeWidth="3"
                    fill="none"
                    initial={{ strokeDasharray: "0 100", strokeDashoffset: 0 }}
                    animate={{ strokeDasharray: ["0 100", "100 0", "0 100"], strokeDashoffset: [0, -100, -200] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  />
                )}

                {/* Connection 2 to 3 */}
                <motion.path
                  d="M 520 300 C 600 300, 650 200, 750 200"
                  stroke="rgba(255,255,255,0.1)"
                  strokeWidth="2"
                  fill="none"
                />
                {activeStep >= 2 && (
                  <motion.path
                    d="M 520 300 C 600 300, 650 200, 750 200"
                    stroke="url(#beamGradient)"
                    strokeWidth="3"
                    fill="none"
                    initial={{ strokeDasharray: "0 100", strokeDashoffset: 0 }}
                    animate={{ strokeDasharray: ["0 100", "100 0", "0 100"], strokeDashoffset: [0, -100, -200] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  />
                )}
              </svg>

              {/* Floating Nodes */}
              {nodes.map((node, i) => (
                <motion.div
                  key={node.id}
                  className="absolute p-4 rounded-2xl bg-[#09090b] border border-white/10 shadow-2xl z-20 w-48"
                  style={{ top: node.position.top, left: node.position.left }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ 
                    opacity: 1, 
                    y: 0,
                    borderColor: activeStep === i ? 'rgba(244, 63, 94, 0.5)' : 'rgba(255,255,255,0.1)',
                    scale: activeStep === i ? 1.05 : 1
                  }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center text-white", node.color)}>
                      <node.icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">{node.type}</div>
                      <div className="text-xs font-bold text-white">{node.title}</div>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    {activeStep === i && (
                      <motion.div 
                        className="h-full bg-rose-500"
                        initial={{ width: 0 }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 2.5 }}
                      />
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-[10px] text-zinc-500">{node.subtitle}</span>
                    {activeStep > i && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                  </div>
                </motion.div>
              ))}

              {/* Mouse Interaction Mockup */}
              <motion.div
                className="absolute z-30"
                animate={{ 
                  x: activeStep === 0 ? 150 : activeStep === 1 ? 480 : 780,
                  y: activeStep === 0 ? 160 : activeStep === 1 ? 320 : 220
                }}
                transition={{ duration: 1.5, ease: "easeInOut" }}
              >
                <MousePointer2 className="w-6 h-6 text-white drop-shadow-lg" fill="black" />
                <motion.div 
                  className="absolute -inset-4 rounded-full bg-rose-500/20 blur-xl"
                  animate={{ scale: [1, 1.5, 1], opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </motion.div>

              {/* Floating Status Card */}
              <motion.div 
                className="absolute bottom-8 right-8 p-4 rounded-2xl bg-zinc-900/90 border border-white/10 backdrop-blur-xl shadow-2xl z-40"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1 }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full border-2 border-rose-500/30 flex items-center justify-center">
                    <Activity className="w-5 h-5 text-rose-500 animate-pulse" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">System Status</div>
                    <div className="text-[10px] text-zinc-500">Processing 42.5k req/s</div>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Features Column */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 30 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.5, delay: 0.4 + i * 0.1 }}
                className="group relative"
              >
                <div className={cn(
                  "p-8 rounded-3xl border border-white/5 bg-white/[0.02] backdrop-blur-sm transition-all duration-500 relative overflow-hidden",
                  feature.borderColor,
                  activeStep === i && "bg-white/[0.05] border-white/20"
                )}>
                  {/* Subtle Background Glow */}
                  <div className={cn(
                    "absolute -right-10 -top-10 w-32 h-32 blur-[60px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700",
                    feature.glowColor
                  )} />
                  
                  <div className="flex gap-6 relative z-10">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-500 group-hover:scale-110",
                      feature.bgColor
                    )}>
                      <feature.icon className={cn("w-7 h-7", feature.color)} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                        {feature.title}
                        {activeStep === i && (
                          <motion.span 
                            layoutId="indicator"
                            className="w-1.5 h-1.5 rounded-full bg-rose-500"
                          />
                        )}
                      </h3>
                      <p className="text-zinc-400 text-sm leading-relaxed max-w-sm">
                        {feature.description}
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: 0.8 }}
              className="mt-4"
            >
              <button className="group relative px-8 py-4 bg-white text-black font-bold rounded-2xl overflow-hidden transition-all hover:pr-10">
                <span className="relative z-10 flex items-center gap-2">
                  Explore Editor <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-rose-500 to-violet-600 opacity-0 group-hover:opacity-10 transition-opacity" />
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
