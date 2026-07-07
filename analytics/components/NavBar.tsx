"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/statistics", label: "Statistics" },
];

export default function NavBar({ onRefresh }: { onRefresh?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  function logout() {
    localStorage.removeItem("token");
    router.push("/login");
  }

  return (
    <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-8">
        <div>
          <h1 className="font-bold text-lg leading-tight">Foodstream Analytics</h1>
          <p className="text-gray-500 text-xs">Admin dashboard</p>
        </div>

        <nav className="flex items-center gap-1">
          {LINKS.map((l) => {
            const active = pathname === l.href;
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                  active
                    ? "bg-indigo-600/15 text-indigo-300"
                    : "text-gray-400 hover:text-white hover:bg-gray-800"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition"
          >
            Refresh
          </button>
        )}
        <button
          onClick={logout}
          className="text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 px-3 py-1.5 rounded-lg transition"
        >
          Sign out
        </button>
      </div>
    </header>
  );
}
