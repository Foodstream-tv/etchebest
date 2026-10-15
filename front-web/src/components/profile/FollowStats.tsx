"use client";

import { useI18n } from "@/i18n/LanguageContext";

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
  const { t } = useI18n();

  return (
    <div
      className="grid w-full grid-cols-2 divide-x divide-black/8 overflow-hidden rounded-2xl bg-black/[0.03] dark:divide-white/10 dark:bg-white/[0.04]"
      aria-label={t("profile.followStatsAria")}
    >
      <button
        type="button"
        onClick={onOpenFollowers}
        aria-label={t("profile.showFollowersAria", {
          count: followersCount,
          plural: followersCount > 1 ? "s" : "",
        })}
        className="px-4 py-3 text-center transition hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-orange-500/30 dark:hover:bg-white/5"
      >
        <span className="block text-xl font-bold text-gray-950 dark:text-white">
          {followersCount}
        </span>

        <span className="block text-sm text-gray-500 dark:text-gray-400">
          {t("profile.followers")}
        </span>
      </button>

      <button
        type="button"
        onClick={onOpenFollowing}
        aria-label={t("profile.showFollowingAria", {
          count: followingCount,
          plural: followingCount > 1 ? "s" : "",
        })}
        className="px-4 py-3 text-center transition hover:bg-orange-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-orange-500/30 dark:hover:bg-white/5"
      >
        <span className="block text-xl font-bold text-gray-950 dark:text-white">
          {followingCount}
        </span>

        <span className="block text-sm text-gray-500 dark:text-gray-400">
          {t("profile.following")}
        </span>
      </button>
    </div>
  );
}