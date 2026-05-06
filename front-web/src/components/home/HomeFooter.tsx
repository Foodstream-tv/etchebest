export default function HomeFooter() {
  return (
    <footer className="mt-20 border-t border-black/8 bg-transparent dark:border-white/10">
      <div className="mx-auto w-full max-w-7xl px-6 py-10">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-gray-50">
              Foodstream
            </h3>
            <p className="mt-3 max-w-md text-sm leading-7 text-gray-600 dark:text-gray-400">
              La plateforme pour partager, regarder et créer des lives cuisine.
            </p>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
              Produit
            </p>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>Découvrir</p>
              <p>Studio</p>
              <p>Favoris</p>
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
              Ressources
            </p>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>Aide</p>
              <p>Communauté</p>
              <p>Support</p>
            </div>
          </div>

          <div>
            <p className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-100">
              Légal
            </p>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <p>Confidentialité</p>
              <p>Conditions</p>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-black/8 pt-5 text-xs text-gray-500 dark:border-white/10 dark:text-gray-500">
          © 2026 Foodstream. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}