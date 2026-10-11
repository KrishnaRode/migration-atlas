import { Footer, TopNav } from "@/components/shell";
import { Features } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";
import { SampleEstates } from "@/components/landing/SampleEstates";
import { Showcase } from "@/components/landing/Showcase";
import { Journey, Manifesto, Personas, PrivacyBand, Understands } from "@/components/landing/Story";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-surface">
      <TopNav transparent />
      <main className="flex-1">
        <Hero />
        <Manifesto />
        <Showcase />
        <Journey />
        <Understands />
        <Features />
        <Personas />
        <SampleEstates />
        <PrivacyBand />
      </main>
      <Footer />
    </div>
  );
}
