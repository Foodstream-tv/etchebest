import Image from "next/image";

type Card = { id: string; src: string; alt?: string; href?: string };

export default function CategoryRow({ title, items }: { title: string; items: Card[] }) {
  return (
    <section className="px-4 pt-4">
      <h3 className="mb-2 text-xl font-semibold text-gray-900">{title}</h3>

      <div className="grid grid-cols-2 gap-3">
        {items.map((it) => (
          <a
            key={it.id}
            href={it.href ?? "#"}
            className="block overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5"
          >
            <div className="relative h-28 w-full">
              <Image src={it.src} alt={it.alt ?? ""} fill className="object-cover" />
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
