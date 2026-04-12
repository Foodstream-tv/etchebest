import { ReactNode } from "react";
import ShopShell from "@/components/shop/ShopShell";

export default function ShopLayout({ children }: { children: ReactNode }) {
  return <ShopShell>{children}</ShopShell>;
}