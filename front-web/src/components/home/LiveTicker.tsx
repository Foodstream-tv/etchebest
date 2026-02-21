"use client";

import { useMemo } from "react";
import { Radio, Eye } from "lucide-react";
import Link from "next/link";

type Live = {
  id: string;
  title: string;
  host: string;
  viewers: number;
  href?: string;
};

export default function LiveTicker() {
  // Démo de données – remplace par ton fetch si besoin
  const lives: Live[] = useMemo(
    () => [
      { id: "l1", title: "Ramen Tonkotsu maison", host: "AkiraKitchen", viewers: 1280, href: "/live/l1" },
      { id: "l2", title: "Poulet Yassa express", host: "MamaDi", viewers: 930, href: "/live/l2" },
      { id: "l3", title: "Tacos al pastor", host: "ChefCarlos", viewers: 1540, href: "/live/l3" },
      { id: "l4", title: "Crème brûlée parfaite", host: "LuciePâtiss", viewers: 780, href: "/live/l4" },
      { id: "l5", title: "Bibimbap coloré", host: "HanSeoul", viewers: 1120, href: "/live/l5" },
    ],
    []
  );

  // On duplique la piste pour une boucle fluide
  const track = [...lives, ...lives];

  return (
    <div className="live-ticker border-b bg-white/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-2">
        <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-red-600" />
          En direct
        </span>

        <div className="relative flex-1 overflow-hidden">
          <div className="live-track flex items-center gap-6">
            {track.map((it, i) => (
              <Link
                key={`${it.id}-${i}`}
                href={it.href ?? "#"}
                className="group inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-white/70 px-3 py-1.5 text-sm text-gray-700 ring-1 ring-black/5 hover:bg-white"
              >
                <Radio className="h-4 w-4 text-red-600" />
                <span className="font-medium">{it.title}</span>
                <span className="text-gray-400">•</span>
                <span className="text-gray-500">{it.host}</span>
                <span className="inline-flex items-center gap-1 text-gray-500">
                  <Eye className="h-4 w-4" /> {Intl.NumberFormat("fr-FR").format(it.viewers)}
                </span>
              </Link>
            ))}
          </div>
        </div>

        <Link
          href="/lives"
          className="hidden rounded-full border px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 md:inline-block"
        >
          Voir tous les lives
        </Link>
      </div>
    </div>
  );
}
