"use client";

import HomeHero from "@/components/home/HomeHero";
import HomeLiveGrid from "@/components/home/HomeLiveGrid";
import HomeFooter from "@/components/home/HomeFooter";

export default function HomePage() {
  return (
    <div className="flex min-h-[calc(100vh-64px)] flex-col">
      {/* Contenu principal */}
      <div className="flex-1">
        <HomeHero />
        <HomeLiveGrid />
      </div>

      {/* Footer */}
      <HomeFooter />
    </div>
  );
}
