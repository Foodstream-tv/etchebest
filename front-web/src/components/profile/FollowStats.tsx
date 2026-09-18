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
      className="flex items-center gap-4"
      aria-label={t("profile.followStatsAria")}
    >
      <button
        type="button"
        onClick={onOpenFollowers}
        aria-label={t("profile.showFollowersAria", {
          count: followersCount,
          plural: followersCount > 1 ? "s" : "",
        })}
        className="rounded-xl px-3 py-2 text-left transition hover:bg-orange-50 dark:hover:bg-white/5"
      >
        <span className="block text-base font-bold text-gray-950 dark:text-white">
          {followersCount}
        </span>

        <span className="block text-xs text-gray-500 dark:text-gray-400">
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
        className="rounded-xl px-3 py-2 text-left transition hover:bg-orange-50 dark:hover:bg-white/5"
      >
        <span className="block text-base font-bold text-gray-950 dark:text-white">
          {followingCount}
        </span>

        <span className="block text-xs text-gray-500 dark:text-gray-400">
          {t("profile.following")}
        </span>
      </button>
    </div>
  );
}