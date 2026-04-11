"use client";

import PageContainer from "@/components/app/PageContainer";
import HomeHero from "@/components/home/HomeHero";
import HomeLiveGrid from "@/components/home/HomeLiveGrid";
import HomeFooter from "@/components/home/HomeFooter";

export default function HomePage() {
  return (
    <main className="min-h-screen w-full">

      <PageContainer className="py-6 lg:py-8">
        <HomeHero />
        <HomeLiveGrid />
      </PageContainer>

      <HomeFooter />
    </main>
  );
}