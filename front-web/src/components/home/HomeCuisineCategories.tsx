"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

const CATEGORIES = [
  {
    label: "Asiatique",
    description: "Ramen, wok, curry, bao...",
    emoji: "🍜",
    href: "/watch?tag=Asiatique",
  },
  {
    label: "Pâtisserie",
    description: "Gâteaux, macarons, desserts...",
    emoji: "🧁",
    href: "/watch?tag=Pâtisserie",
  },
  {
    label: "BBQ",
    description: "Grillades, sauces, fumage...",
    emoji: "🔥",
    href: "/watch?tag=BBQ",
  },
  {
    label: "Healthy",
    description: "Repas équilibrés et frais.",
    emoji: "🥗",
    href: "/watch?tag=Healthy",
  },
];

export default function HomeCuisineCategories() {
  return (
    <section className="mt-14">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
            Explorer par cuisine
          </h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Trouve rapidement le type de live qui te donne envie.
          </p>
        </div>

        <Link
          href="/watch"
          className="hidden items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-500 sm:inline-flex"
        >
          Tout explorer
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CATEGORIES.map((category) => (
          <Link
            key={category.label}
            href={category.href}
            className="group overflow-hidden rounded-[28px] border border-black/8 bg-white/70 p-5 shadow-sm backdrop-blur-md transition hover:-translate-y-1 hover:bg-white hover:shadow-xl dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-white/[0.07]"
          >
            <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-orange-50 text-3xl transition group-hover:scale-105 dark:bg-orange-500/10">
              {category.emoji}
            </div>

            <div className="text-base font-bold text-gray-950 dark:text-white">
              {category.label}
            </div>

            <p className="mt-1 text-sm leading-6 text-gray-500 dark:text-gray-400">
              {category.description}
            </p>

            <div className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-orange-600 transition group-hover:gap-3 dark:text-orange-300">
              Voir les lives
              <ArrowRight className="h-4 w-4" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}