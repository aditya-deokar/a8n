import Hero from "@/components/landing/hero";
import UseCasesSection from "@/components/landing/use-cases";
import VisualEditorSection from "@/components/landing/visual-editor";
import AINodesSection from "@/components/landing/ai-nodes";
import KeyFeatures from "@/components/landing/key-features";
import HowItWorks from "@/components/landing/how-it-works";
import Pricing from "@/components/landing/pricing";
import Footer from "@/components/landing/footer";
import Navbar from "@/components/landing/navbar";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "a8n | Advanced Visual Workflow Automation",
  description: "Build, automate, and orchestrate complex workflows with our intuitive visual editor and powerful AI nodes. Connect your favorite tools seamlessly.",
  keywords: [
    "workflow automation",
    "visual editor",
    "AI nodes",
    "no-code automation",
    "developer tools",
    "API integration"
  ],
};

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between overflow-x-hidden w-full">
      <Navbar />
      <Hero />
      <UseCasesSection />
      <VisualEditorSection />
      {/* <AINodesSection />
      <KeyFeatures />
      <HowItWorks />
      <Pricing />
      <Footer /> */}
    </main>
  );
}
