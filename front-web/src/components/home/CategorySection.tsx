import Image from "next/image";

type Card = { id: string; src: string; title: string; href?: string };

export default function CategorySection({ title, items }: { title: string; items: Card[] }) {
  return (
    <div>
      <div className="mb-3 flex items-end justify-between">
        <h3 className="text-2xl font-semibold text-gray-900">{title}</h3>
        <a href="#" className="text-sm font-medium text-amber-700 hover:text-amber-800">
          Voir tout →
        </a>
      </div>

      {/* Grille adaptée desktop */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((it) => (
          <a
            key={it.id}
            href={it.href ?? "#"}
            className="group overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5 transition hover:shadow-md"
          >
            {/* Conteneur d'image amélioré */}
            <div className="relative flex h-52 w-full items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
              <Image
                src={it.src}
                alt={it.title}
                fill
                className="object-contain p-6 transition-transform duration-300 group-hover:scale-105"
              />
            </div>

            {/* Titre */}
            <div className="flex items-center justify-between px-4 py-3">
              <h4 className="line-clamp-1 text-sm font-semibold text-gray-900">{it.title}</h4>
              <span className="text-xs text-gray-500">Live</span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
