import Link from "next/link";
import { Home, ShoppingCart, Heart, User, Utensils } from "lucide-react";

type Tab = "dishes" | "favorites" | "home" | "shop" | "profile";

export default function TabBar({ active }: { active: Tab }) {
  const base =
    "flex flex-col items-center justify-center gap-1 text-[11px] leading-none";
  const icon = "h-5 w-5";

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 mx-auto max-w-md border-t bg-white/95 px-1 py-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)] backdrop-blur">
      <ul className="grid grid-cols-5">
        <li className="text-gray-600">
          <Link href="/dishes" className={`${base} ${active === "dishes" ? "text-amber-600" : ""}`}>
            <Utensils className={icon} />
            <span>Plats</span>
          </Link>
        </li>
        <li>
          <Link
            href="/favorites"
            className={`${base} ${active === "favorites" ? "text-amber-600" : "text-gray-600"}`}
          >
            <Heart className={icon} />
            <span>Favoris</span>
          </Link>
        </li>
        <li>
          <Link
            href="/home"
            className={`${base} ${
              active === "home"
                ? "text-white"
                : "text-gray-600"
            } relative`}
          >
            {/* pastille active */}
            <span className="absolute -top-4 flex h-11 w-11 items-center justify-center rounded-full bg-amber-500 shadow-md">
              <Home className="h-5 w-5" />
            </span>
            <span className="mt-7">Home</span>
          </Link>
        </li>
        <li>
          <Link
            href="/shop"
            className={`${base} ${active === "shop" ? "text-amber-600" : "text-gray-600"}`}
          >
            <ShoppingCart className={icon} />
            <span>Boutique</span>
          </Link>
        </li>
        <li>
          <Link
            href="/profile"
            className={`${base} ${active === "profile" ? "text-amber-600" : "text-gray-600"}`}
          >
            <User className={icon} />
            <span>Profil</span>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
