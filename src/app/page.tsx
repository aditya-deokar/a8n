import Hero from "@/components/landing/hero";
import UseCasesSection from "@/components/landing/use-cases";
import VisualEditorSection from "@/components/landing/visual-editor";
import AINodesSection from "@/components/landing/ai-nodes";
import KeyFeatures from "@/components/landing/key-features";
import HowItWorks from "@/components/landing/how-it-works";
import Pricing from "@/components/landing/pricing";
import Footer from "@/components/landing/footer";
import Navbar from "@/components/landing/navbar";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between">
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
