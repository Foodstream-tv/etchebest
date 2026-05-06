"use client";

import Image from "next/image";
import Link from "next/link";

type Category = {
  title: string;
  description: string;
  image: string;
  href: string;
};

const categories: Category[] = [
  {
    title: "Ustensiles",
    description: "Tout pour cuisiner comme un chef",
    image:
      "https://images.unsplash.com/photo-1514986888952-8cd320577b68?auto=format&fit=crop&w=1400&q=80",
    href: "/shop/ustensiles",
  },
  {
    title: "Matériel Live",
    description: "Améliore la qualité de tes streams",
    image:
      "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=1400&q=80",
    href: "/shop/live",
  },
  {
    title: "Nourriture",
    description: "Ingrédients & kits prêts à cuisiner",
    image:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1400&q=80",
    href: "/shop/food",
  },
];

function CategoryCard({ category }: { category: Category }) {
  return (
    <Link
      href={category.href}
      className="group relative h-[420px] overflow-hidden rounded-3xl"
    >
      <Image
        src={category.image}
        alt={category.title}
        fill
        className="object-cover transition duration-500 group-hover:scale-110"
      />

      <div className="absolute inset-0 bg-black/40 transition group-hover:bg-black/50" />

      <div className="absolute bottom-0 p-6 text-white">
        <h2 className="text-2xl font-extrabold">{category.title}</h2>
        <p className="mt-2 text-sm text-gray-200">{category.description}</p>

        <div className="mt-4 inline-block rounded-full bg-white/20 px-4 py-2 text-sm font-semibold backdrop-blur">
          Explorer →
        </div>
      </div>
    </Link>
  );
}

export default function ShopPage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-6 py-10">
      <section className="relative overflow-hidden rounded-3xl border border-gray-200 bg-gradient-to-br from-orange-50 via-white to-amber-50 p-8 dark:border-gray-800 dark:from-neutral-900 dark:via-neutral-950 dark:to-neutral-900">
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-orange-300/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-orange-200/20 blur-3xl" />

        <div className="relative z-10">
          <p className="text-sm font-semibold uppercase tracking-widest text-orange-600 dark:text-orange-300">
            Boutique FoodStream
          </p>

          <h1 className="mt-3 text-4xl font-extrabold tracking-tight text-gray-900 dark:text-white">
            Équipe-toi pour tes lives 🍳
          </h1>

          <p className="mt-4 max-w-2xl text-gray-600 dark:text-gray-300">
            Découvre les meilleurs outils, équipements et ingrédients utilisés
            par les streamers FoodStream.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
              type="button"
            >
              Voir les tendances
            </button>

            <button
              className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold transition hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-neutral-800"
              type="button"
            >
              Produits populaires
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {categories.map((cat) => (
          <CategoryCard key={cat.href} category={cat} />
        ))}
      </section>
    </main>
  );
}