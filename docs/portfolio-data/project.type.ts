// Unified types for Project Showcase components
// Single source of truth - used by both data and components

// ============================================
// Core Data Types
// ============================================

export interface Technology {
  name: string;
  category: string;
  description?: string;
  version?: string;
}

export interface TechStats {
  totalTechnologies: string;
  typescriptCoverage: string;
  microservices?: string;
  aiModels?: string;
  mcpTools?: string;
  nodeTypes?: string;
}

export interface OverviewKeyPoint {
  number: string;
  title: string;
  description: string;
}

export interface OverviewQuote {
  text: string;
  label: string;
}

// ============================================
// Architecture Highlight Types
// ============================================

export interface ArchitectureHighlight {
  title: string;
  description: string;
  icon?: string;
}

// ============================================
// Feature Types
// ============================================

export interface FeatureImpact {
  metric: string;
  label: string;
}

export interface Feature {
  number: string;
  title: string;
  description: string;
  tags: string[];
  impact: FeatureImpact[];
}

// ============================================
// Process Types
// ============================================

export interface ProcessPhase {
  phase: string;
  title: string;
  subtitle: string;
  description: string;
  keywords: string[];
}

export interface ProcessStats {
  phases: string;
  technologies: string;
  ciTimeReduction?: string;
  uptime?: string;
  dropOffReduction?: string;
  dauIncrease?: string;
  designIterations?: string;
  aiWorkflows?: string;
  nodeTypes?: string;
  documentationArtifacts?: string;
  mcpTools?: string;
  realtimeChannels?: string;
}

// ============================================
// Outcome Types
// ============================================

export interface Outcome {
  metric: string;
  label: string;
}

// ============================================
// Footer & CTA Types
// ============================================

export interface ContactInfo {
  label: string;
  value: string;
  url: string | null;
  hasIndicator?: boolean;
}

export interface FooterCta {
  heading: {
    text: string;
    highlight: string;
    suffix: string;
  };
  primaryButton: {
    text: string;
    url: string;
  };
  secondaryButton: {
    text: string;
    url: string;
  };
  contactInfo: ContactInfo[];
}

export interface SocialLink {
  name: string;
  url: string;
}

export interface Footer {
  description: string;
  social: SocialLink[];
  quickLinks: string[];
  projects: string[];
  resources: string[];
  legal: string[];
  copyright: string;
  rightsReserved: string;
}

// ============================================
// Component-Specific Types
// ============================================

export interface SelectedPoint {
  number: string;
  title: string;
  description: string;
  summary?: string;
}

// ============================================
// Main Project Interface
// ============================================

export interface DetailedProject {
  name: string;
  tagline: string;
  year: string;
  role: string;
  duration: string;
  team: string;
  category: string;
  liveUrl?: string;
  repoUrl?: string;
  docsUrl?: string;
  navigation: string[];
  overviewDescription: string;
  overviewKeyPoints: OverviewKeyPoint[];
  overviewQuote: OverviewQuote;
  architectureHighlights?: ArchitectureHighlight[];
  technologies: {
    frontend: Technology[];
    backend: Technology[];
    ai?: Technology[];
    infrastructure?: Technology[];
    devops?: Technology[];
  };
  techStats: TechStats;
  overview: string;
  features: Feature[];
  process: ProcessPhase[];
  processStats: ProcessStats;
  outcomes: Outcome[];
  videos?: string[];
  footerCta: FooterCta;
  footer: Footer;
}

// Alias for backward compatibility with components
export type ProjectData = DetailedProject;
export type FooterCtaData = FooterCta;
export type FooterData = Footer;
