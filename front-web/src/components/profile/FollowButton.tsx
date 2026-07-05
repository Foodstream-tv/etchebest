"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, UserPlus } from "lucide-react";

import { followUser, isFollowingUser, unfollowUser } from "@/lib/users";
import { useAuth } from "@/lib/useAuth";

type FollowButtonProps = Readonly<{
  userId: string;
  className?: string;
  onChange?: (isFollowing: boolean) => void;
}>;

export default function FollowButton({
  userId,
  className = "",
  onChange,
}: FollowButtonProps) {
  const { token, user } = useAuth();

  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isOwnProfile = user?.id === userId;

  useEffect(() => {
    if (!token || !userId || isOwnProfile) {
      setLoading(false);
      return;
    }

    let mounted = true;

    async function loadFollowState() {
      try {
        setLoading(true);

        const res = await isFollowingUser(userId, token ?? undefined);

        if (mounted) {
          setIsFollowing(res.is_following);
        }
      } catch {
        if (mounted) {
          setIsFollowing(false);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadFollowState();

    return () => {
      mounted = false;
    };
  }, [token, userId, isOwnProfile]);

  async function handleToggleFollow() {
    if (!token || saving || loading || isOwnProfile) return;

    try {
      setSaving(true);

      if (isFollowing) {
        await unfollowUser(userId, token);
        setIsFollowing(false);
        onChange?.(false);
      } else {
        await followUser(userId, token);
        setIsFollowing(true);
        onChange?.(true);
      }
    } finally {
      setSaving(false);
    }
  }

  if (isOwnProfile) return null;

  const isBusy = loading || saving;

  return (
    <button
      type="button"
      onClick={handleToggleFollow}
      disabled={isBusy}
      aria-pressed={isFollowing}
      aria-busy={isBusy}
      className={[
        "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition",
        isFollowing
          ? "border border-orange-200 bg-white text-orange-700 hover:bg-orange-50 dark:border-orange-900/60 dark:bg-white/5 dark:text-orange-300"
          : "bg-orange-500 text-white shadow-sm hover:bg-orange-600",
        "disabled:cursor-not-allowed disabled:opacity-60",
        className,
      ].join(" ")}
    >
      {isBusy ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : isFollowing ? (
        <Check className="h-4 w-4" aria-hidden="true" />
      ) : (
        <UserPlus className="h-4 w-4" aria-hidden="true" />
      )}

      {isBusy ? "Chargement..." : isFollowing ? "Suivi" : "Suivre"}
    </button>
  );
}