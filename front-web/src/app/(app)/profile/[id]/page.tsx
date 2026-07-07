"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowLeft, Mail, ShieldCheck, Star } from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import {
  getUserById,
  getUserFollowers,
  getUserFollowing,
  type UserSummary,
} from "@/lib/users";
import ProfileCard from "@/components/profile/ProfileCard";
import FollowButton from "@/components/profile/FollowButton";
import FollowStats from "@/components/profile/FollowStats";
import FollowListModal from "@/components/profile/FollowListModal";
import { initialsOf } from "@/components/profile/profileUtils";
import { useParams } from "next/navigation";

function getDisplayName(user: UserSummary) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return user.username || fullName || user.email || "Utilisateur";
}

export default function PublicProfilePage() {
  const params = useParams<{ id: string }>();
  const { token, user: currentUser, ready } = useAuth();

  const [profile, setProfile] = useState<UserSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);

  const [followModalType, setFollowModalType] = useState<
    "followers" | "following" | null
  >(null);
  const [followModalUsers, setFollowModalUsers] = useState<UserSummary[]>([]);
  const [followModalLoading, setFollowModalLoading] = useState(false);

  const userId = params.id;
  const isOwnProfile = currentUser?.id === userId;

  useEffect(() => {
    if (!ready || !token || !userId) return;

    async function loadProfile() {
      try {
        setLoading(true);

        const foundUser = await getUserById(userId, token ?? undefined);
        setProfile(foundUser);

        setFollowersCount(foundUser.followersIDS?.length ?? 0);
        setFollowingCount(foundUser.followingIDS?.length ?? 0);
      } finally {
        setLoading(false);
      }
    }

    loadProfile();
  }, [ready, token, userId]);

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

  if (!ready || loading) {
    return (
      <main id="main-content" className="grid min-h-[60vh] place-items-center">
        <p
          role="status"
          aria-live="polite"
          className="text-sm text-gray-500 dark:text-gray-300"
        >
          Chargement du profil…
        </p>
      </main>
    );
  }

  if (!token) {
    return (
      <main id="main-content" className="grid min-h-[60vh] place-items-center">
        <div className="text-center">
          <p
            role="alert"
            className="text-sm text-gray-600 dark:text-gray-300"
          >
            Connecte-toi pour voir ce profil.
          </p>

          <Link
            href="/signin"
            className="mt-3 inline-block rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600"
          >
            Se connecter
          </Link>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main id="main-content" className="grid min-h-[60vh] place-items-center">
        <p
          role="alert"
          className="text-sm text-gray-500 dark:text-gray-300"
        >
          Profil introuvable.
        </p>
      </main>
    );
  }

  const displayName = getDisplayName(profile);
  const avatar = profile.profileImageUrl || profile.profile_image_url || "";

  return (
    <main id="main-content" className="min-h-screen">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Link
          href="/watch"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-gray-600 transition hover:text-orange-500 dark:text-gray-300"
        >
          <ArrowLeft aria-hidden="true" className="h-4 w-4" />
          Retour aux lives
        </Link>

        <div className="grid gap-6 md:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-6" aria-label="Informations du profil">
            <ProfileCard>
              <div className="flex flex-col items-center text-center">
                <div className="relative h-24 w-24 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                  {avatar ? (
                    <Image
                      src={avatar}
                      alt={`Photo de profil de ${displayName}`}
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  ) : (
                    <div
                      aria-label={`Initiales de ${displayName}`}
                      className="grid h-full w-full place-items-center text-2xl font-bold"
                    >
                      {initialsOf(profile.username, profile.email)}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                  <h1 className="text-xl font-bold text-gray-950 dark:text-white">
                    {displayName}
                  </h1>

                  {profile.username ? (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-500/20 dark:text-orange-300">
                      @{profile.username}
                    </span>
                  ) : null}
                </div>

                {profile.description ? (
                  <p className="mt-3 text-sm leading-6 text-gray-500 dark:text-gray-400">
                    {profile.description}
                  </p>
                ) : null}

                <div className="mt-5">
                  <FollowStats
                    followersCount={followersCount}
                    followingCount={followingCount}
                    onOpenFollowers={openFollowers}
                    onOpenFollowing={openFollowing}
                  />
                </div>

                <div className="mt-5">
                  {isOwnProfile ? (
                    <Link
                      href="/profile"
                      className="inline-flex items-center justify-center rounded-full border border-orange-200 px-4 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-50 dark:border-orange-900/60 dark:text-orange-300 dark:hover:bg-white/5"
                    >
                      Modifier mon profil
                    </Link>
                  ) : (
                    <FollowButton
                      userId={profile.id}
                      onChange={(isFollowing) => {
                        setFollowersCount((count) =>
                          Math.max(0, count + (isFollowing ? 1 : -1))
                        );
                      }}
                    />
                  )}
                </div>
              </div>
            </ProfileCard>

            <ProfileCard>
              <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-50">
                <ShieldCheck
                  aria-hidden="true"
                  className="h-4 w-4 text-orange-500"
                />
                Informations
              </h2>

              <div className="space-y-3 text-sm text-gray-600 dark:text-gray-300">
                {profile.email ? (
                  <div className="flex items-center gap-2">
                    <Mail
                      aria-hidden="true"
                      className="h-4 w-4 text-gray-400"
                    />
                    <span className="truncate">{profile.email}</span>
                  </div>
                ) : null}

                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Profil public FoodStream.
                </p>
              </div>
            </ProfileCard>
          </aside>

          <section className="space-y-6" aria-label="Contenu public du profil">


            <ProfileCard>
              <div className="mb-4 flex items-center gap-2">
                <Star aria-hidden="true" className="h-4 w-4 text-orange-500" />
                <h2 className="text-sm font-semibold">Lives & Replays</h2>
              </div>

              <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center dark:border-white/10">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-100">
                  Aucun live affiché pour le moment.
                </p>

                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  On pourra bientôt afficher ici ses lives en cours, planifiés et
                  ses replays.
                </p>
              </div>
            </ProfileCard>
          </section>
        </div>
      </div>

      <FollowListModal
        open={followModalType !== null}
        title={followModalType === "followers" ? "Followers" : "Suivis"}
        users={followModalUsers}
        loading={followModalLoading}
        onClose={() => setFollowModalType(null)}
      />
    </main>
  );
}