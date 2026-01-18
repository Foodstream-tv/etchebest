"use client";

import Link from "next/link";
import { Search, SlidersHorizontal } from "lucide-react";

export default function HomeTopNav() {
  return (
    <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur dark:border-white/10 dark:bg-neutral-950/70">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-orange-500" />
          <span className="text-sm font-semibold">Foodstream</span>
        </Link>

        {/* Nav */}
        <nav className="hidden items-center gap-5 text-sm text-gray-700 dark:text-gray-200 md:flex">
          <Link className="hover:text-gray-900 dark:hover:text-white" href="#">
            Accueil
          </Link>
          <Link className="hover:text-gray-900 dark:hover:text-white" href="#">
            Lives
          </Link>
          <Link className="hover:text-gray-900 dark:hover:text-white" href="#">
            Replays
          </Link>
          <Link className="hover:text-gray-900 dark:hover:text-white" href="#">
            Planifiés
          </Link>
          <Link className="hover:text-gray-900 dark:hover:text-white" href="#">
            Chefs
          </Link>
          <Link className="hover:text-gray-900 dark:hover:text-white" href="#">
            Profil
          </Link>
        </nav>

        {/* Search */}
        <div className="ml-auto flex w-full max-w-xl items-center gap-2 rounded-xl border bg-white px-3 py-2 shadow-sm dark:border-white/10 dark:bg-neutral-900 md:w-auto md:flex-1">
          <Search className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <input
            className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
            placeholder="Rechercher un chef, un plat..."
          />
        </div>

        {/* Filters */}
        <button className="hidden items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-50 dark:border-white/10 dark:bg-neutral-900 dark:hover:bg-neutral-800 md:flex">
          <SlidersHorizontal className="h-4 w-4" />
          Filtres
        </button>

        {/* Right actions */}
        <div className="hidden items-center gap-2 md:flex">
          <button className="rounded-xl border bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-50 dark:border-white/10 dark:bg-neutral-900 dark:hover:bg-neutral-800">
            Sombre
          </button>
          <button className="rounded-xl border bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-50 dark:border-white/10 dark:bg-neutral-900 dark:hover:bg-neutral-800">
            FR
          </button>
          <button className="rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600">
            Go live
          </button>
          <div className="h-9 w-9 rounded-full bg-gray-200 dark:bg-white/10" />
        </div>
      </div>
    </header>
  );
}
