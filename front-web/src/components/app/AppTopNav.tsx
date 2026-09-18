/* eslint-disable jsx-a11y/role-supports-aria-props */
"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Search,
  ShoppingBag,
} from "lucide-react";

import { globalSearch, type SearchResponse } from "@/lib/search";
import { useAuth } from "@/lib/useAuth";

import { useI18n } from "@/i18n/LanguageContext";

type NavItem = {
  label: string;
  href: string;
};

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

function initialsOf(name?: string, email?: string) {
  return (name || email || "?")
    .split(" ")
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

export default function AppTopNav() {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [failedProfileImage, setFailedProfileImage] = useState(false);
  const [failedSearchImages, setFailedSearchImages] = useState<Set<string>>(
    new Set()
  );

  const searchRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const { user, ready, token } = useAuth();
  const { t } = useI18n();

  const navItems: NavItem[] = [
    { label: t("nav.home"), href: "/home" },
    { label: t("nav.lives"), href: "/watch" },
    { label: t("nav.studio"), href: "/studio" },
    { label: t("nav.replays"), href: "/replays" },
  ];

  useEffect(() => {
    if (!search.trim()) {
      setResults(null);
      setSearchOpen(false);
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        const res = await globalSearch(search.trim(), token ?? undefined);
        setResults(res);
        setSearchOpen(true);
      } catch {
        setResults(null);
        setSearchOpen(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [search, token]);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setSearchOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSearchOpen(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const hasResults =
    Boolean(results?.users?.length) || Boolean(results?.lives?.length);

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-white/80 backdrop-blur-xl dark:border-white/10 dark:bg-neutral-950/70">
      <div className="mx-auto w-full px-4 sm:px-6 lg:max-w-[1400px] xl:max-w-[1600px]">
        <div className="flex h-16 items-center gap-3">
          <Link
            href="/home"
            aria-label={t("nav.homeAria")}
            className="group flex items-center gap-3"
          >
            <div className="relative grid h-16 w-16 place-items-center overflow-hidden rounded-2xl group-hover:shadow-lg">
              <Image
                src="/logo.png"
                alt=""
                fill
                sizes="64px"
                className="object-contain p-2"
                priority
                aria-hidden="true"
              />
            </div>

            <span className="hidden bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-xl font-extrabold tracking-tight text-transparent sm:block">
              Foodstream
            </span>
          </Link>

          <nav
            className="hidden items-center gap-2 pl-2 md:flex"
            aria-label={t("nav.mainNavAria")}
          >
            {navItems.map((item) => {
              const active =
                item.href === "/home"
                  ? pathname === "/home"
                  : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
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

          <div ref={searchRef} className="mx-auto hidden w-full max-w-xl md:block">
            <div className="relative">
              <form
                role="search"
                className="relative flex items-center gap-2 rounded-2xl bg-gray-50 px-3 py-2.5 ring-1 ring-black/5 transition focus-within:ring-orange-500/30 dark:bg-white/5 dark:ring-white/10"
                onSubmit={(event) => event.preventDefault()}
              >
                <Search
                  className="h-4 w-4 text-gray-500 dark:text-gray-400"
                  aria-hidden="true"
                />

                <label htmlFor="top-nav-search" className="sr-only">
                  {t("nav.searchAria")}
                </label>

                <input
                  id="top-nav-search"
                  name="q"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onFocus={() => {
                    if (results) setSearchOpen(true);
                  }}
                  placeholder={t("nav.searchPlaceholder")}
                  autoComplete="off"
                  aria-expanded={searchOpen}
                  aria-controls="top-nav-search-results"
                  className="w-full bg-transparent text-sm outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
                />
              </form>

              {searchOpen && results ? (
                <div
                  id="top-nav-search-results"
                  role="region"
                  aria-label={t("nav.searchResultsAria")}
                  className="absolute left-0 right-0 top-[110%] z-50 overflow-hidden rounded-3xl border border-black/5 bg-white shadow-2xl dark:border-white/10 dark:bg-neutral-950"
                >
                  {hasResults ? (
                    <>
                      {results.users && results.users.length > 0 ? (
                        <div className="p-2">
                          <p className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-gray-400">
                            {t("nav.chefs")}
                          </p>

                          {results.users.map((chef) => {
                            const chefName =
                              chef.username || chef.email || "Chef FoodStream";

                            return (
                              <Link
                                key={chef.id}
                                href={`/profile/${chef.id}`}
                                onClick={() => setSearchOpen(false)}
                                className="flex items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-orange-50 dark:hover:bg-white/5"
                              >
                                <div className="relative h-10 w-10 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                                  {chef.profileImageUrl &&
                                  !failedSearchImages.has(chef.id) ? (
                                    <Image
                                      src={chef.profileImageUrl}
                                      alt={`Photo de profil de ${chefName}`}
                                      fill
                                      sizes="40px"
                                      className="object-cover"
                                      onError={() => {
                                        setFailedSearchImages(
                                          (prev) => new Set([...prev, chef.id])
                                        );
                                      }}
                                    />
                                  ) : (
                                    <div
                                      className="grid h-full w-full place-items-center text-sm font-bold"
                                      aria-hidden="true"
                                    >
                                      {initialsOf(chef.username, chef.email)}
                                    </div>
                                  )}
                                </div>

                                <div>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {chefName}
                                  </p>

                                  <p className="text-xs text-gray-500">
                                    {t("nav.chefRole")}
                                  </p>
                                </div>
                              </Link>
                            );
                          })}
                        </div>
                      ) : null}

                      {results.lives && results.lives.length > 0 ? (
                        <div className="border-t border-black/5 p-2 dark:border-white/10">
                          <p className="px-3 py-2 text-xs font-bold uppercase tracking-wide text-gray-400">
                            {t("nav.lives")}
                          </p>

                          {results.lives.map((live) => (
                            <Link
                              key={live.id}
                              href={`/watch/${encodeURIComponent(live.id)}`}
                              onClick={() => setSearchOpen(false)}
                              className="flex items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-orange-50 dark:hover:bg-white/5"
                            >
                              <div className="relative h-12 w-16 overflow-hidden rounded-xl bg-gray-200 dark:bg-white/10">
                                {live.thumbnailUrl ? (
                                  <Image
                                    src={live.thumbnailUrl}
                                    alt={`Miniature du live ${
                                      live.title || t("nav.untitledLive")
                                    }`}
                                    fill
                                    sizes="64px"
                                    unoptimized
                                    className="object-cover"
                                  />
                                ) : null}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                                  {live.title || t("nav.untitledLive")}
                                </p>

                                {live.dishName ? (
                                  <p className="text-xs text-gray-500">
                                    {live.dishName}
                                  </p>
                                ) : null}
                              </div>
                            </Link>
                          ))}
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="p-4 text-sm text-gray-500 dark:text-gray-400">
                      {t("nav.noResults")}
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">


            <Link
              href="/shop"
              className="hidden items-center gap-2 rounded-xl bg-orange-500 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-orange-600 md:inline-flex"
            >
              <ShoppingBag className="h-4 w-4" aria-hidden="true" />
              {t("nav.shop")}
            </Link>

            {ready && !user ? (
              <Link
                href="/signin"
                className="rounded-xl bg-gradient-to-r from-orange-500 to-red-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:from-orange-600 hover:to-red-600 transition"
              >
                {t("nav.signin")}
              </Link>
            ) : (
              <Link
                href="/profile"
                aria-label={t("nav.openProfileAria")}
                className="group flex items-center gap-2 rounded-full px-2 py-1 transition hover:bg-gray-100 dark:hover:bg-white/10"
                title={t("nav.myProfile")}
              >
                <div className="relative h-10 w-10 overflow-hidden rounded-full ring-1 ring-black/10 transition group-hover:ring-orange-500/40 dark:ring-white/10">
                  {!ready ? (
                    <div
                      className="h-full w-full animate-pulse bg-gray-200 dark:bg-white/10"
                      aria-hidden="true"
                    />
                  ) : user?.profileImageUrl && !failedProfileImage ? (
                    <Image
                      src={user.profileImageUrl}
                      alt={`Photo de profil de ${
                        user.username || user.email || "l'utilisateur"
                      }`}
                      fill
                      sizes="40px"
                      className="object-cover"
                      onError={() => setFailedProfileImage(true)}
                    />
                  ) : (
                    <div
                      className="grid h-full w-full place-items-center bg-gray-200 text-sm font-bold text-gray-700 dark:bg-white/10 dark:text-gray-200"
                      aria-hidden="true"
                    >
                      {initialsOf(user?.username, user?.email)}
                    </div>
                  )}
                </div>

                <ChevronDown
                  className="h-4 w-4 text-gray-500 transition group-hover:text-orange-500"
                  aria-hidden="true"
                />
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}