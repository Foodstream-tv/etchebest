"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCart } from "@/components/shop/CartContext";

type Product = {
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
};

const products: Product[] = [
  {
    id: "n1",
    name: "Kit sushi maison",
    price: 19,
    image:
      "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=900&q=80",
    category: "Nourriture",
  },
  {
    id: "n2",
    name: "Épices BBQ premium",
    price: 15,
    image:
      "https://images.unsplash.com/photo-1509440159596-0249088772ff?auto=format&fit=crop&w=900&q=80",
    category: "Nourriture",
  },
  {
    id: "n3",
    name: "Pack ramen japonais",
    price: 12,
    image:
      "https://images.unsplash.com/photo-1617093727343-374698b1b08d?auto=format&fit=crop&w=900&q=80",
    category: "Nourriture",
  },
  {
    id: "n4",
    name: "Box ingrédients découverte",
    price: 27,
    image:
      "https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=900&q=80",
    category: "Nourriture",
  },
];

function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useCart();

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white transition hover:-translate-y-1 hover:shadow-xl dark:border-gray-800 dark:bg-neutral-900">
      <div className="relative h-56 w-full">
        <Image src={product.image} alt={product.name} fill className="object-cover" />
      </div>

      <div className="p-4">
        <h3 className="text-base font-bold text-gray-900 dark:text-white">
          {product.name}
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {product.price.toFixed(2)} €
        </p>

        <button
          onClick={() => addToCart(product)}
          className="mt-4 w-full rounded-xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-600"
          type="button"
        >
          Ajouter au panier
        </button>
      </div>
    </div>
  );
}

export default function NourriturePage() {
  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8">
      <Link
        href="/shop"
        className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-orange-600 dark:text-gray-300 dark:hover:text-orange-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour à la boutique
      </Link>

      <section className="rounded-3xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-neutral-900 md:p-8">
        <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white">
          Nourriture & ingrédients
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
          Des kits, ingrédients et produits faciles à présenter ou utiliser
          pendant les lives culinaires.
        </p>
      </section>

      <section className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </section>
    </main>
  );
}