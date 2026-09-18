"use client";

import { useState } from "react";

import PageContainer from "@/components/app/PageContainer";
import HomeHero from "@/components/home/HomeHero";
import HomeFeaturedLives from "@/components/home/HomeFeaturedLives";
import HomeCuisineCategories from "@/components/home/HomeCuisineCategories";
import HomePopularCreators from "@/components/home/HomePopularCreators";
import HomeFooter from "@/components/home/HomeFooter";

export default function HomePage() {
  const [filters, setFilters] = useState<{ q: string; tags: string[] }>({
    q: "",
    tags: [],
  });

  return (
    <main id="main-content" className="min-h-screen w-full">
      <PageContainer className="py-6 lg:py-8">
        <HomeHero
          onSearch={({ q, tags }) => {
            setFilters({
              q,
              tags,
            });
          }}
        />

        <HomeFeaturedLives query={filters.q} tags={filters.tags} />

        <HomeCuisineCategories />

        <HomePopularCreators />
      </PageContainer>

      <HomeFooter />
    </main>
  );
}