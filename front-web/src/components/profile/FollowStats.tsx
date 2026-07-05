"use client";

type FollowStatsProps = Readonly<{
  followersCount: number;
  followingCount: number;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
}>;

export default function FollowStats({
  followersCount,
  followingCount,
  onOpenFollowers,
  onOpenFollowing,
}: FollowStatsProps) {
  return (
    <div
      className="flex items-center gap-4"
      aria-label="Statistiques d'abonnement"
    >
      <button
        type="button"
        onClick={onOpenFollowers}
        aria-label={`Afficher les ${followersCount} follower${
          followersCount > 1 ? "s" : ""
        }`}
        className="rounded-xl px-3 py-2 text-left transition hover:bg-orange-50 dark:hover:bg-white/5"
      >
        <span className="block text-base font-bold text-gray-950 dark:text-white">
          {followersCount}
        </span>

        <span className="block text-xs text-gray-500 dark:text-gray-400">
          Followers
        </span>
      </button>

      <button
        type="button"
        onClick={onOpenFollowing}
        aria-label={`Afficher les ${followingCount} profil${
          followingCount > 1 ? "s" : ""
        } suivi${followingCount > 1 ? "s" : ""}`}
        className="rounded-xl px-3 py-2 text-left transition hover:bg-orange-50 dark:hover:bg-white/5"
      >
        <span className="block text-base font-bold text-gray-950 dark:text-white">
          {followingCount}
        </span>

        <span className="block text-xs text-gray-500 dark:text-gray-400">
          Suivis
        </span>
      </button>
    </div>
  );
}