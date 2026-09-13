"use client";

import Image from "next/image";
import Link from "next/link";
import { useI18n } from "@/i18n/LanguageContext";

type Category = {
  title: string;
  description: string;
  image: string;
  href: string;
  priority?: boolean;
};

function CategoryCard({ category, exploreLabel }: Readonly<{ category: Category; exploreLabel: string }>) {
  return (
    <Link
      href={category.href}
      aria-label={`Explorer la catégorie ${category.title}`}
      className="group relative h-[420px] overflow-hidden rounded-3xl"
    >
      <Image
        src={category.image}
        alt=""
        fill
        sizes="(max-width: 768px) 100vw, 33vw"
        priority={category.priority}
        className="object-cover transition duration-500 group-hover:scale-110"
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/40 transition group-hover:bg-black/50"
      />

      <div className="absolute bottom-0 p-6 text-white">
        <h2 className="text-2xl font-extrabold">
          {category.title}
        </h2>

        <p className="mt-2 text-sm text-gray-200">
          {category.description}
        </p>

        <div
          aria-hidden="true"
          className="mt-4 inline-block rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur"
        >
          {exploreLabel}
        </div>
      </div>
    </Link>
  );
}

export default function ShopPage() {
  const { t } = useI18n();

  const categories: Category[] = [
    {
      title: t("shop.cat.utensils"),
      description: t("shop.cat.utensilsDesc"),
      image:
        "https://images.unsplash.com/photo-1514986888952-8cd320577b68?auto=format&fit=crop&w=1400&q=80",
      href: "/shop/ustensiles",
      priority: true,
    },
    {
      title: t("shop.cat.liveGear"),
      description: t("shop.cat.liveGearDesc"),
      image:
        "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1400&q=80",
      href: "/shop/live",
      priority: true,
    },
    {
      title: t("shop.cat.food"),
      description: t("shop.cat.foodDesc"),
      image:
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1400&q=80",
      href: "/shop/food",
      priority: true,
    },
  ];

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-10"
    >
      <section className="relative overflow-hidden rounded-3xl border border-gray-200 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-8 dark:border-gray-800 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-900">
        <div
          aria-hidden="true"
          className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-orange-300/30 blur-3xl"
        />

        <div
          aria-hidden="true"
          className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-orange-200/20 blur-3xl"
        />

        <div className="relative z-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-orange-600 dark:text-orange-300">
            {t("shop.title")}
          </p>

          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            {t("shop.heroTitle")}
          </h1>

          <p className="mt-4 max-w-2xl text-gray-600 dark:text-gray-300">
            {t("shop.heroDesc")}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
            >
              {t("shop.trends")}
            </button>

            <button
              type="button"
              className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold transition hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-neutral-800"
            >
              {t("shop.popular")}
            </button>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="shop-categories-title"
        className="grid gap-6 md:grid-cols-3"
      >
        <h2 id="shop-categories-title" className="sr-only">
          {t("shop.title")}
        </h2>

        {categories.map((cat) => (
          <CategoryCard key={cat.href} category={cat} exploreLabel={t("shop.explore")} />
        ))}
      </section>
    </main>
  );
}