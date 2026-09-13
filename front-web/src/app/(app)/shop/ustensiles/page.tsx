"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCart } from "@/components/shop/CartContext";
import { useI18n } from "@/i18n/LanguageContext";

type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
};

const products: Product[] = [
  {
    id: "u1",
    name: "Couteau de chef japonais",
    price: 69,
    image:
      "https://images.unsplash.com/photo-1593618998160-e34014e67546?auto=format&fit=crop&w=900&q=80",
    category: "Ustensiles",
  },
  {
    id: "u2",
    name: "Planche à découper en acacia",
    price: 35,
    image:
      "https://images.unsplash.com/photo-1590794056226-79ef3a8147e1?auto=format&fit=crop&w=900&q=80",
    category: "Ustensiles",
  },
  {
    id: "u3",
    name: "Set spatules & pinces silicone",
    price: 22,
    image:
      "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=80",
    category: "Ustensiles",
  },
  {
    id: "u4",
    name: "Poêle inox professionnelle",
    price: 54,
    image:
      "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=900&q=80",
    category: "Ustensiles",
  },
];

function ProductCard({ product }: Readonly<{ product: Product }>) {
  const { addToCart } = useCart();
  const { t } = useI18n();

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:-translate-y-1 hover:shadow-xl dark:border-gray-800 dark:bg-neutral-900">
      <div className="relative h-56 w-full">
        <Image
          src={product.image}
          alt=""
          fill
          sizes="(max-width: 768px) 100vw, 300px"
          className="object-cover"
        />
      </div>

      <div className="p-4">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">
          {product.name}
        </h2>

        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {product.price.toFixed(2)} €
        </p>

        <button
          type="button"
          onClick={() => addToCart(product)}
          aria-label={t("shop.cart.increaseQty", { name: product.name })}
          className="mt-4 w-full rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
        >
          {t("shop.food.addToCart")}
        </button>
      </div>
    </article>
  );
}

export default function UstensilesPage() {
  const { t } = useI18n();

  return (
    <main
      id="main-content"
      className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8"
    >
      <Link
        href="/shop"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-orange-600 dark:text-gray-300 dark:hover:text-orange-300"
      >
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        {t("shop.food.back")}
      </Link>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-neutral-900 md:p-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          {t("shop.utensils.title")}
        </h1>

        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
          {t("shop.utensils.desc")}
        </p>
      </section>

      <section
        aria-labelledby="products-title"
        className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4"
      >
        <h2 id="products-title" className="sr-only">
          {t("shop.utensils.title")}
        </h2>

        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </section>
    </main>
  );
}