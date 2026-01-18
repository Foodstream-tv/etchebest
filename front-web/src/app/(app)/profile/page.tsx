"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import {
  Mail,
  LogOut,
  Settings,
  Bell,
  ShieldCheck,
  Trophy,
  Link as LinkIcon,
} from "lucide-react";

function initialsOf(name?: string, email?: string) {
  return (name || email || "?")
    .split(" ")
    .map((s) => s[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

type ThemeChoice = "Clair" | "Sombre" | "Système";

export default function ProfilePage() {
  const { user, signOut, ready } = useAuth();

  const [theme, setTheme] = useState<ThemeChoice>("Sombre");
  const [lang, setLang] = useState<"FR" | "EN">("FR");
  const [notifLives, setNotifLives] = useState(true);
  const [notifReplays, setNotifReplays] = useState(false);
  const [notifChefs, setNotifChefs] = useState(true);

  const [googleConnected, setGoogleConnected] = useState(true);
  const [twitchConnected, setTwitchConnected] = useState(false);
  const [youtubeConnected, setYoutubeConnected] = useState(true);
  const [xConnected, setXConnected] = useState(false);

  const stats = useMemo(
    () => ({
      watchHours: 42,
      recipes: 18,
      streakDays: 7,
      chefsFollowed: 24,
      chefLevel: 68,
      weeklyGoal: 80,
    }),
    [],
  );

  if (!ready) {
    return (
      <main className="grid min-h-[60vh] place-items-center">
        <p className="text-sm text-gray-500 dark:text-gray-300">Chargement…</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="grid min-h-[60vh] place-items-center">
        <div className="text-center">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Session expirée.
          </p>
          <Link
            href="/signin"
            className="mt-3 inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Se reconnecter
          </Link>
        </div>
      </main>
    );
  }

  const displayName = user.username || "Mon profil";
  const locationLine = "@nicolas · Paris, FR";
  const statusLine = "“Toujours partant pour …”";
  const avatarAlt = displayName;

  return (
    <main className="pb-10">
      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-6 md:grid-cols-[360px_minmax(0,1fr)]">
        {/* LEFT COLUMN */}
        <aside className="space-y-6">
          {/* Profile card */}
          <Card>
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-14 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                {user.profileImageUrl ? (
                  <Image
                    src={user.profileImageUrl}
                    alt={avatarAlt}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-lg font-bold text-gray-700 dark:text-gray-200">
                    {initialsOf(user.username, user.email)}
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">
                  {displayName}
                </div>
                <div className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {locationLine}
                </div>
                <div className="truncate text-[11px] text-gray-400 dark:text-gray-500">
                  {statusLine}
                </div>
              </div>

              <button
                type="button"
                className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white hover:bg-orange-600"
                onClick={() => alert("Modifier le profil (à brancher).")}
              >
                Modifier
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-xs text-gray-700 dark:bg-white/5 dark:text-gray-200">
              <div className="flex min-w-0 items-center gap-2">
                <Mail className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
                <span className="truncate">{user.email}</span>
              </div>

              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-gray-700 shadow-sm ring-1 ring-black/5 hover:bg-gray-50 dark:bg-neutral-900 dark:text-gray-200 dark:ring-white/10 dark:hover:bg-neutral-800"
                onClick={() => {
                  signOut();
                  window.location.href = "/signin";
                }}
              >
                <LogOut className="h-4 w-4" />
                Déco
              </button>
            </div>
          </Card>

          {/* Badges */}
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-orange-500" />
              <h2 className="text-sm font-semibold">Médailles & Badges</h2>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <BadgeCard title="Chef" subtitle="Débutant" meta="5 lives suivis" />
              <BadgeCard
                title="Gourmet"
                subtitle="Curieux"
                meta="10 recettes sauvegardées"
              />
              <BadgeCard title="Roi du Chat" subtitle="" meta="100 messages envoyés" />
              <BadgeCard title="Matinal" subtitle="" meta="3 lives à 8h" />
              <BadgeCard title="Noctambule" subtitle="" meta="3 lives après minuit" />
              <BadgeCard title="Ambassadeur" subtitle="" meta="5 parrainages" />
            </div>
          </Card>

          {/* Connected accounts */}
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-orange-500" />
              <h2 className="text-sm font-semibold">Comptes connectés</h2>
            </div>

            <div className="space-y-2">
              <ConnectedRow
                label="Google"
                connected={googleConnected}
                onToggle={() => setGoogleConnected((v) => !v)}
              />
              <ConnectedRow
                label="Twitch"
                connected={twitchConnected}
                onToggle={() => setTwitchConnected((v) => !v)}
              />
              <ConnectedRow
                label="YouTube"
                connected={youtubeConnected}
                onToggle={() => setYoutubeConnected((v) => !v)}
              />
              <ConnectedRow
                label="Twitter/X"
                connected={xConnected}
                onToggle={() => setXConnected((v) => !v)}
              />
            </div>
          </Card>
        </aside>

        {/* RIGHT COLUMN */}
        <section className="space-y-6">
          {/* Preferences */}
          <Card>
            <div className="mb-3 flex items-center gap-2">
              <Settings className="h-4 w-4 text-orange-500" />
              <h2 className="text-sm font-semibold">Préférences</h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <div className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                  Thème
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["Clair", "Sombre", "Système"] as ThemeChoice[]).map((t) => (
                    <Pill key={t} active={theme === t} onClick={() => setTheme(t)}>
                      {t}
                    </Pill>
                  ))}
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Switch pour essayer le mode sombre
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                  <Bell className="h-4 w-4" />
                  Notifications
                </div>
                <div className="flex flex-wrap gap-2">
                  <Pill active={notifLives} onClick={() => setNotifLives((v) => !v)}>
                    Lives
                  </Pill>
                  <Pill
                    active={notifReplays}
                    onClick={() => setNotifReplays((v) => !v)}
                  >
                    Replays
                  </Pill>
                  <Pill
                    active={notifChefs}
                    onClick={() => setNotifChefs((v) => !v)}
                  >
                    Nouveaux chefs
                  </Pill>
                </div>
              </div>

              <div>
                <div className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                  Langue
                </div>
                <div className="flex gap-2">
                  <Pill active={lang === "FR"} onClick={() => setLang("FR")}>
                    FR
                  </Pill>
                  <Pill active={lang === "EN"} onClick={() => setLang("EN")}>
                    EN
                  </Pill>
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                  <ShieldCheck className="h-4 w-4" />
                  Confidentialité
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Profil visible, listes publiques, etc.
                </p>
              </div>
            </div>
          </Card>

          {/* Statistics */}
          <Card>
            <div className="mb-3 text-sm font-semibold">Statistiques</div>

            <div className="grid gap-3 sm:grid-cols-4">
              <StatCard value={`${stats.watchHours} h`} label="Temps de visionnage" />
              <StatCard value={`${stats.recipes}`} label="Recettes cuisinées" />
              <StatCard value={`${stats.streakDays} jours`} label="Streak" />
              <StatCard value={`${stats.chefsFollowed}`} label="Chefs suivis" />
            </div>

            <div className="mt-4 space-y-3">
              <ProgressRow
                label="Niveau de Chef"
                value={`${stats.chefLevel}%`}
                percent={stats.chefLevel}
              />
              <ProgressRow
                label="Objectif hebdo (5h)"
                value={`${stats.weeklyGoal}%`}
                percent={stats.weeklyGoal}
              />
            </div>
          </Card>

          {/* Recent activity */}
          <Card>
            <div className="mb-3 text-sm font-semibold">Activité récente</div>
            <div className="space-y-3">
              <ActivityRow text='A rejoint "Ramen Tonkotsu Ultimes"' />
              <ActivityRow text='A sauvegardé "Bao buns ultra moelleux"' />
              <ActivityRow text='A suivi le chef "Camille Dupont"' />
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5 dark:bg-neutral-900 dark:ring-white/10">
      {children}
    </div>
  );
}

function Pill({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-full px-3 py-1.5 text-xs font-semibold transition",
        active
          ? "bg-orange-500 text-white"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}

function BadgeCard({
  title,
  subtitle,
  meta,
}: {
  title: string;
  subtitle?: string;
  meta: string;
}) {
  return (
    <div className="rounded-xl bg-gray-50 p-3 text-center ring-1 ring-black/5 dark:bg-neutral-950/40 dark:ring-white/10">
      <div className="text-xs font-semibold text-gray-800 dark:text-gray-200">
        {title}
      </div>
      {subtitle ? (
        <div className="text-[11px] text-gray-500 dark:text-gray-400">
          {subtitle}
        </div>
      ) : (
        <div className="h-4" />
      )}
      <div className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
        {meta}
      </div>
    </div>
  );
}

function ConnectedRow({
  label,
  connected,
  onToggle,
}: {
  label: string;
  connected: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm ring-1 ring-black/5 dark:bg-neutral-950/40 dark:ring-white/10">
      <span className="text-gray-800 dark:text-gray-200">{label}</span>
      <button
        type="button"
        onClick={onToggle}
        className={cx(
          "rounded-lg px-3 py-1.5 text-xs font-semibold transition",
          connected
            ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30"
            : "bg-orange-50 text-orange-700 ring-1 ring-orange-200 hover:bg-orange-100 dark:bg-orange-500/10 dark:text-orange-200 dark:ring-orange-500/30 dark:hover:bg-orange-500/15",
        )}
      >
        {connected ? "Connecté" : "Lier"}
      </button>
    </div>
  );
}

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-gray-50 p-3 text-center ring-1 ring-black/5 dark:bg-neutral-950/40 dark:ring-white/10">
      <div className="text-sm font-bold text-gray-900 dark:text-white">
        {value}
      </div>
      <div className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
        {label}
      </div>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  percent,
}: {
  label: string;
  value: string;
  percent: number;
}) {
  const safe = Math.max(0, Math.min(100, percent));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-[11px] text-gray-600 dark:text-gray-300">
        <span className="font-semibold text-gray-800 dark:text-gray-200">
          {label}
        </span>
        <span>{value}</span>
      </div>
      <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-white/10">
        <div
          className="h-2 rounded-full bg-orange-500"
          style={{ width: `${safe}%` }}
        />
      </div>
    </div>
  );
}

function ActivityRow({ text }: { text: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700 ring-1 ring-black/5 dark:bg-neutral-950/40 dark:text-gray-200 dark:ring-white/10">
      {text}
    </div>
  );
}
