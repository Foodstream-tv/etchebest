"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";

type NavItem = {
  label: string;
  href: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Accueil", href: "/home" },
  { label: "Lives", href: "/stream" },
  { label: "Studio", href: "/studio" },
  { label: "Profil", href: "/profile" },
];

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function AppTopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur dark:border-white/10 dark:bg-neutral-950/70">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-6 py-3">
        {/* LOGO */}
        <Link href="/home" className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Foodstream"
            width={32}
            height={32}
            priority
          />
          <span className="text-sm font-semibold">Foodstream</span>
        </Link>

        {/* NAV */}
        <nav className="hidden items-center gap-5 text-sm text-gray-700 dark:text-gray-200 md:flex">
          {NAV_ITEMS.map((item) => {
            const active =
              item.href === "/home"
                ? pathname === "/home"
                : pathname?.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cx(
                  "transition hover:text-gray-900 dark:hover:text-white",
                  active && "font-semibold text-gray-900 dark:text-white"
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* SEARCH */}
        <form
          className="ml-auto flex w-full max-w-xl items-center gap-2 rounded-xl border bg-white px-3 py-2 shadow-sm dark:border-white/10 dark:bg-neutral-900 md:w-auto md:flex-1"
          onSubmit={(e) => e.preventDefault()}
        >
          <Search className="h-4 w-4 text-gray-500 dark:text-gray-400" />
          <input
            name="q"
            placeholder="Rechercher un chef, un plat..."
            className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
        </form>

        {/* FILTERS */}
        <button
          type="button"
          className="hidden items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-50 dark:border-white/10 dark:bg-neutral-900 dark:hover:bg-neutral-800 md:flex"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filtres
        </button>

        {/* ACTIONS */}
        <div className="hidden items-center gap-2 md:flex">
          <button className="rounded-xl border bg-white px-3 py-2 text-sm shadow-sm hover:bg-gray-50 dark:border-white/10 dark:bg-neutral-900 dark:hover:bg-neutral-800">
            Sombre
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
