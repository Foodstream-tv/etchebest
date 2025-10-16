"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Search, User, Menu, X, ChevronDown, Radio } from "lucide-react";

const cuisines = [
  { label: "Asiatique", href: "/cuisine/asiatique" },
  { label: "Africain", href: "/cuisine/africain" },
  { label: "Européen", href: "/cuisine/europeen" },
  { label: "Américain", href: "/cuisine/americain" },
  { label: "Végétarien", href: "/cuisine/vegetarien" },
];

const liveSections = [
  { label: "En direct", href: "/lives?filter=live" },
  { label: "Populaires", href: "/lives?filter=popular" },
  { label: "Replays", href: "/lives?filter=replay" },
  { label: "Planifiés", href: "/lives?filter=scheduled" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [openCuisine, setOpenCuisine] = useState(false);
  const [openLives, setOpenLives] = useState(false);

  const cuisineRef = useRef<HTMLDivElement>(null);
  const livesRef = useRef<HTMLDivElement>(null);

  // Ferme les menus si clic à l’extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        cuisineRef.current &&
        !cuisineRef.current.contains(e.target as Node)
      ) {
        setOpenCuisine(false);
      }
      if (
        livesRef.current &&
        !livesRef.current.contains(e.target as Node)
      ) {
        setOpenLives(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40">
      <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-500" />

      <div className="bg-white/80 backdrop-blur-md shadow-[0_1px_0_rgba(0,0,0,0.06)]">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2">
            <Image src="/images/foodstream-logo.png" alt="FoodStream" width={28} height={28} />
            <span className="text-lg font-semibold tracking-tight">FoodStream</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 md:flex">
            <NavLink href="/home">Accueil</NavLink>

            {/* Dropdown Lives (cliquable + persistant) */}
            <div className="relative" ref={livesRef}>
              <button
                onClick={() => setOpenLives((prev) => !prev)}
                className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Lives <ChevronDown className={`h-4 w-4 transition ${openLives ? "rotate-180" : ""}`} />
              </button>
              {openLives && (
                <div className="absolute left-0 top-full mt-2 w-56 rounded-xl border bg-white p-2 shadow-lg animate-fadeIn">
                  {liveSections.map((it) => (
                    <Link
                      key={it.label}
                      href={it.href}
                      onClick={() => setOpenLives(false)}
                      className="block rounded-lg px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
                    >
                      {it.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Dropdown Cuisines (cliquable + persistant) */}
            <div className="relative" ref={cuisineRef}>
              <button
                onClick={() => setOpenCuisine((prev) => !prev)}
                className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                Cuisines <ChevronDown className={`h-4 w-4 transition ${openCuisine ? "rotate-180" : ""}`} />
              </button>
              {openCuisine && (
                <div className="absolute left-0 top-full mt-2 grid w-[520px] grid-cols-2 gap-2 rounded-xl border bg-white p-3 shadow-lg animate-fadeIn">
                  {cuisines.map((c) => (
                    <Link
                      key={c.label}
                      href={c.href}
                      onClick={() => setOpenCuisine(false)}
                      className="rounded-lg px-3 py-2 text-sm text-gray-800 hover:bg-gray-50"
                    >
                      {c.label}
                    </Link>
                  ))}
                  <div className="col-span-2 mt-1 border-t pt-2">
                    <Link
                      href="/cuisines"
                      className="text-sm font-medium text-amber-700 hover:text-amber-800"
                      onClick={() => setOpenCuisine(false)}
                    >
                      Explorer toutes les cuisines →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <NavLink href="/shop">Boutique</NavLink>
          </nav>

          {/* Search + CTAs */}
          <div className="hidden items-center gap-3 md:flex">
            <form onSubmit={(e) => e.preventDefault()} className="relative w-[300px] lg:w-[360px]">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un live ou une recette…"
                className="w-full rounded-full border border-gray-300 bg-white/90 py-2 pl-10 pr-3 text-sm outline-none transition focus:border-gray-900"
              />
            </form>

            <Link
              href="/studio"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow hover:brightness-105"
            >
              <Radio className="h-4 w-4" />
              Commencer un live
            </Link>

            <Link
              href="/signin"
              className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white/80 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              <User className="h-4 w-4" />
              Se connecter
            </Link>
          </div>

          {/* Mobile toggle */}
          <div className="flex items-center md:hidden">
            <button
              aria-label="Menu"
              onClick={() => setOpen((s) => !s)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white/80"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

/* ---------- Subcomponents ---------- */
function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="relative text-sm font-medium text-gray-700 transition hover:text-gray-900
                 after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-0 after:bg-amber-500
                 after:content-[''] hover:after:w-full"
    >
      {children}
    </Link>
  );
}
