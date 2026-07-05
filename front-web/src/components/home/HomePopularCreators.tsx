"use client";

import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";

const CREATORS = [
  {
    id: "1",
    name: "Aiko Tanaka",
    tag: "Ramen japonais",
    initials: "AT",
  },
  {
    id: "2",
    name: "Camille Dupont",
    tag: "Pâtisserie française",
    initials: "CD",
  },
  {
    id: "3",
    name: "Luis Ortega",
    tag: "Street food mexicaine",
    initials: "LO",
  },
];

export default function HomePopularCreators() {
  return (
    <section
      aria-labelledby="popular-creators-title"
      className="mt-14 pb-10"
    >
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1 text-xs font-bold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
            <Star className="h-3.5 w-3.5" aria-hidden="true" />
            Créateurs
          </div>

          <h2
            id="popular-creators-title"
            className="mt-3 text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50"
          >
            Chefs à découvrir
          </h2>

          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Suis des créateurs et ne rate plus leurs prochains lives.
          </p>
        </div>

        <Link
          href="/watch"
          className="hidden items-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-500 sm:inline-flex"
        >
          Découvrir plus
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {CREATORS.map((creator) => (
          <article
            key={creator.id}
            aria-labelledby={`creator-${creator.id}`}
            className="rounded-[28px] border border-black/8 bg-white/70 p-5 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04]"
          >
            <div className="flex items-center gap-4">
              <div
                aria-hidden="true"
                className="grid h-14 w-14 place-items-center rounded-2xl bg-gray-900 text-sm font-bold text-white dark:bg-white dark:text-neutral-900"
              >
                {creator.initials}
              </div>

              <div className="min-w-0 flex-1">
                <h3
                  id={`creator-${creator.id}`}
                  className="truncate text-sm font-bold text-gray-950 dark:text-white"
                >
                  {creator.name}
                </h3>

                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {creator.tag}
                </p>
              </div>
            </div>

            <button
              type="button"
              aria-label={`Suivre ${creator.name}`}
              className="mt-5 w-full rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-[0_10px_28px_rgba(249,115,22,0.24)] transition hover:bg-orange-400"
            >
              Suivre
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}