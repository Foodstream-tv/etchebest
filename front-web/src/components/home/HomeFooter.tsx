export default function HomeFooter() {
  return (
    <footer className="relative left-1/2 right-1/2 mt-10 w-screen -translate-x-1/2 border-t border-neutral-200 bg-white dark:border-white/10 dark:bg-neutral-950">
      <div className="mx-auto w-full max-w-7xl px-4 py-10">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              Foodstream
            </h3>
            <p className="mt-2 max-w-md text-sm text-gray-600 dark:text-white/50">
              La plateforme pour partager, regarder et créer des lives cuisine.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 text-sm md:grid-cols-3">
            <div>
              <p className="mb-2 font-semibold text-gray-900 dark:text-white">
                Produit
              </p>
              <div className="space-y-2 text-gray-600 dark:text-white/50">
                <p>Découvrir</p>
                <p>Studio</p>
                <p>Favoris</p>
              </div>
            </div>

            <div>
              <p className="mb-2 font-semibold text-gray-900 dark:text-white">
                Ressources
              </p>
              <div className="space-y-2 text-gray-600 dark:text-white/50">
                <p>Aide</p>
                <p>Communauté</p>
                <p>Support</p>
              </div>
            </div>

            <div>
              <p className="mb-2 font-semibold text-gray-900 dark:text-white">
                Légal
              </p>
              <div className="space-y-2 text-gray-600 dark:text-white/50">
                <p>Confidentialité</p>
                <p>Conditions</p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-neutral-200 pt-4 text-xs text-gray-500 dark:border-white/10 dark:text-white/40">
          © 2026 Foodstream. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}