"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Search, SlidersHorizontal, ShoppingBag, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { useEffect, useState } from "react";
import { globalSearch } from "@/lib/search";

type NavItem = {
  label: string;
  href: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: "Accueil", href: "/home" },
  { label: "Lives", href: "/watch" },
  { label: "Studio", href: "/studio" },
  { label: "Replays", href: "/replays" },
];

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function initialsOf(name?: string, email?: string) {
  return (name || email || "?")
    .split(" ")
    .map((s) => s[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

export default function AppTopNav() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<any>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const pathname = usePathname();
  const { user, ready, token } = useAuth();

  useEffect(() => {
    if (!search.trim()) {
      setResults(null);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const res = await globalSearch(search, token ?? undefined);
        setResults(res);
        setSearchOpen(true);
      } catch {
        setResults(null);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [search]);

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-950/70">
      <div className="mx-auto w-full px-4 sm:px-6 lg:max-w-[1400px] xl:max-w-[1600px]">
        <div className="flex h-16 items-center gap-3">
          {/* LOGO */}
          <Link href="/home" className="flex items-center gap-3 group">
            <div className="relative grid h-16 w-16 place-items-center overflow-hidden rounded-2xlgroup-hover:shadow-lg">
              <Image
                src="/logo.png"
                alt="Foodstream"
                fill
                className="object-contain p-2"
              />
            </div>

            {/* TEXTE (optionnel mais fortement recommandé) */}
            <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent hidden sm:block">
              Foodstream
            </span>
          </Link>

          {/* NAV */}
          <nav className="hidden items-center gap-2 pl-2 md:flex">
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
                    "rounded-full px-3 py-1.5 text-sm font-semibold transition",
                    active
                      ? "bg-gray-900 text-white shadow-sm dark:bg-white dark:text-neutral-900"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* SEARCH */}
          <div className="mx-auto hidden w-full max-w-xl md:block">
            <div className="relative">
              <form
                className="relative flex items-center gap-2 rounded-2xl bg-gray-50 px-3 py-2.5 ring-1 ring-black/5 transition focus-within:ring-orange-500/30 dark:bg-white/5 dark:ring-white/10"
                onSubmit={(e) => e.preventDefault()}
              >
                <Search className="h-4 w-4 text-gray-500 dark:text-gray-400" />

                <input
                  name="q"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onFocus={() => {
                    if (results) setSearchOpen(true);
                  }}
                  placeholder="Rechercher un chef"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </form>

              {searchOpen && results && (
                <div className="absolute left-0 right-0 top-[110%] z-50 overflow-hidden rounded-3xl border border-black/5 bg-white shadow-2xl dark:border-white/10 dark:bg-neutral-950">
                  {/* USERS */}
                  {results.users?.length > 0 && (
                    <div className="p-2">
                      <div className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-gray-400">
                        Chefs
                      </div>

                      {results.users.map((chef: any) => (
                        <Link
                          key={chef.id}
                          href={`/profile/${chef.id}`}
                          onClick={() => setSearchOpen(false)}
                          className="flex items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-orange-50 dark:hover:bg-white/5"
                        >
                          <div className="relative h-10 w-10 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                            {chef.profileImageUrl ? (
                              <Image
                                src={chef.profileImageUrl}
                                alt={chef.username}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-sm font-bold">
                                {initialsOf(chef.username)}
                              </div>
                            )}
                          </div>

                          <div>
                            <div className="text-sm font-semibold text-gray-900 dark:text-white">
                              {chef.username}
                            </div>

                            <div className="text-xs text-gray-500">
                              Chef FoodStream
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* LIVES */}
                  {results.lives?.length > 0 && (
                    <div className="border-t border-black/5 p-2 dark:border-white/10">
                      <div className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-gray-400">
                        Lives
                      </div>

                      {results.lives.map((live: any) => (
                        <Link
                          key={live.id}
                          href={`/watch/${live.id}`}
                          onClick={() => setSearchOpen(false)}
                          className="flex items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-orange-50 dark:hover:bg-white/5"
                        >
                          <div className="relative h-12 w-16 overflow-hidden rounded-xl bg-gray-200 dark:bg-white/10">
                            {live.thumbnailUrl && (
                              <Image
                                src={live.thumbnailUrl}
                                alt={live.title}
                                fill
                                className="object-cover"
                              />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                              {live.title}
                            </div>

                            <div className="text-xs text-gray-500">
                              {live.dishName}
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT */}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              className="hidden items-center gap-2 rounded-xl bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 ring-1 ring-black/5 hover:bg-gray-100 dark:bg-white/5 dark:text-gray-200 dark:ring-white/10 dark:hover:bg-white/10 md:flex"
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filtres
            </button>

            <Link
              href="/shop"
              className="hidden items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 md:inline-flex"
            >
              <ShoppingBag className="h-4 w-4" />
              Boutique
            </Link>

            {/* PROFILE BUTTON — PLUS EXPLICITE */}
            <Link
              href="/profile"
              className="group flex items-center gap-2 rounded-full px-2 py-1 transition hover:bg-gray-100 dark:hover:bg-white/10"
              title="Mon profil"
            >
              <div className="relative h-10 w-10 overflow-hidden rounded-full ring-1 ring-black/10 transition group-hover:ring-orange-500/40 dark:ring-white/10">
                {!ready ? (
                  <div className="h-full w-full animate-pulse bg-gray-200 dark:bg-white/10" />
                ) : user?.profileImageUrl ? (
                  <Image
                    src={user.profileImageUrl}
                    alt={user.username || user.email || "Profil"}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center bg-gray-200 text-sm font-bold text-gray-700 dark:bg-white/10 dark:text-gray-200">
                    {initialsOf(user?.username, user?.email)}
                  </div>
                )}
              </div>

              {/* Petit indicateur visuel */}
              <ChevronDown className="h-4 w-4 text-gray-500 transition group-hover:text-orange-500" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
