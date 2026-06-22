"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { 
  ReactFlow, 
  Background, 
  Handle, 
  Position, 
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { 
  FileText, Bot, GitBranch, MessageSquare, BrainCircuit, 
  Database, Shield, Kanban, Globe, Code, List, 
  AlertCircle, Merge, Activity, Webhook, Play
} from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { id: "it-ops", prefix: "IT Ops", suffix: "can", description: "Automatically on-board new employees, provision accounts, and notify teams." },
  { id: "sec-ops", prefix: "Sec Ops", suffix: "can", description: "Enrich security incident tickets with context from external threat feeds instantly." },
  { id: "dev-ops", prefix: "Dev Ops", suffix: "can", description: "Convert natural language directly into infrastructure API calls." },
  { id: "sales", prefix: "Sales", suffix: "can", description: "Generate deep customer insights from thousands of product reviews." },
  { id: "you", prefix: "You", suffix: "can", description: "Watch this video to hear our pitch and see how it works in action." },
];

const CustomNode = ({ data, selected }: any) => {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center p-4 rounded-2xl bg-card/60 backdrop-blur-2xl border border-white/5 shadow-2xl min-w-[150px] relative transition-all duration-300 group overflow-hidden",
      selected ? "border-primary/50 shadow-[0_0_30px_rgba(255,75,75,0.15)] ring-1 ring-primary/30" : "hover:border-primary/30 hover:shadow-[0_8px_30px_rgba(0,0,0,0.4)]"
    )}>
      {/* Subtle top glare for glass effect */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      
      <Handle type="target" position={Position.Left} className="w-2 h-2 !bg-primary border-none opacity-0" />
      <Handle type="source" position={Position.Right} id="right" className="w-2 h-2 !bg-primary border-none opacity-0" />
      <Handle type="source" position={Position.Bottom} id="bottom" className="w-2 h-2 !bg-primary border-none opacity-0" />
      <Handle type="target" position={Position.Top} id="top" className="w-2 h-2 !bg-primary border-none opacity-0" />
      
      {data.icon && (
        <div className="w-12 h-12 rounded-full bg-background border border-border/50 shadow-inner flex items-center justify-center mb-3 group-hover:scale-110 transition-transform duration-500 ease-out">
          <data.icon className="w-5 h-5 text-foreground" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-foreground text-center whitespace-pre-wrap">{data.title}</h3>
      {data.subtitle && <p className="text-[10px] text-muted-foreground text-center mt-1 whitespace-pre-wrap font-mono">{data.subtitle}</p>}
    </div>
  );
};

const SubNode = ({ data }: any) => {
  return (
    <div className={cn("flex flex-col items-center relative group", data.className)}>
      <Handle type="target" position={Position.Top} className="opacity-0" />
      <div className="w-10 h-10 rounded-full bg-card/80 backdrop-blur-md border border-white/5 flex items-center justify-center mb-2 shadow-xl transition-all duration-300 group-hover:border-primary/30 group-hover:shadow-[0_0_15px_rgba(255,255,255,0.05)]">
        {data.icon && <data.icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />}
      </div>
      <span className="text-[10px] text-muted-foreground font-medium text-center w-24 leading-tight group-hover:text-foreground/80 transition-colors">{data.title}</span>
    </div>
  );
};

const nodeTypes = {
  custom: CustomNode,
  sub: SubNode
};

// Data for IT Ops
const itOpsNodes = [
  { id: '1', type: 'custom', position: { x: 40, y: 140 }, data: { icon: FileText, title: "On 'Create User'\nsubmission", className: "w-[160px]" } },
  { id: '2', type: 'custom', position: { x: 300, y: 140 }, data: { icon: Bot, title: "AI Agent", subtitle: "Tools Agent", className: "w-[160px] border-primary/50 shadow-[0_0_20px_rgba(255,75,75,0.1)]" } },
  { id: '3', type: 'custom', position: { x: 540, y: 150 }, data: { icon: GitBranch, title: "Is a manager?", className: "w-[140px]" } },
  { id: '4', type: 'custom', position: { x: 760, y: 50 }, data: { icon: MessageSquare, title: "Add to channel", subtitle: "invite: channel", className: "w-[160px]" } },
  { id: '5', type: 'custom', position: { x: 760, y: 250 }, data: { icon: MessageSquare, title: "Update profile", subtitle: "updateProfile: user", className: "w-[160px]" } },
  { id: 's1', type: 'sub', position: { x: 180, y: 320 }, data: { icon: BrainCircuit, title: "Anthropic Chat Model" } },
  { id: 's2', type: 'sub', position: { x: 280, y: 320 }, data: { icon: Database, title: "Postgress Memory" } },
  { id: 's3', type: 'sub', position: { x: 380, y: 320 }, data: { icon: Shield, title: "Microsoft Entra ID" } },
  { id: 's4', type: 'sub', position: { x: 480, y: 320 }, data: { icon: Kanban, title: "Jira Software" } },
];

const itOpsRawEdges = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e2-3', source: '2', target: '3' },
  { id: 'e3-4', source: '3', target: '4', label: 'true' },
  { id: 'e3-5', source: '3', target: '5', label: 'false' },
  { id: 'e2-s1', source: '2', sourceHandle: 'bottom', target: 's1', animated: true, style: { strokeDasharray: '4 4' } },
  { id: 'e2-s2', source: '2', sourceHandle: 'bottom', target: 's2', animated: true, style: { strokeDasharray: '4 4' } },
  { id: 'e2-s3', source: '2', sourceHandle: 'bottom', target: 's3', animated: true, style: { strokeDasharray: '4 4' } },
  { id: 'e2-s4', source: '2', sourceHandle: 'bottom', target: 's4', animated: true, style: { strokeDasharray: '4 4' } },
];

// Data for Sec Ops
const secOpsNodes = [
  { id: '1', type: 'custom', position: { x: 40, y: 140 }, data: { icon: AlertCircle, title: "On new issue", className: "w-[140px]" } },
  { id: '2', type: 'custom', position: { x: 240, y: 140 }, data: { icon: Code, title: "Extract IPs and\ndomains", className: "w-[150px]" } },
  { id: '3', type: 'custom', position: { x: 480, y: 40 }, data: { icon: Activity, title: "VirusTotal: Scan URL", subtitle: "POST: https://vt.io...", className: "w-[180px]" } },
  { id: '4', type: 'custom', position: { x: 720, y: 40 }, data: { icon: Activity, title: "VirusTotal: Get Report", subtitle: "POST: https://vt.io...", className: "w-[180px]" } },
  { id: '5', type: 'custom', position: { x: 480, y: 240 }, data: { icon: Activity, title: "urlscan.io", subtitle: "perform: scan", className: "w-[180px]" } },
  { id: '6', type: 'custom', position: { x: 960, y: 140 }, data: { icon: Merge, title: "Merge reports", subtitle: "append", className: "w-[140px]" } },
  { id: '7', type: 'custom', position: { x: 1160, y: 140 }, data: { icon: AlertCircle, title: "Post results", subtitle: "update: issue", className: "w-[140px]" } },
];

const secOpsRawEdges = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e2-3', source: '2', target: '3' },
  { id: 'e2-5', source: '2', target: '5' },
  { id: 'e3-4', source: '3', target: '4' },
  { id: 'e4-6', source: '4', target: '6', label: 'Input 1' },
  { id: 'e5-6', source: '5', target: '6', label: 'Input 2' },
  { id: 'e6-7', source: '6', target: '7' },
];

// Data for Dev Ops
const devOpsNodes = [
  { id: '1', type: 'custom', position: { x: 20, y: 140 }, data: { icon: Webhook, title: "Webhook", className: "w-[120px]" } },
  { id: '2', type: 'custom', position: { x: 200, y: 140 }, data: { icon: Bot, title: "AI Agent", subtitle: "Tools Agent", className: "w-[160px] border-primary/50 shadow-[0_0_20px_rgba(255,75,75,0.1)]" } },
  { id: '3', type: 'custom', position: { x: 440, y: 150 }, data: { icon: GitBranch, title: "Switch", className: "w-[120px]" } },
  
  { id: '4', type: 'custom', position: { x: 680, y: -20 }, data: { icon: Globe, title: "Get properties", className: "w-[140px]" } },
  { id: '5', type: 'custom', position: { x: 920, y: -20 }, data: { icon: Code, title: "Structure Response", className: "w-[140px]" } },
  { id: '6', type: 'custom', position: { x: 680, y: 100 }, data: { icon: Globe, title: "Post URL", className: "w-[140px]" } },
  { id: '7', type: 'custom', position: { x: 680, y: 220 }, data: { icon: GitBranch, title: "Delete/Return", className: "w-[140px]" } },
  { id: '8', type: 'custom', position: { x: 920, y: 160 }, data: { icon: Globe, title: "Delete URI", className: "w-[140px]" } },
  { id: '9', type: 'custom', position: { x: 920, y: 280 }, data: { icon: Globe, title: "Return output", className: "w-[140px]" } },

  { id: 's1', type: 'sub', position: { x: 80, y: 330 }, data: { icon: BrainCircuit, title: "Gemini Chat Model" } },
  { id: 's2', type: 'sub', position: { x: 180, y: 330 }, data: { icon: Globe, title: "Proxmox API Docs" } },
  { id: 's3', type: 'sub', position: { x: 280, y: 330 }, data: { icon: Globe, title: "Proxmox API Wiki" } },
  { id: 's4', type: 'sub', position: { x: 380, y: 330 }, data: { icon: Globe, title: "Proxmox Server" } },
  
  { id: 'inner1', type: 'custom', position: { x: 480, y: 320 }, data: { icon: Bot, title: "Auto-fixing Parser", className: "w-[160px] border-primary/30" } },
  { id: 's5', type: 'sub', position: { x: 460, y: 460 }, data: { icon: BrainCircuit, title: "Groq Chat Model" } },
  { id: 's6', type: 'sub', position: { x: 560, y: 460 }, data: { icon: Code, title: "Structured Output" } },
];

const devOpsRawEdges = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e2-3', source: '2', target: '3' },
  { id: 'e3-4', source: '3', target: '4', label: 'GET' },
  { id: 'e3-6', source: '3', target: '6', label: 'POST' },
  { id: 'e3-7', source: '3', target: '7', label: 'DELETE' },
  { id: 'e4-5', source: '4', target: '5' },
  { id: 'e7-8', source: '7', target: '8', label: 'true' },
  { id: 'e7-9', source: '7', target: '9', label: 'false' },
  { id: 'e2-s1', source: '2', sourceHandle: 'bottom', target: 's1', animated: true, style: { strokeDasharray: '4 4' } },
  { id: 'e2-s2', source: '2', sourceHandle: 'bottom', target: 's2', animated: true, style: { strokeDasharray: '4 4' } },
  { id: 'e2-s3', source: '2', sourceHandle: 'bottom', target: 's3', animated: true, style: { strokeDasharray: '4 4' } },
  { id: 'e2-s4', source: '2', sourceHandle: 'bottom', target: 's4', animated: true, style: { strokeDasharray: '4 4' } },
  { id: 'e2-inner1', source: '2', sourceHandle: 'bottom', target: 'inner1', animated: true, style: { strokeDasharray: '4 4' } },
  { id: 'einner1-s5', source: 'inner1', sourceHandle: 'bottom', target: 's5', animated: true, style: { strokeDasharray: '4 4' } },
  { id: 'einner1-s6', source: 'inner1', sourceHandle: 'bottom', target: 's6', animated: true, style: { strokeDasharray: '4 4' } },
];

// Data for Sales
const salesNodes = [
  { id: '1', type: 'custom', position: { x: 80, y: 80 }, data: { icon: Globe, title: "Get reviews", subtitle: "POST: /api/reviews", className: "w-[160px]" } },
  { id: '2', type: 'custom', position: { x: 360, y: 80 }, data: { icon: Code, title: "Apply K-means", subtitle: "clustering", className: "w-[160px]" } },
  { id: '3', type: 'custom', position: { x: 360, y: 220 }, data: { icon: List, title: "Clusters To List", className: "w-[140px]" } },
  { id: '4', type: 'custom', position: { x: 600, y: 220 }, data: { icon: Bot, title: "Insights Agent", className: "w-[160px] border-primary/50 shadow-[0_0_20px_rgba(255,75,75,0.1)]" } },
  { id: '5', type: 'custom', position: { x: 860, y: 220 }, data: { icon: Database, title: "GSheets Export", subtitle: "append: sheet", className: "w-[160px]" } },
  { id: 's1', type: 'sub', position: { x: 640, y: 380 }, data: { icon: BrainCircuit, title: "OpenAI Model" } },
];

const salesRawEdges = [
  { id: 'e1-2', source: '1', target: '2' },
  { id: 'e1-3', source: '1', target: '3' },
  { id: 'e3-4', source: '3', target: '4' },
  { id: 'e4-5', source: '4', target: '5' },
  { id: 'e4-s1', source: '4', sourceHandle: 'bottom', target: 's1', animated: true, style: { strokeDasharray: '4 4' } },
];

// Helpers for Flow styling
const getEdgeStyle = (theme: string) => ({
  stroke: theme === 'dark' ? '#52525b' : '#a1a1aa',
  strokeWidth: 2,
});

const getLabelStyle = (theme: string) => ({
  fill: theme === 'dark' ? '#f4f4f5' : '#18181b',
  fontWeight: 600, 
  fontSize: 10,
});

const getLabelBgStyle = (theme: string) => ({
  fill: theme === 'dark' ? '#18181b' : '#ffffff',
  stroke: theme === 'dark' ? '#3f3f46' : '#e4e4e7',
  strokeWidth: 1, 
  rx: 6, 
  ry: 6,
});

const createEdges = (edges: any[], theme: string) => {
  return edges.map(e => ({
    ...e,
    type: e.type || 'smoothstep',
    style: { ...getEdgeStyle(theme), ...(e.style || {}) },
    labelStyle: getLabelStyle(theme),
    labelBgStyle: getLabelBgStyle(theme),
    labelBgPadding: [6, 4],
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: theme === 'dark' ? '#52525b' : '#a1a1aa',
    },
  }));
};

function FlowViewer({ nodes, rawEdges, theme }: { nodes: any[], rawEdges: any[], theme: string }) {
  const edges = useMemo(() => createEdges(rawEdges, theme), [rawEdges, theme]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      proOptions={{ hideAttribution: true }}
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={false}
      panOnDrag={false}
      zoomOnScroll={false}
      zoomOnPinch={false}
      zoomOnDoubleClick={false}
      preventScrolling={false}
      className="bg-transparent"
    >
      <Background 
        color={theme === 'dark' ? '#3f3f46' : '#d4d4d8'} 
        gap={20} 
        size={1.5} 
        style={{
          maskImage: 'radial-gradient(50% 50% at 50% 50%, black 70%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(50% 50% at 50% 50%, black 70%, transparent 100%)'
        }}
      />
    </ReactFlow>
  );
}

export default function UseCasesSection() {
  const [activeTab, setActiveTab] = useState(0);
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = mounted ? (resolvedTheme || 'dark') : 'dark';

  return (
    <section className="w-full bg-transparent py-24 relative ">
      {/* Immersive Background Glows */}
      <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[140px] pointer-events-none mix-blend-screen" />
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-blue-500/10 rounded-full blur-[140px] pointer-events-none mix-blend-screen" />
      
      <div className="container mx-auto px-4 lg:px-8 max-w-[1200px] relative z-10">
        
        {/* Header */}
        <div className="mb-16 text-center max-w-4xl mx-auto">
           <h2 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight text-foreground">
             Automate <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#ff4b4b] to-[#ff994b]">everything.</span>
           </h2>
           <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
             Connect your tools, deploy AI agents, and build powerful workflows visually. <br className="hidden md:block"/>
             Turn natural language into robust automations without breaking a sweat.
           </p>
        </div>

        {/* Horizontal Nav Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-10 z-20 relative">
          {tabs.map((tab, idx) => {
            const isActive = activeTab === idx;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(idx)}
                className={cn(
                  "px-6 py-2.5 rounded-full transition-all duration-300 relative font-medium text-sm border overflow-hidden",
                  isActive 
                    ? "text-primary-foreground border-primary shadow-[0_0_20px_rgba(255,75,75,0.2)]" 
                    : "text-muted-foreground border-border bg-card/40 hover:bg-card hover:text-foreground backdrop-blur-md"
                )}
              >
                {isActive && (
                  <motion.div 
                    layoutId="activeTabPill"
                    className="absolute inset-0 bg-primary -z-10"
                    transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  {tab.prefix} <span className={isActive ? "opacity-80 font-normal" : "opacity-60 font-normal"}>{tab.suffix}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Interactive Canvas Area */}
        <div 
          className="w-full h-[650px] bg-black/10 overflow-hidden relative group"
        >
           
           {mounted && (
             <AnimatePresence mode="wait">
               <motion.div
                 key={activeTab}
                 initial={{ opacity: 0, scale: 0.98, filter: "blur(10px)" }}
                 animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                 exit={{ opacity: 0, scale: 0.98, filter: "blur(10px)" }}
                 transition={{ duration: 0.5, ease: "easeOut" }}
                 className="w-full h-full relative"
               >
                 
                 {/* Floating Description Card */}
                 <div className="absolute top-8 left-8 z-20 max-w-[320px] pointer-events-none">
                    <div className="p-6 rounded-2xl bg-card/60 backdrop-blur-xl border border-white/10 shadow-2xl">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shadow-inner">
                           <div className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground">
                          {tabs[activeTab].prefix} {tabs[activeTab].suffix}
                        </h3>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {tabs[activeTab].description}
                      </p>
                    </div>
                 </div>

                 {/* Flow Viewer */}
                 {activeTab === 0 && <FlowViewer nodes={itOpsNodes} rawEdges={itOpsRawEdges} theme={currentTheme} />}
                 {activeTab === 1 && <FlowViewer nodes={secOpsNodes} rawEdges={secOpsRawEdges} theme={currentTheme} />}
                 {activeTab === 2 && <FlowViewer nodes={devOpsNodes} rawEdges={devOpsRawEdges} theme={currentTheme} />}
                 {activeTab === 3 && <FlowViewer nodes={salesNodes} rawEdges={salesRawEdges} theme={currentTheme} />}
                 
                 {/* Empty State for Video */}
                 {activeTab === 4 && (
                   <div className="w-full h-full flex flex-col items-center justify-center relative bg-background/20">
                     <div 
                       className="absolute inset-0 opacity-40"
                       style={{
                         backgroundImage: `radial-gradient(${currentTheme === 'dark' ? '#3f3f46' : '#d4d4d8'} 1px, transparent 1px)`,
                         backgroundSize: '24px 24px',
                         maskImage: 'radial-gradient(50% 50% at 50% 50%, black 70%, transparent 100%)',
                         WebkitMaskImage: 'radial-gradient(50% 50% at 50% 50%, black 70%, transparent 100%)'
                       }}
                     />
                     <div className="z-10 bg-card/60 backdrop-blur-2xl p-8 rounded-[2rem] border border-white/10 text-center max-w-md shadow-2xl relative overflow-hidden group cursor-pointer hover:border-primary/50 transition-colors duration-500">
                       <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
                       
                       <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6 relative z-10 shadow-inner group-hover:scale-110 transition-transform duration-500">
                         <Play className="w-8 h-8 text-primary ml-1" fill="currentColor" />
                       </div>
                       
                       <h3 className="text-2xl font-semibold text-foreground mb-3 relative z-10">See it in action</h3>
                       <p className="text-muted-foreground relative z-10 leading-relaxed">
                         Watch our quick 2-minute pitch to see how teams use these workflows to completely transform their daily operations.
                       </p>
                     </div>
                   </div>
                 )}
               </motion.div>
             </AnimatePresence>
           )}
        </div>

      </div>
    </section>
  );
}
