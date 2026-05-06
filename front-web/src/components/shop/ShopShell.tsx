"use client";

import { ReactNode } from "react";
import { CartProvider } from "@/components/shop/CartContext";
import CartButton from "@/components/shop/CartButton";
import CartDrawer from "@/components/shop/CartDrawer";

export default function ShopShell({ children }: { children: ReactNode }) {
  return (
    <CartProvider>
      {children}
      <CartButton />
      <CartDrawer />
    </CartProvider>
  );
}