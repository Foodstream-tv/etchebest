"use client";

import { ShoppingCart } from "lucide-react";

import { useCart } from "@/components/shop/CartContext";
import { useI18n } from "@/i18n/LanguageContext";

export default function CartButton() {
  const { totalItems, openCart } = useCart();
  const { t } = useI18n();

  return (
    <button
      type="button"
      onClick={openCart}
      aria-label={
        totalItems > 0
          ? t("shop.cart.openWithCountAria", {
              count: totalItems,
              plural: totalItems > 1 ? "s" : "",
            })
          : t("shop.cart.openAria")
      }
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-orange-500 text-white shadow-xl transition hover:scale-105 hover:bg-orange-600"
    >
      <ShoppingCart className="h-6 w-6" aria-hidden="true" />

      {totalItems > 0 ? (
        <span
          aria-hidden="true"
          className="absolute -right-1 -top-1 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-white px-1 text-xs font-bold text-orange-600 shadow"
        >
          {totalItems}
        </span>
      ) : null}
    </button>
  );
}