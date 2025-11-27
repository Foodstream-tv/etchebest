"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  Search,
  User,
  Menu,
  X,
  ChevronDown,
  Radio,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useTheme } from "@/components/theme/ThemeProvider";

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

function initialsOf(name?: string, email?: string) {
  return (name || email || "?")
    .split(" ")
    .map((s) => s[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

export default function Header() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [openCuisine, setOpenCuisine] = useState(false);
  const [openLives, setOpenLives] = useState(false);
  const [openProfile, setOpenProfile] = useState(false);

  const cuisineRef = useRef<HTMLDivElement>(null);
  const livesRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const { user, setUser } = useAuth();
  const { theme, toggleTheme } = useTheme();

  // Fermer les menus si clic à l’extérieur
  useEffect(() => {
    const clickOut = (e: MouseEvent) => {
      if (cuisineRef.current && !cuisineRef.current.contains(e.target as Node))
        setOpenCuisine(false);
      if (livesRef.current && !livesRef.current.contains(e.target as Node))
        setOpenLives(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node))
        setOpenProfile(false);
    };
    document.addEventListener("mousedown", clickOut);
    return () => document.removeEventListener("mousedown", clickOut);
  }, []);

  const signOut = () => {
    setUser(null);
    window.location.href = "/signin";
  };

  return (
    <header className="sticky top-0 z-40">
      {/* petite barre dégradée */}
      <div className="h-1 w-full bg-gradient-to-r from-amber-500 via-rose-500 to-fuchsia-500" />

      <div className="bg-white/80 backdrop-blur-md shadow-[0_1px_0_rgba(0,0,0,0.06)] dark:bg-neutral-900/80">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/foodstream-logo.png"
              alt="FoodStream"
              width={28}
              height={28}
            />
            <span className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              FoodStream
            </span>
          </Link>

          {/* Nav desktop */}
          <nav className="hidden items-center gap-6 md:flex">
            <NavLink href="/home">Accueil</NavLink>

            <div className="relative" ref={livesRef}>
              <button
                onClick={() => setOpenLives((s) => !s)}
                className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white"
              >
                Lives{" "}
                <ChevronDown
                  className={`h-4 w-4 transition ${
                    openLives ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openLives && (
                <div className="absolute left-0 top-full mt-2 w-56 rounded-xl border bg-white p-2 shadow-lg animate-fadeIn dark:border-white/10 dark:bg-neutral-900">
                  {liveSections.map((it) => (
                    <Link
                      key={it.label}
                      href={it.href}
                      onClick={() => setOpenLives(false)}
                      className="block rounded-lg px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-neutral-800"
                    >
                      {it.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="relative" ref={cuisineRef}>
              <button
                onClick={() => setOpenCuisine((s) => !s)}
                className="inline-flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white"
              >
                Cuisines{" "}
                <ChevronDown
                  className={`h-4 w-4 transition ${
                    openCuisine ? "rotate-180" : ""
                  }`}
                />
              </button>
              {openCuisine && (
                <div className="absolute left-0 top-full mt-2 grid w-[520px] grid-cols-2 gap-2 rounded-xl border bg-white p-3 shadow-lg animate-fadeIn dark:border-white/10 dark:bg-neutral-900">
                  {cuisines.map((c) => (
                    <Link
                      key={c.label}
                      href={c.href}
                      onClick={() => setOpenCuisine(false)}
                      className="rounded-lg px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-neutral-800"
                    >
                      {c.label}
                    </Link>
                  ))}
                  <div className="col-span-2 mt-1 border-t pt-2 dark:border-white/10">
                    <Link
                      href="/cuisines"
                      onClick={() => setOpenCuisine(false)}
                      className="text-sm font-medium text-amber-700 hover:text-amber-800 dark:text-amber-400 dark:hover:text-amber-300"
                    >
                      Explorer toutes les cuisines →
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <NavLink href="/shop">Boutique</NavLink>
          </nav>

          {/* Right side */}
          <div className="hidden items-center gap-3 md:flex">
            {/* Search */}
            <form
              onSubmit={(e) => e.preventDefault()}
              className="relative w-[300px] lg:w-[360px]"
            >
              <Search className="pointer-events-none absolute left-3 top-2.5 h-5 w-5 text-gray-400 dark:text-gray-500" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Rechercher un live ou une recette…"
                className="w-full rounded-full border border-gray-300 bg-white/90 py-2 pl-10 pr-3 text-sm text-gray-900 outline-none transition focus:border-gray-900 dark:border-white/20 dark:bg-neutral-900/80 dark:text-gray-100 dark:focus:border-white"
              />
            </form>

            {/* Studio */}
            <Link
              href="/studio"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-white shadow hover:brightness-105"
            >
              <Radio className="h-4 w-4" />
              Commencer un live
            </Link>

            {/* Toggle thème */}
            <button
              type="button"
              onClick={toggleTheme}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white/80 text-gray-800 hover:bg-gray-50 dark:border-white/20 dark:bg-neutral-900 dark:text-gray-100 dark:hover:bg-neutral-800"
              aria-label="Changer le thème"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>

            {/* Auth / profil */}
            {!user ? (
              <Link
                href="/signin"
                className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white/80 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-white/20 dark:bg-neutral-900 dark:text-gray-100 dark:hover:bg-neutral-800"
              >
                <User className="h-4 w-4" />
                Se connecter
              </Link>
            ) : (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setOpenProfile((s) => !s)}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white/80 pl-1 pr-3 py-1.5 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-white/20 dark:bg-neutral-900 dark:text-gray-100 dark:hover:bg-neutral-800"
                >
                  {user.avatar ? (
                    <Image
                      src={user.avatar}
                      alt={user.name}
                      width={28}
                      height={28}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-xs font-bold text-white">
                      {initialsOf(user.name, user.email)}
                    </div>
                  )}
                  Mon profil
                  <ChevronDown
                    className={`h-4 w-4 transition ${
                      openProfile ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openProfile && (
                  <div className="absolute right-0 top-full mt-2 w-56 rounded-xl border bg-white p-2 shadow-lg animate-fadeIn dark:border-white/10 dark:bg-neutral-900">
                    <Link
                      href="/profile"
                      onClick={() => setOpenProfile(false)}
                      className="block rounded-lg px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-neutral-800"
                    >
                      Voir le profil
                    </Link>
                    <Link
                      href="/favorites"
                      onClick={() => setOpenProfile(false)}
                      className="block rounded-lg px-3 py-2 text-sm text-gray-800 hover:bg-gray-50 dark:text-gray-100 dark:hover:bg-neutral-800"
                    >
                      Mes favoris
                    </Link>
                    <button
                      onClick={signOut}
                      className="mt-1 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                    >
                      <LogOut className="h-4 w-4" /> Se déconnecter
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile toggle */}
          <div className="flex items-center md:hidden">
            <button
              aria-label="Menu"
              onClick={() => setOpen((s) => !s)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-gray-300 bg-white/80 text-gray-800 dark:border-white/20 dark:bg-neutral-900 dark:text-gray-100"
            >
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="relative text-sm font-medium text-gray-700 transition hover:text-gray-900 dark:text-gray-200 dark:hover:text-white
                 after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-0 after:bg-amber-500
                 after:content-[''] hover:after:w-full"
    >
      {children}
    </Link>
  );
}
