'use client';

import { motion, useInView, AnimatePresence } from 'framer-motion';
import { useRef, useState, useEffect, useMemo } from 'react';
import { 
  ReactFlow, 
  Background, 
  Controls, 
  Handle, 
  Position, 
  BaseEdge, 
  getSmoothStepPath,
  MarkerType
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { geist } from '@/lib/fonts';
import { cn } from '@/lib/utils';
import { useTheme } from 'next-themes';
import { 
  Zap, 
  Settings, 
  Activity, 
  ArrowRight, 
  Webhook, 
  Bot, 
  MessageSquare, 
  CheckCircle2,
  Play
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

// --- Custom React Flow Node ---
const VisualNode = ({ data, selected }: any) => {
  return (
    <div className={cn(
      "relative p-4 rounded-2xl bg-card/60 backdrop-blur-2xl border shadow-2xl min-w-[200px] transition-all duration-500 group overflow-hidden",
      selected ? "border-primary shadow-[0_0_30px_rgba(255,75,75,0.15)] ring-1 ring-primary/30" : "border-white/5 hover:border-white/20 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]",
      data.isActive ? "scale-[1.02]" : "scale-100"
    )}>
      {/* Glare effect */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-primary border-none opacity-0 group-hover:opacity-100 transition-opacity" />
      <Handle type="source" position={Position.Right} className="w-2 h-2 !bg-primary border-none opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="flex items-center gap-3 mb-4 relative z-10">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-inner bg-background border border-border/50",
          "group-hover:scale-110 transition-transform duration-500 ease-out",
          data.color
        )}>
          <data.icon className="w-5 h-5" />
        </div>
        <div>
          <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">{data.type}</div>
          <div className="text-sm font-bold text-foreground">{data.title}</div>
        </div>
      </div>
      
      <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden relative z-10">
        {data.isActive && (
          <motion.div 
            className={cn("h-full", data.barColor)}
            initial={{ width: 0 }}
            animate={{ width: "100%" }}
            transition={{ duration: 2.5, ease: "linear" }}
          />
        )}
        {data.isDone && (
          <div className={cn("h-full w-full", data.barColor)} />
        )}
      </div>
      
      <div className="mt-2.5 flex items-center justify-between relative z-10">
        <span className="text-[10px] text-muted-foreground font-medium">{data.subtitle}</span>
        {data.isDone && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
      </div>
    </div>
  );
};

// --- Custom Animated Edge ---
const AnimatedEdge = ({
  sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data
}: any) => {
  const [edgePath] = getSmoothStepPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, borderRadius: 20 });
  
  return (
    <>
      <BaseEdge path={edgePath} style={{ stroke: 'rgba(150,150,150,0.15)', strokeWidth: 2 }} />
      {data?.isActive && (
        <motion.path
          d={edgePath}
          stroke="url(#beamGradient)"
          strokeWidth="3"
          fill="none"
          initial={{ strokeDasharray: "0 100", strokeDashoffset: 0 }}
          animate={{ strokeDasharray: ["0 100", "100 0", "0 100"], strokeDashoffset: [0, -100, -200] }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
      )}
    </>
  );
};

const nodeTypes = { custom: VisualNode };
const edgeTypes = { animated: AnimatedEdge };

const initialNodes = [
  { id: '1', type: 'custom', position: { x: 30, y: 180 }, data: { title: 'Webhook', subtitle: 'Production Event', type: 'trigger', icon: Webhook, color: 'text-emerald-500', barColor: 'bg-emerald-500' } },
  { id: '2', type: 'custom', position: { x: 340, y: 180 }, data: { title: 'AI Analysis', subtitle: 'GPT-4o Model', type: 'action', icon: Bot, color: 'text-violet-500', barColor: 'bg-violet-500' } },
  { id: '3', type: 'custom', position: { x: 650, y: 80 }, data: { title: 'Slack Notify', subtitle: 'Alert Channel', type: 'action', icon: MessageSquare, color: 'text-rose-500', barColor: 'bg-rose-500' } },
];

const initialEdges = [
  { id: 'e1-2', source: '1', target: '2', type: 'animated' },
  { id: 'e2-3', source: '2', target: '3', type: 'animated' },
];

export default function VisualEditorSection() {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.2 });
  const [activeStep, setActiveStep] = useState(0);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isInView) return;
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % 4);
    }, 3000);
    return () => clearInterval(interval);
  }, [isInView]);

  const currentTheme = mounted ? (resolvedTheme || 'dark') : 'dark';

  const rfNodes = useMemo(() => initialNodes.map((n, i) => ({
    ...n,
    data: { ...n.data, isActive: activeStep === i, isDone: activeStep > i }
  })), [activeStep]);

  const rfEdges = useMemo(() => initialEdges.map(e => {
    let isActive = false;
    if (e.id === 'e1-2') isActive = activeStep >= 1;
    if (e.id === 'e2-3') isActive = activeStep >= 2;
    return { ...e, data: { isActive } };
  }), [activeStep]);

  return (
    <section
      ref={sectionRef}
      id="visual-editor"
      className="relative overflow-hidden py-24 sm:py-32 bg-background"
    >
      {/* Premium Background Ambient Glows */}
      <div className="absolute top-1/4 -left-24 h-[500px] w-[500px] rounded-full bg-rose-600/10 blur-[150px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-1/4 -right-24 h-[500px] w-[500px] rounded-full bg-violet-600/10 blur-[150px] pointer-events-none mix-blend-screen" style={{ animationDelay: '2s' }} />

      <div className="container mx-auto px-4 lg:px-8  relative z-10">
        
        {/* Header Section */}
        <div className="flex flex-col items-center mb-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-card border border-border backdrop-blur-sm text-muted-foreground text-xs font-medium mb-8 shadow-sm"
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
              'text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground mb-8',
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
            className="text-muted-foreground text-lg md:text-xl max-w-2xl leading-relaxed"
          >
            Stop wrestling with scripts. Our DAG-based visual editor provides the depth of code with the speed of drag-and-drop. Fully interactive and real-time.
          </motion.p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
          
          {/* Main Visual Editor React Flow Canvas */}
          <motion.div
            className="lg:col-span-7 relative h-[500px] md:h-[650px] w-full"
            initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
            animate={isInView ? { opacity: 1, scale: 1, filter: "blur(0px)" } : {}}
            transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
          >
            <div className="absolute inset-0 bg-black/40 backdrop-blur-3xl rounded-[2rem] border border-white/5 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden ring-1 ring-white/10 group">
              
              {/* Editor Header Bar */}
              <div className="absolute top-0 inset-x-0 h-14 bg-card/60 backdrop-blur-md border-b border-border flex items-center justify-between px-6 z-20">
                <div className="flex items-center gap-4">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-zinc-600/50 hover:bg-red-400 transition-colors" />
                    <div className="w-3 h-3 rounded-full bg-zinc-600/50 hover:bg-amber-400 transition-colors" />
                    <div className="w-3 h-3 rounded-full bg-zinc-600/50 hover:bg-emerald-400 transition-colors" />
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground tracking-wide font-mono">workflow_v2.json</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="px-3 py-1.5 rounded-full bg-rose-500/10 text-rose-500 text-[10px] font-bold uppercase tracking-wider border border-rose-500/20 flex items-center gap-2 shadow-sm">
                    <Play className="w-3 h-3 fill-current" /> Live Sync
                  </div>
                  <div className="w-8 h-8 rounded-full bg-card flex items-center justify-center border border-border shadow-sm hover:bg-accent transition-colors cursor-pointer">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </div>

              {/* Interactive React Flow Area */}
              {mounted && (
                <div className="w-full h-full pt-14">
                  <ReactFlow
                    nodes={rfNodes}
                    edges={rfEdges}
                    nodeTypes={nodeTypes}
                    edgeTypes={edgeTypes}
                    fitView
                    fitViewOptions={{ padding: 0.3 }}
                    proOptions={{ hideAttribution: true }}
                    className="bg-transparent"
                    minZoom={0.5}
                    maxZoom={1.5}
                  >
                    {/* Define Gradient for Animated Edges */}
                    <svg style={{ position: 'absolute', width: 0, height: 0 }}>
                      <defs>
                        <linearGradient id="beamGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#f43f5e" stopOpacity="0" />
                          <stop offset="50%" stopColor="#8b5cf6" />
                          <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                    </svg>

                    <Background 
                      color={currentTheme === 'dark' ? '#3f3f46' : '#d4d4d8'} 
                      gap={24} 
                      size={1.5} 
                      style={{
                        maskImage: 'radial-gradient(50% 50% at 50% 50%, black 70%, transparent 100%)',
                        WebkitMaskImage: 'radial-gradient(50% 50% at 50% 50%, black 70%, transparent 100%)'
                      }}
                    />
                    <Controls className="!bg-card/80 !backdrop-blur-md !border-border !fill-foreground shadow-xl rounded-lg overflow-hidden m-4" />
                  </ReactFlow>
                </div>
              )}

              {/* Floating System Status Card */}
              <motion.div 
                className="absolute bottom-8 right-8 p-4 rounded-2xl bg-card/80 border border-white/5 backdrop-blur-xl shadow-2xl z-40 pointer-events-none"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 1 }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full border border-rose-500/30 bg-rose-500/10 flex items-center justify-center shadow-inner">
                    <Activity className="w-5 h-5 text-rose-500 animate-pulse" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-foreground">System Status</div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">Processing 42.5k req/s</div>
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
                  "p-8 rounded-3xl border bg-card/30 backdrop-blur-md transition-all duration-500 relative overflow-hidden",
                  feature.borderColor,
                  activeStep === i ? "bg-card border-border shadow-xl" : "border-transparent hover:bg-card/50"
                )}>
                  {/* Subtle Background Glow */}
                  <div className={cn(
                    "absolute -right-10 -top-10 w-32 h-32 blur-[60px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none",
                    feature.glowColor
                  )} />
                  
                  <div className="flex gap-6 relative z-10">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform duration-500 group-hover:scale-110 shadow-inner",
                      feature.bgColor
                    )}>
                      <feature.icon className={cn("w-7 h-7", feature.color)} />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-foreground mb-3 flex items-center gap-3">
                        {feature.title}
                        {activeStep === i && (
                          <motion.span 
                            layoutId="indicator"
                            className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"
                          />
                        )}
                      </h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">
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
              className="mt-6"
            >
              <button className="group relative px-8 py-4 bg-foreground text-background font-bold rounded-2xl overflow-hidden transition-all hover:pr-10 shadow-xl hover:shadow-2xl">
                <span className="relative z-10 flex items-center gap-2">
                  Explore Editor <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-rose-500 to-violet-600 opacity-0 group-hover:opacity-20 transition-opacity duration-300" />
              </button>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}
