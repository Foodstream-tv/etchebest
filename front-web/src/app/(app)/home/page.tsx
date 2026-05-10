"use client";

import { useState } from "react";

import PageContainer from "@/components/app/PageContainer";
import HomeHero from "@/components/home/HomeHero";
import HomeLiveGrid from "@/components/home/HomeLiveGrid";
import HomeFooter from "@/components/home/HomeFooter";

export default function HomePage() {
  const [filters, setFilters] = useState({
    q: "",
    tag: "Tout",
  });

  return (
    <main className="min-h-screen w-full">
      <PageContainer className="py-6 lg:py-8">
        <HomeHero
          onSearch={({ q, tag }) => {
            setFilters({
              q,
              tag,
            });
          }}
        />

        <HomeLiveGrid
          query={filters.q}
          tag={filters.tag}
        />
      </PageContainer>

      <HomeFooter />
    </main>
  );
}