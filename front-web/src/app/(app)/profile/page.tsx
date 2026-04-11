"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Mail,
  LogOut,
  Settings,
  Bell,
  ShieldCheck,
  Trophy,
  Star,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { apiFetch } from "@/lib/api";
import HomeFooter from "@/components/home/HomeFooter";
import ProfileCard from "@/components/profile/ProfileCard";
import ProfilePill from "@/components/profile/ProfilePill";
import ProfileTabButton from "@/components/profile/ProfileTabButton";
import ProfileBadgeCard from "@/components/profile/ProfileBadgeCard";
import ProfileFavoriteRow from "@/components/profile/ProfileFavoriteRow";
import ProfileConnectedRow from "@/components/profile/ProfileConnectedRow";
import ProfileStatMiniCard from "@/components/profile/ProfileStatMiniCard";
import ProfileProgressRow from "@/components/profile/ProfileProgressRow";
import ProfileActivityRow from "@/components/profile/ProfileActivityRow";
import { initialsOf } from "@/components/profile/profileUtils";
import { useTheme } from "@/components/theme/ThemeProvider";

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

type ThemeChoice = "Clair" | "Sombre" | "Système";
type ProfileTab =
  | "Préférences"
  | "Statistiques"
  | "Activité"
  | "Médailles & Badges"
  | "Favoris";

export default function ProfilePage() {
  const { user, token, signOut, ready } = useAuth();

  const [tab, setTab] = useState<ProfileTab>("Préférences");
  const [profile, setProfile] = useState<MeProfile | null>(null);

  const { theme, setTheme } = useTheme();
  const themeChoice: ThemeChoice = theme === "dark" ? "Sombre" : "Clair";
  const [lang, setLang] = useState<"FR" | "EN">("FR");
  const [notifLives, setNotifLives] = useState(true);
  const [notifReplays, setNotifReplays] = useState(false);
  const [notifChefs, setNotifChefs] = useState(true);

  const [googleConnected, setGoogleConnected] = useState(true);
  const [twitchConnected, setTwitchConnected] = useState(false);
  const [youtubeConnected, setYoutubeConnected] = useState(true);
  const [xConnected, setXConnected] = useState(false);

  useEffect(() => {
    if (!token) return;
    apiFetch<MeProfile>("/users/me", { token }).then(setProfile).catch(() => {});
  }, [token]);

  const stats = useMemo(
    () => ({
      watchHours: 42,
      recipes: 18,
      streakDays: 7,
      chefsFollowed: 24,
      chefLevel: 68,
      weeklyGoal: 80,
    }),
    []
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
            className="mt-3 inline-block rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Se reconnecter
          </Link>
        </div>
      </main>
    );
  }

  const displayName =
    profile
      ? [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
        profile.username
      : user.username || "Mon profil";

  const handleSignOut = () => {
    signOut();
    window.location.href = "/signin";
  };

  return (
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid gap-8 md:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <ProfileCard>
              <div className="flex items-center gap-3">
                <div className="relative h-16 w-16 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                  {profile?.profileImageUrl || user.profileImageUrl ? (
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

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="truncate text-sm font-semibold text-gray-900 dark:text-gray-50">
                      {displayName}
                    </div>

                    {profile?.isVerified && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-600 dark:bg-blue-500/20 dark:text-blue-300">
                        Vérifié
                      </span>
                    )}

                    {profile?.isFeaturedChef && (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold text-orange-600 dark:bg-orange-500/20 dark:text-orange-300">
                        Chef
                      </span>
                    )}
                  </div>

                  {profile?.username ? (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      @{profile.username}
                    </div>
                  ) : null}

                  {profile?.description ? (
                    <div className="mt-1 line-clamp-2 text-[11px] text-gray-400 dark:text-gray-500">
                      {profile.description}
                    </div>
                  ) : null}

                  {profile ? (
                    <div className="mt-2 flex gap-3 text-[11px] text-gray-500 dark:text-gray-400">
                      <span>
                        <strong className="text-gray-800 dark:text-gray-200">
                          {profile.followerCount}
                        </strong>{" "}
                        abonnés
                      </span>
                      <span>
                        <strong className="text-gray-800 dark:text-gray-200">
                          {profile.followingIds?.length ?? 0}
                        </strong>{" "}
                        abonnements
                      </span>
                    </div>
                  ) : null}
                </div>

                <button className="rounded-xl bg-orange-500 px-3 py-2 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(249,115,22,0.28)] transition hover:bg-orange-400">
                  Modifier
                </button>
              </div>

              <div className="mt-4 flex items-center justify-between rounded-2xl bg-black/[0.03] px-3 py-3 text-xs dark:bg-white/[0.04]">
                <div className="flex min-w-0 items-center gap-2">
                  <Mail className="h-4 w-4 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>

                <button
                  onClick={handleSignOut}
                  className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-200"
                >
                  <LogOut className="h-4 w-4" />
                  Déco
                </button>
              </div>
            </ProfileCard>

            <ProfileCard>
              <h2 className="mb-3 text-sm font-semibold text-gray-900 dark:text-gray-50">
                Comptes connectés
              </h2>

              <div className="space-y-3">
                <ProfileConnectedRow
                  label="Google"
                  connected={googleConnected}
                  onToggle={() => setGoogleConnected(!googleConnected)}
                />
                <ProfileConnectedRow
                  label="Twitch"
                  connected={twitchConnected}
                  onToggle={() => setTwitchConnected(!twitchConnected)}
                />
                <ProfileConnectedRow
                  label="YouTube"
                  connected={youtubeConnected}
                  onToggle={() => setYoutubeConnected(!youtubeConnected)}
                />
                <ProfileConnectedRow
                  label="Twitter/X"
                  connected={xConnected}
                  onToggle={() => setXConnected(!xConnected)}
                />
              </div>
            </ProfileCard>
          </aside>

          <section className="space-y-6">
            <ProfileCard>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    "Préférences",
                    "Statistiques",
                    "Activité",
                    "Médailles & Badges",
                    "Favoris",
                  ] as ProfileTab[]
                ).map((item) => (
                  <ProfileTabButton
                    key={item}
                    active={tab === item}
                    onClick={() => setTab(item)}
                  >
                    {item}
                  </ProfileTabButton>
                ))}
              </div>
            </ProfileCard>

            {tab === "Médailles & Badges" && (
              <ProfileCard>
                <div className="mb-4 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-orange-500" />
                  <h2 className="text-sm font-semibold">Médailles & Badges</h2>
                </div>

                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  <ProfileBadgeCard title="Chef" subtitle="Débutant" meta="5 lives suivis" />
                  <ProfileBadgeCard title="Gourmet" subtitle="Curieux" meta="10 recettes sauvegardées" />
                  <ProfileBadgeCard title="Roi du Chat" meta="100 messages envoyés" />
                  <ProfileBadgeCard title="Matinal" meta="3 lives à 8h" />
                  <ProfileBadgeCard title="Noctambule" meta="3 lives après minuit" />
                  <ProfileBadgeCard title="Ambassadeur" meta="5 parrainages" />
                  <ProfileBadgeCard title="Explorateur" meta="10 lives différents" />
                  <ProfileBadgeCard title="Fidèle" meta="7 jours de suite" />
                </div>
              </ProfileCard>
            )}

            {tab === "Favoris" && (
              <ProfileCard>
                <div className="mb-4 flex items-center gap-2">
                  <Star className="h-4 w-4 text-orange-500" />
                  <h2 className="text-sm font-semibold">Favoris</h2>
                </div>

                <div className="space-y-3">
                  <ProfileFavoriteRow title="Bao buns moelleux" meta="Recette · Sauvegardé" />
                  <ProfileFavoriteRow title="Ramen Tonkotsu" meta="Live · Suivi" />
                  <ProfileFavoriteRow title="Chef Camille Dupont" meta="Chef · Abonné" />
                </div>
              </ProfileCard>
            )}

            {tab === "Préférences" && (
              <ProfileCard>
                <div className="mb-4 flex items-center gap-2">
                  <Settings className="h-4 w-4 text-orange-500" />
                  <h2 className="text-sm font-semibold">Préférences</h2>
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div>
                    <div className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                      Thème
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(["Clair", "Sombre"] as ThemeChoice[]).map((item) => (
                        <ProfilePill
                          key={item}
                          active={themeChoice === item}
                          onClick={() => setTheme(item === "Sombre" ? "dark" : "light")}
                        >
                          {item}
                        </ProfilePill>
                      ))}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                      <Bell className="h-4 w-4" />
                      Notifications
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <ProfilePill active={notifLives} onClick={() => setNotifLives((v) => !v)}>
                        Lives
                      </ProfilePill>
                      <ProfilePill active={notifReplays} onClick={() => setNotifReplays((v) => !v)}>
                        Replays
                      </ProfilePill>
                      <ProfilePill active={notifChefs} onClick={() => setNotifChefs((v) => !v)}>
                        Nouveaux chefs
                      </ProfilePill>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
                      Langue
                    </div>
                    <div className="flex gap-2">
                      <ProfilePill active={lang === "FR"} onClick={() => setLang("FR")}>
                        FR
                      </ProfilePill>
                      <ProfilePill active={lang === "EN"} onClick={() => setLang("EN")}>
                        EN
                      </ProfilePill>
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
              </ProfileCard>
            )}

            {tab === "Statistiques" && (
              <ProfileCard>
                <div className="mb-4 text-sm font-semibold">Statistiques</div>

                <div className="grid gap-3 sm:grid-cols-4">
                  <ProfileStatMiniCard value={`${stats.watchHours} h`} label="Temps de visionnage" />
                  <ProfileStatMiniCard value={`${stats.recipes}`} label="Recettes cuisinées" />
                  <ProfileStatMiniCard value={`${stats.streakDays} jours`} label="Streak" />
                  <ProfileStatMiniCard value={`${stats.chefsFollowed}`} label="Chefs suivis" />
                </div>

                <div className="mt-5 space-y-3">
                  <ProfileProgressRow
                    label="Niveau de Chef"
                    value={`${stats.chefLevel}%`}
                    percent={stats.chefLevel}
                  />
                  <ProfileProgressRow
                    label="Objectif hebdo (5h)"
                    value={`${stats.weeklyGoal}%`}
                    percent={stats.weeklyGoal}
                  />
                </div>
              </ProfileCard>
            )}

            {tab === "Activité" && (
              <ProfileCard>
                <div className="mb-4 text-sm font-semibold">Activité récente</div>
                <div className="space-y-3">
                  <ProfileActivityRow text='A rejoint "Ramen Tonkotsu"' />
                  <ProfileActivityRow text='A sauvegardé "Bao buns moelleux"' />
                  <ProfileActivityRow text='A suivi le chef "Camille Dupont"' />
                </div>
              </ProfileCard>
            )}
          </section>
        </div>
      </div>

      <HomeFooter />
    </main>
  );
}