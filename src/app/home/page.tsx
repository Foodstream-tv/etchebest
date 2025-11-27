"use client";

import Header from "@/components/home/Header";
import HeroCarousel from "@/components/home/HeroCarousel";
import CategorySection from "@/components/home/CategorySection";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-gray-900 dark:bg-neutral-950 dark:text-gray-50">
      <Header />

      {/* POPULAIRE */}
      <section className="mx-auto max-w-7xl px-6 pt-8">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-gray-50">
          Populaire
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Les lives et recettes plébiscités par la communauté
        </p>

        <div className="mt-5">
          <HeroCarousel
            items={[
              { id: "1", src: "/images/pop1.jpg", alt: "Chef en cuisine" },
              { id: "2", src: "/images/pop2.jpg", alt: "Plat gourmet" },
              { id: "3", src: "/images/pop3.jpg", alt: "Préparation" },
            ]}
          />
        </div>
      </section>

      {/* SECTIONS */}
      <section className="mx-auto max-w-7xl px-6 pb-14 pt-10">
        <CategorySection
          title="Asiatique"
          items={[
            { id: "a1", src: "/images/curry.png", title: "Curry" },
            { id: "a2", src: "/images/nouille.png", title: "Nouilles sautées" },
            { id: "a3", src: "/images/sushi.png", title: "Sushis mix" },
            { id: "a4", src: "/images/baozi.png", title: "Bao vapeur" },
          ]}
        />

        <div className="mt-10">
          <CategorySection
            title="Africain"
            items={[
              { id: "af1", src: "/images/africa1.jpg", title: "Riz sauce" },
              { id: "af2", src: "/images/africa2.jpg", title: "Ragoût" },
              { id: "af3", src: "/images/africa3.jpg", title: "Yassa poulet" },
              { id: "af4", src: "/images/africa4.jpg", title: "Tajine" },
            ]}
          />
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t bg-white text-gray-600 dark:border-white/10 dark:bg-neutral-900 dark:text-gray-400">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 text-sm">
          <span>© {new Date().getFullYear()} FoodStream</span>
          <nav className="flex gap-5">
            <a
              href="#"
              className="hover:text-gray-900 dark:hover:text-gray-100"
            >
              À propos
            </a>
            <a
              href="#"
              className="hover:text-gray-900 dark:hover:text-gray-100"
            >
              Contact
            </a>
            <a
              href="#"
              className="hover:text-gray-900 dark:hover:text-gray-100"
            >
              CGU
            </a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
