"use client";

export default function HomeFooter() {
  return (
    <footer className="mt-6 border-t bg-white text-gray-600 dark:border-white/10 dark:bg-neutral-900 dark:text-gray-400">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-6 text-sm">
        <span>© {new Date().getFullYear()} Foodstream — Fait avec ♥</span>
        <nav className="flex gap-5">
          <a href="#" className="hover:text-gray-900 dark:hover:text-gray-100">
            À propos
          </a>
          <a href="#" className="hover:text-gray-900 dark:hover:text-gray-100">
            CGU
          </a>
          <a href="#" className="hover:text-gray-900 dark:hover:text-gray-100">
            Confidentialité
          </a>
          <a href="#" className="hover:text-gray-900 dark:hover:text-gray-100">
            Support
          </a>
        </nav>
      </div>
    </footer>
  );
}
