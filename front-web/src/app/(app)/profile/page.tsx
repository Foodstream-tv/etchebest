"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { apiFetch } from "@/lib/api";

type MeProfile = {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  profileImageUrl: string;
  description: string;
  followerCount: number;
  isVerified: boolean;
  isFeaturedChef: boolean;
  followingIds: string[];
  followersIds: string[];
};
import {
  Mail,
  LogOut,
  Settings,
  Bell,
  ShieldCheck,
  Trophy,
  Link as LinkIcon,
  Star,
  Activity,
} from "lucide-react";
import HomeFooter from "@/components/home/HomeFooter";

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
type ProfileTab = "Préférences" | "Statistiques" | "Activité" | "Médailles & Badges" | "Favoris";

export default function ProfilePage() {
  const { user, token, signOut, ready } = useAuth();

  const [tab, setTab] = useState<ProfileTab>("Préférences");
  const [profile, setProfile] = useState<MeProfile | null>(null);

  useEffect(() => {
    if (!token) return;
    apiFetch<MeProfile>("/users/me", { token }).then(setProfile).catch(() => {});
  }, [token]);

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

  const displayName =
    profile
      ? [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.username
      : user.username || "Mon profil";
  const locationLine = profile?.username ? `@${profile.username}` : null;
  const statusLine = profile?.description || null;

  return (
    <main className="flex min-h-[calc(100vh-64px)] flex-col">
      {/* CONTENU */}
      <div className="flex-1">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 py-8 md:grid-cols-[360px_minmax(0,1fr)]">
          {/* LEFT */}
          <aside className="space-y-6">
            <Card>
              <div className="flex items-center gap-3">
                <div className="relative h-14 w-14 overflow-hidden rounded-full bg-gray-200 dark:bg-white/10">
                  {(profile?.profileImageUrl || user.profileImageUrl) ? (
                    <Image
                      src={(profile?.profileImageUrl || user.profileImageUrl)!}
                      alt={displayName}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-lg font-bold">
                      {initialsOf(profile?.username || user.username, user.email)}
                    </div>
                  )}
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold">{displayName}</div>
                    {profile?.isVerified && (
                      <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">
                        Vérifié
                      </span>
                    )}
                    {profile?.isFeaturedChef && (
                      <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600 dark:bg-orange-500/20 dark:text-orange-300">
                        Chef
                      </span>
                    )}
                  </div>
                  {locationLine && (
                    <div className="text-xs text-gray-500">{locationLine}</div>
                  )}
                  {statusLine && (
                    <div className="text-[11px] text-gray-400">{statusLine}</div>
                  )}
                  {profile && (
                    <div className="mt-1 flex gap-3 text-[11px] text-gray-500">
                      <span><strong className="text-gray-800 dark:text-gray-200">{profile.followerCount}</strong> abonnés</span>
                      <span><strong className="text-gray-800 dark:text-gray-200">{profile.followingIds?.length ?? 0}</strong> abonnements</span>
                    </div>
                  )}
                </div>

                <button className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-semibold text-white">
                  Modifier
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between bg-gray-50 px-3 py-2 text-xs dark:bg-white/5">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {user.email}
                </div>

                <button
                  onClick={() => {
                    signOut();
                    window.location.href = "/signin";
                  }}
                  className="flex items-center gap-2"
                >
                  <LogOut className="h-4 w-4" /> Déco
                </button>
              </div>
            </Card>

            <Card>
              <h2 className="mb-3 text-sm font-semibold">Comptes connectés</h2>

              <ConnectedRow label="Google" connected={googleConnected} onToggle={() => setGoogleConnected(!googleConnected)} />
              <ConnectedRow label="Twitch" connected={twitchConnected} onToggle={() => setTwitchConnected(!twitchConnected)} />
              <ConnectedRow label="YouTube" connected={youtubeConnected} onToggle={() => setYoutubeConnected(!youtubeConnected)} />
              <ConnectedRow label="Twitter/X" connected={xConnected} onToggle={() => setXConnected(!xConnected)} />
            </Card>
          </aside>

          {/* RIGHT */}
          <section className="space-y-6">
            <Card>
              <div className="flex flex-wrap gap-2">
                {(["Préférences","Statistiques","Activité","Médailles & Badges","Favoris"] as ProfileTab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`rounded-xl px-3 py-2 text-sm ${
                      tab === t ? "bg-orange-500 text-white" : "bg-gray-100 dark:bg-white/5"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </Card>

            {/* CONTENT */}
          {tab === "Médailles & Badges" && (
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Trophy className="h-4 w-4 text-orange-500" />
                <h2 className="text-sm font-semibold">Médailles & Badges</h2>
              </div>

              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
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
                <BadgeCard title="Explorateur" subtitle="" meta="10 lives différents" />
                <BadgeCard title="Fidèle" subtitle="" meta="7 jours de suite" />
              </div>
            </Card>
          )}

          {tab === "Favoris" && (
            <Card>
              <div className="mb-3 flex items-center gap-2">
                <Star className="h-4 w-4 text-orange-500" />
                <h2 className="text-sm font-semibold">Favoris</h2>
              </div>

              <div className="space-y-3">
                <FavoriteRow title="Bao buns moelleux" meta="Recette · Sauvegardé" />
                <FavoriteRow title="Ramen Tonkotsu" meta="Live · Suivi" />
                <FavoriteRow title="Chef Camille Dupont" meta="Chef · Abonné" />
              </div>
            </Card>
          )}

          {tab === "Préférences" && (
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
          )}

          {tab === "Statistiques" && (
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
          )}

          {tab === "Activité" && (
            <Card>
              <div className="mb-3 text-sm font-semibold">Activité récente</div>
              <div className="space-y-3">
                <ActivityRow text='A rejoint "Ramen Tonkotsu"' />
                <ActivityRow text='A sauvegardé "Bao buns moelleux"' />
                <ActivityRow text='A suivi le chef "Camille Dupont"' />
              </div>
            </Card>
          )}
          </section>
        </div>
      </div>

      {/* ESPACE + FOOTER */}
      <div className="h-12 md:h-16" />
      <HomeFooter />
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

function TabPill({
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
        "inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold transition",
        active
          ? "bg-gray-900 text-white dark:bg-white dark:text-neutral-900"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10",
      )}
    >
      {children}
    </button>
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

function FavoriteRow({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-gray-50 px-3 py-2 text-sm ring-1 ring-black/5 dark:bg-neutral-950/40 dark:ring-white/10">
      <div className="min-w-0">
        <div className="truncate font-semibold text-gray-800 dark:text-gray-200">
          {title}
        </div>
        <div className="truncate text-[11px] text-gray-500 dark:text-gray-400">
          {meta}
        </div>
      </div>
      <span className="text-xs font-semibold text-gray-400 dark:text-gray-500">
        Voir →
      </span>
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
