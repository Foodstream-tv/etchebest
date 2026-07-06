"use client";

import Link from "next/link";
import { ArrowRight, Star, Users } from "lucide-react";

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

      <div className="rounded-[28px] border border-black/8 bg-white/72 p-8 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/[0.04] flex flex-col items-center justify-center text-center py-10">
        <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-300" aria-hidden="true">
          <Users className="h-7 w-7" />
        </div>
        <h3 className="text-sm font-bold text-gray-950 dark:text-white">
          Aucun chef à découvrir actuellement
        </h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-sm">
          Il n'y a pas encore d'autres profils de chefs disponibles à suivre sur la plateforme.
        </p>
      </div>
    </section>
  );
}