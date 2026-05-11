"use client";

type FollowStatsProps = {
  followersCount: number;
  followingCount: number;
  onOpenFollowers: () => void;
  onOpenFollowing: () => void;
};

export default function FollowStats({
  followersCount,
  followingCount,
  onOpenFollowers,
  onOpenFollowing,
}: FollowStatsProps) {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        onClick={onOpenFollowers}
        className="rounded-xl px-3 py-2 text-left transition hover:bg-orange-50 dark:hover:bg-white/5"
      >
        <p className="text-base font-bold text-gray-950 dark:text-white">
          {followersCount}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">Followers</p>
      </button>

      <button
        type="button"
        onClick={onOpenFollowing}
        className="rounded-xl px-3 py-2 text-left transition hover:bg-orange-50 dark:hover:bg-white/5"
      >
        <p className="text-base font-bold text-gray-950 dark:text-white">
          {followingCount}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">Suivis</p>
      </button>
    </div>
  );
}