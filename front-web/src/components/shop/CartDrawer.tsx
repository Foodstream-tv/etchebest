"use client";

import Image from "next/image";
import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { useCart } from "@/components/shop/CartContext";

export default function CartDrawer() {
  const {
    items,
    isOpen,
    closeCart,
    addToCart,
    decreaseQuantity,
    removeFromCart,
    clearCart,
    totalPrice,
    totalItems,
  } = useCart();

  return (
    <>
      <div
        onClick={closeCart}
        className={`fixed inset-0 z-40 bg-black/40 transition ${
          isOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-white shadow-2xl transition-transform dark:border-gray-800 dark:bg-neutral-950 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-orange-100 p-2 dark:bg-orange-500/10">
              <ShoppingCart className="h-5 w-5 text-orange-600 dark:text-orange-300" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                Mon panier
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {totalItems} article{totalItems > 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <button
            onClick={closeCart}
            className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-neutral-800 dark:hover:text-white"
            type="button"
            aria-label="Fermer le panier"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <div className="rounded-full bg-gray-100 p-4 dark:bg-neutral-900">
                <ShoppingCart className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">
                Ton panier est vide
              </h3>
              <p className="mt-2 max-w-xs text-sm text-gray-500 dark:text-gray-400">
                Ajoute des produits depuis les catégories de la boutique FoodStream.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-2xl border border-gray-200 p-3 dark:border-gray-800"
                >
                  <div className="flex gap-3">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
                      <Image
                        src={item.image}
                        alt={item.name}
                        fill
                        className="object-cover"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium uppercase tracking-wide text-orange-600 dark:text-orange-300">
                        {item.category}
                      </p>
                      <h3 className="truncate text-sm font-bold text-gray-900 dark:text-white">
                        {item.name}
                      </h3>
                      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                        {item.price.toFixed(2)} €
                      </p>

                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => decreaseQuantity(item.id)}
                            className="rounded-full border border-gray-200 p-1.5 transition hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-neutral-800"
                            type="button"
                          >
                            <Minus className="h-4 w-4" />
                          </button>

                          <span className="min-w-[24px] text-center text-sm font-semibold">
                            {item.quantity}
                          </span>

                          <button
                            onClick={() =>
                              addToCart({
                                id: item.id,
                                name: item.name,
                                price: item.price,
                                image: item.image,
                                category: item.category,
                              })
                            }
                            className="rounded-full border border-gray-200 p-1.5 transition hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-neutral-800"
                            type="button"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>

                        <button
                          onClick={() => removeFromCart(item.id)}
                          className="rounded-full p-2 text-red-500 transition hover:bg-red-50 dark:hover:bg-red-500/10"
                          type="button"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-5 py-4 dark:border-gray-800">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-gray-500 dark:text-gray-400">Total</span>
            <span className="text-xl font-extrabold text-gray-900 dark:text-white">
              {totalPrice.toFixed(2)} €
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={clearCart}
              className="rounded-xl border border-gray-300 px-4 py-3 text-sm font-semibold transition hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-neutral-800"
              type="button"
            >
              Vider
            </button>

            <button
              className="rounded-xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600"
              type="button"
            >
              Commander
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}