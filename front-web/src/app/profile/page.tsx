"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/useAuth";
import { Camera, Mail, User as UserIcon, LogOut } from "lucide-react";

function initialsOf(name?: string, email?: string) {
  return (name || email || "?")
    .split(" ")
    .map((s) => s[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

export default function ProfilePage() {
  const { user, setUser, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.replace("/signin");
  }, [ready, user, router]);

  if (!ready) {
    return (
      <main className="grid min-h-[60vh] place-items-center bg-neutral-50 text-gray-900 dark:bg-neutral-950 dark:text-gray-50">
        <p className="text-sm text-gray-500 dark:text-gray-300">Chargement…</p>
      </main>
    );
  }

  if (!user) return null;

  const signOut = () => {
    setUser(null);
    router.replace("/signin");
  };

  return (
    <main className="bg-neutral-50 text-gray-900 dark:bg-neutral-950 dark:text-gray-50">
      <header className="bg-gradient-to-r from-amber-50 to-rose-50 dark:from-neutral-900 dark:to-neutral-900">
        <div className="mx-auto max-w-5xl px-6 py-10">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <div className="relative">
              {user.avatar ? (
                <Image
                  src={user.avatar}
                  alt={user.name}
                  width={96}
                  height={96}
                  className="rounded-full ring-2 ring-white"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-amber-500 text-2xl font-bold text-white ring-2 ring-white">
                  {initialsOf(user.name, user.email)}
                </div>
              )}
              <button
                className="absolute -bottom-1 -right-1 rounded-full bg-white p-2 shadow ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10"
                title="Changer la photo"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1">
              <h1 className="text-2xl font-bold">{user.name || "Mon profil"}</h1>
              <p className="mt-1 flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <Mail className="h-4 w-4" /> {user.email}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
                  Streamer
                </span>
                <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700 dark:bg-sky-900/40 dark:text-sky-200">
                  Membre depuis 2024
                </span>
              </div>
            </div>

            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-white/15 dark:text-gray-100 dark:hover:bg-neutral-800"
            >
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-6 px-6 py-8 md:grid-cols-3">
        <aside className="space-y-2">
          <ProfileLink href="/profile" active>
            <UserIcon className="h-4 w-4" />
            Aperçu
          </ProfileLink>
          <ProfileLink href="/favorites">❤️ Favoris</ProfileLink>
          <ProfileLink href="/lives?mine=1">🎥 Mes lives</ProfileLink>
          <ProfileLink href="/settings">⚙️ Paramètres</ProfileLink>
        </aside>

        <section className="md:col-span-2">
          <div className="rounded-xl bg-white p-6 shadow-sm ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
            <h2 className="text-lg font-semibold">Informations personnelles</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Modifie ton nom et ton e-mail (démo frontend).
            </p>

            <form
              className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const name = String(fd.get("name") || user.name);
                const email = String(fd.get("email") || user.email);
                const updated = { ...user, name, email };
                setUser(updated);
                alert("Profil mis à jour (demo front).");
              }}
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Nom
                </label>
                <input
                  name="name"
                  defaultValue={user.name || ""}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 dark:border-white/15 dark:bg-neutral-900 dark:text-gray-100 dark:focus:border-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
                  defaultValue={user.email}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-900 dark:border-white/15 dark:bg-neutral-900 dark:text-gray-100 dark:focus:border-white"
                />
              </div>
              <div className="sm:col-span-2">
                <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200">
                  Enregistrer
                </button>
              </div>
            </form>
          </div>

          <div className="mt-6 rounded-xl bg-white p-6 shadow-sm ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
            <h2 className="text-lg font-semibold">Activité récente</h2>
            <ul className="mt-3 space-y-2 text-sm text-gray-600 dark:text-gray-300">
              <li>• A suivi “Ramen Tonkotsu maison”</li>
              <li>• A ajouté “Curry asiatique” en favori</li>
              <li>• A commenté un live de “ChefCarlos”</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}

function ProfileLink({
  href,
  children,
  active,
}: {
  href: string;
  children: React.ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
        active
          ? "bg-gray-900 text-white dark:bg-white dark:text-neutral-900"
          : "text-gray-800 hover:bg-gray-100 dark:text-gray-100 dark:hover:bg-neutral-800"
      }`}
    >
      {children}
    </Link>
  );
}
