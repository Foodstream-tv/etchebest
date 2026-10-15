"use client";

import Image from "next/image";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Mail, LogOut, Settings, Bell, Pencil, X, Save, Sun, Moon, Languages, type LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { apiFetch } from "@/lib/api";
import { getUserFollowers, getUserFollowing, type UserSummary } from "@/lib/users";
import HomeFooter from "@/components/home/HomeFooter";
import ProfileCard from "@/components/profile/ProfileCard";
import ProfilePill from "@/components/profile/ProfilePill";
import FollowStats from "@/components/profile/FollowStats";
import FollowListModal from "@/components/profile/FollowListModal";
import PrivacyDataCard from "@/components/profile/PrivacyDataCard";
import { initialsOf } from "@/components/profile/profileUtils";
import { useTheme } from "@/components/theme/ThemeProvider";
import { getMyActivities } from "@/lib/activity";
import { usePathname, useRouter } from "next/navigation";
import { useNotifications } from "@/components/notifications/NotificationProvider";
import { useI18n } from "@/i18n/LanguageContext";

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

function PreferenceRow({
  icon: Icon,
  label,
  children,
}: Readonly<{ icon: LucideIcon; label: string; children: ReactNode }>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-col gap-3 py-4 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
    >
      <div className="flex items-center gap-3 text-base font-medium text-gray-900 dark:text-gray-100">
        <Icon aria-hidden="true" className="h-5 w-5 text-gray-400" />
        {label}
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">{children}</div>
    </div>
  );
}

type UpdateProfilePayload = {
  username?: string;
  email?: string;
  description?: string;
  password?: string;
};

export default function ProfilePage() {
  const { user, token, signOut, ready } = useAuth();
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) {
      router.replace("/signin");
    }
  }, [ready, user, router]);

  const pathname = usePathname();
  const { pushNotification } = useNotifications();

  const [profile, setProfile] = useState<MeProfile | null>(null);

  const [followersCount, setFollowersCount] = useState(0);
  const [newFollowerNotification, setNewFollowerNotification] = useState(false);
  const [notificationCount, setNotificationCount] = useState(0);

  const [activities, setActivities] = useState<
    {
      id: string;
      text: string;
      createdAt?: string;
    }[]
  >([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [followModalType, setFollowModalType] = useState<
    "followers" | "following" | null
  >(null);
  const [followModalUsers, setFollowModalUsers] = useState<UserSummary[]>([]);
  const [followModalLoading, setFollowModalLoading] = useState(false);

  const { theme, setTheme } = useTheme();
  const themeChoice: ThemeChoice = theme === "dark" ? "Sombre" : "Clair";
  const [notifLives, setNotifLives] = useState(true);
  const [notifReplays, setNotifReplays] = useState(false);
  const [notifChefs, setNotifChefs] = useState(true);



  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editConfirmPassword, setEditConfirmPassword] = useState("");
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");

  const getReadActivityStorageKey = () => {
    return `readActivityIds:${user?.id ?? "unknown"}`;
  };

  const refreshProfile = async () => {
    if (!token) return;

    const freshProfile = await apiFetch<MeProfile>("/users/me", {
      token,
      cache: "no-store",
    });

    const activitiesRes = await getMyActivities(token ?? undefined);
    const backendActivities = activitiesRes.activities ?? [];

    setActivities(
      backendActivities.map((activity) => ({
        id: activity.id,
        text: activity.text,
        createdAt: activity.created_at,
      }))
    );

    const readActivityIds = JSON.parse(
      localStorage.getItem(getReadActivityStorageKey()) || "[]"
    ) as string[];

    const unreadActivities = backendActivities.filter(
      (activity) => !readActivityIds.includes(activity.id)
    );

    if (pathname !== "/profile" && unreadActivities.length > 0) {
      unreadActivities.forEach((activity) => {
        pushNotification({
          title: t("profile.newActivity"),
          message: activity.text,
          href: "/profile",
        });
      });

      localStorage.setItem(
        getReadActivityStorageKey(),
        JSON.stringify(
          backendActivities.map((activity) => activity.id)
        )
      );
    }

    if (pathname === "/profile") {
      setNotificationCount(unreadActivities.length);
      setNewFollowerNotification(unreadActivities.length > 0);
    }

    setProfile(freshProfile);
  };

  useEffect(() => {
    if (!token) return;

    refreshProfile().catch(() => {});

    const interval = window.setInterval(() => {
      refreshProfile().catch(() => {});
    }, 3000);

    return () => window.clearInterval(interval);
  }, [token]);

  useEffect(() => {
    if (!profile) return;

    setFollowersCount(
      profile.followersIds?.length ??
        profile.followerCount ??
        0
    );

    setFollowingCount(profile.followingIds?.length ?? 0);
  }, [profile]);



  if (!ready || !user) {
    return (
      <main id="main-content" className="grid min-h-[60vh] place-items-center">
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-gray-500 dark:text-gray-300"
        >
          {!ready ? t("common.loading") : t("common.redirecting")}
        </p>
      </main>
    );
  }

  const displayName =
    profile
      ? [profile.firstName, profile.lastName].filter(Boolean).join(" ") ||
        profile.username
      : user.username || t("nav.myProfile");

  const handleSignOut = async () => {
    await signOut();
    window.location.href = "/signin?logout=true";
  };

  const openFollowers = async () => {
    if (!token || !profile) return;

    setFollowModalType("followers");
    setFollowModalUsers([]);
    setFollowModalLoading(true);

    try {
      const res = await getUserFollowers(profile.id, token);
      setFollowModalUsers(res.followers ?? []);
      setFollowersCount(res.count);
    } finally {
      setFollowModalLoading(false);
    }
  };

  const openFollowing = async () => {
    if (!token || !profile) return;

    setFollowModalType("following");
    setFollowModalUsers([]);
    setFollowModalLoading(true);

    try {
      const res = await getUserFollowing(profile.id, token);
      setFollowModalUsers(res.following ?? []);
      setFollowingCount(res.count);
    } finally {
      setFollowModalLoading(false);
    }
  };

  const openEditModal = () => {
    setEditUsername(profile?.username || user.username || "");
    setEditEmail(user.email || "");
    setEditDescription(profile?.description || "");
    setEditPassword("");
    setEditConfirmPassword("");
    setEditError("");
    setEditSuccess("");
    setIsEditOpen(true);
  };

  const closeEditModal = () => {
    if (editLoading) return;
    setIsEditOpen(false);
    setEditError("");
    setEditSuccess("");
    setEditPassword("");
    setEditConfirmPassword("");
  };

  const handleUpdateProfile = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setEditError("");
    setEditSuccess("");

    if (!editUsername.trim()) {
      setEditError(t("profile.editModal.errorUsername"));
      return;
    }

    if (!editEmail.trim()) {
      setEditError(t("profile.editModal.errorEmail"));
      return;
    }

    if (editPassword && editPassword.length < 6) {
      setEditError(t("profile.editModal.errorPasswordLen"));
      return;
    }

    if (editPassword !== editConfirmPassword) {
      setEditError(t("profile.editModal.errorPasswordMatch"));
      return;
    }

    const payload: UpdateProfilePayload = {
      username: editUsername.trim(),
      email: editEmail.trim(),
      description: editDescription.trim(),
    };

    if (editPassword.trim()) {
      payload.password = editPassword.trim();
    }

    try {
      setEditLoading(true);

      await apiFetch("/users/me", {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
      });

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              username: editUsername.trim(),
              description: editDescription.trim(),
            }
          : prev
      );

      setEditSuccess(t("profile.editModal.success"));
      setEditPassword("");
      setEditConfirmPassword("");

      setTimeout(() => {
        setIsEditOpen(false);
        setEditSuccess("");
      }, 700);
    } catch (error) {
      setEditError(
        error instanceof Error
          ? error.message
          : t("profile.editModal.errorGeneric")
      );
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <main id="main-content" className="min-h-screen">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <h1 className="mb-6 text-2xl font-bold tracking-tight text-gray-950 sm:mb-8 sm:text-3xl dark:text-white">
          {t("nav.myProfile")}
        </h1>

        <div className="grid items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-8">
          <aside aria-label={t("profile.infoAria")}>
            <ProfileCard>
              <div className="flex flex-col items-center text-center">
                <div className="relative h-24 w-24 overflow-hidden rounded-full bg-black/[0.06] ring-4 ring-orange-500/15 dark:bg-white/10">
                  {profile?.profileImageUrl || user.profileImageUrl ? (
                    <Image
                      src={(profile?.profileImageUrl || user.profileImageUrl)!}
                      alt={t("profile.avatarAlt", { name: displayName })}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  ) : (
                    <div
                      aria-label={t("profile.initialsAria", { name: displayName })}
                      className="grid h-full w-full place-items-center text-2xl font-bold"
                    >
                      {initialsOf(profile?.username || user.username, user.email)}
                    </div>
                  )}
                </div>

                <h2 className="mt-4 max-w-full truncate text-xl font-bold text-gray-950 dark:text-white">
                  {displayName}
                </h2>

                {profile?.username ? (
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400">
                    @{profile.username}
                  </p>
                ) : null}

                {profile?.isVerified || profile?.isFeaturedChef ? (
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    {profile?.isVerified ? (
                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                        {t("profile.verified")}
                      </span>
                    ) : null}

                    {profile?.isFeaturedChef ? (
                      <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-semibold text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
                        {t("profile.chef")}
                      </span>
                    ) : null}
                  </div>
                ) : null}

                {profile?.description ? (
                  <p className="mt-3 text-sm leading-6 text-gray-600 dark:text-gray-300">
                    {profile.description}
                  </p>
                ) : null}

                {profile ? (
                  <div className="mt-5 w-full">
                    <FollowStats
                      followersCount={followersCount}
                      followingCount={followingCount}
                      onOpenFollowers={openFollowers}
                      onOpenFollowing={openFollowing}
                    />
                  </div>
                ) : null}
              </div>

              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-black/[0.03] px-4 py-3 text-sm text-gray-700 dark:bg-white/[0.04] dark:text-gray-200">
                <Mail aria-hidden="true" className="h-4 w-4 shrink-0 text-gray-400" />
                <span className="truncate">{user.email}</span>
              </div>

              <div className="mt-5 space-y-2">
                <button
                  onClick={openEditModal}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(249,115,22,0.28)] transition hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/30"
                  type="button"
                  aria-label={t("profile.editAria")}
                >
                  <Pencil aria-hidden="true" className="h-4 w-4" />
                  {t("profile.edit")}
                </button>

                <button
                  onClick={handleSignOut}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-black/8 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-black/[0.04] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-500/30 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/[0.06]"
                  type="button"
                  aria-label={t("profile.signoutAria")}
                >
                  <LogOut aria-hidden="true" className="h-4 w-4" />
                  {t("profile.signout")}
                </button>
              </div>
            </ProfileCard>
          </aside>

          <section className="space-y-6" aria-label={t("profile.contentAria")}>
            <ProfileCard>
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-orange-500/10 text-orange-500">
                  <Settings aria-hidden="true" className="h-5 w-5" />
                </span>
                <h2 className="text-lg font-semibold text-gray-950 dark:text-white">
                  {t("profile.preferences.title")}
                </h2>
              </div>

              <div className="mt-4 divide-y divide-black/8 dark:divide-white/10">
                <PreferenceRow
                  icon={theme === "dark" ? Moon : Sun}
                  label={t("profile.preferences.theme")}
                >
                  {(["light", "dark"] as const).map((mode) => (
                    <ProfilePill
                      key={mode}
                      active={theme === mode}
                      onClick={() => setTheme(mode)}
                    >
                      {mode === "dark"
                        ? t("profile.preferences.theme.dark")
                        : t("profile.preferences.theme.light")}
                    </ProfilePill>
                  ))}
                </PreferenceRow>

                <PreferenceRow icon={Languages} label={t("profile.preferences.language")}>
                  <ProfilePill
                    active={locale === "fr"}
                    onClick={() => setLocale("fr")}
                  >
                    {t("profile.languages.fr")}
                  </ProfilePill>
                  <ProfilePill
                    active={locale === "en"}
                    onClick={() => setLocale("en")}
                  >
                    {t("profile.languages.en")}
                  </ProfilePill>
                </PreferenceRow>

                <PreferenceRow icon={Bell} label={t("profile.preferences.notifications")}>
                  <ProfilePill
                    active={notifLives}
                    onClick={() => setNotifLives((v) => !v)}
                  >
                    {t("profile.preferences.notif.lives")}
                  </ProfilePill>
                  <ProfilePill
                    active={notifReplays}
                    onClick={() => setNotifReplays((v) => !v)}
                  >
                    {t("profile.preferences.notif.replays")}
                  </ProfilePill>
                  <ProfilePill
                    active={notifChefs}
                    onClick={() => setNotifChefs((v) => !v)}
                  >
                    {t("profile.preferences.notif.newChefs")}
                  </ProfilePill>
                </PreferenceRow>
              </div>
            </ProfileCard>

            <PrivacyDataCard />
          </section>
        </div>
      </div>

      {isEditOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 px-4 py-6 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-profile-title"
            aria-describedby="edit-profile-description"
            className="w-full max-w-2xl overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-neutral-950"
          >
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 dark:border-gray-800">
              <div>
                <h2
                  id="edit-profile-title"
                  className="text-lg font-bold text-gray-900 dark:text-white"
                >
                  {t("profile.editModal.title")}
                </h2>

                <p
                  id="edit-profile-description"
                  className="text-sm text-gray-500 dark:text-gray-400"
                >
                  {t("profile.editModal.desc")}
                </p>
              </div>

              <button
                onClick={closeEditModal}
                className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-neutral-800 dark:hover:text-white"
                type="button"
                aria-label={t("profile.editModal.closeAria")}
              >
                <X aria-hidden="true" className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-5 px-6 py-6">
              {editError ? (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300"
                >
                  {editError}
                </div>
              ) : null}

              {editSuccess ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-300"
                >
                  {editSuccess}
                </div>
              ) : null}

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="edit-username"
                    className="mb-2 block text-sm font-semibold text-gray-900 dark:text-white"
                  >
                    {t("profile.editModal.username")}
                  </label>

                  <input
                    id="edit-username"
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value)}
                    type="text"
                    autoComplete="username"
                    placeholder={t("profile.editModal.usernamePlaceholder")}
                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-neutral-900 dark:text-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-email"
                    className="mb-2 block text-sm font-semibold text-gray-900 dark:text-white"
                  >
                    {t("profile.editModal.email")}
                  </label>

                  <input
                    id="edit-email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    type="email"
                    autoComplete="email"
                    placeholder="email@foodstream.com"
                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-neutral-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="edit-description"
                  className="mb-2 block text-sm font-semibold text-gray-900 dark:text-white"
                >
                  {t("profile.editModal.bio")}
                </label>

                <textarea
                  id="edit-description"
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={5}
                  placeholder={t("profile.editModal.bioPlaceholder")}
                  className="w-full resize-none rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-neutral-900 dark:text-white"
                />
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="edit-password"
                    className="mb-2 block text-sm font-semibold text-gray-900 dark:text-white"
                  >
                    {t("profile.editModal.newPassword")}
                  </label>

                  <input
                    id="edit-password"
                    value={editPassword}
                    onChange={(e) => setEditPassword(e.target.value)}
                    type="password"
                    autoComplete="new-password"
                    placeholder={t("profile.editModal.newPasswordPlaceholder")}
                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-neutral-900 dark:text-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-confirm-password"
                    className="mb-2 block text-sm font-semibold text-gray-900 dark:text-white"
                  >
                    {t("profile.editModal.confirmPassword")}
                  </label>

                  <input
                    id="edit-confirm-password"
                    value={editConfirmPassword}
                    onChange={(e) => setEditConfirmPassword(e.target.value)}
                    type="password"
                    autoComplete="new-password"
                    placeholder={t("profile.editModal.confirmPasswordPlaceholder")}
                    className="w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-gray-700 dark:bg-neutral-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 border-t border-gray-200 pt-5 sm:flex-row sm:justify-end dark:border-gray-800">
                <button
                  onClick={closeEditModal}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-300 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-neutral-800"
                  type="button"
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                  {t("common.cancel")}
                </button>

                <button
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                  type="submit"
                  disabled={editLoading}
                >
                  <Save aria-hidden="true" className="h-4 w-4" />
                  {editLoading ? t("common.saving") : t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <FollowListModal
        open={followModalType !== null}
        title={followModalType === "followers" ? t("profile.followers") : t("profile.following")}
        users={followModalUsers}
        loading={followModalLoading}
        onClose={() => setFollowModalType(null)}
      />

      <HomeFooter />
    </main>
  );
}