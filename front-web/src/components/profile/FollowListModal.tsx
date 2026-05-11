"use client";

import { X } from "lucide-react";
import type { UserSummary } from "@/lib/users";

type FollowListModalProps = {
  open: boolean;
  title: string;
  users: UserSummary[];
  loading?: boolean;
  onClose: () => void;
};

function getDisplayName(user: UserSummary) {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return user.username || fullName || user.email || "Utilisateur";
}

function getProfileImage(user: UserSummary) {
  return user.profileImageUrl || user.profile_image_url || "";
}

function getInitials(user: UserSummary) {
  return getDisplayName(user)
    .split(" ")
    .map((part) => part[0]?.toUpperCase())
    .slice(0, 2)
    .join("");
}

export default function FollowListModal({
  open,
  title,
  users,
  loading = false,
  onClose,
}: FollowListModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-orange-100 bg-white shadow-2xl dark:border-white/10 dark:bg-neutral-950">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 dark:border-white/10">
          <h2 className="text-lg font-bold text-gray-950 dark:text-white">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[420px] overflow-y-auto p-3">
          {loading ? (
            <p className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Chargement...
            </p>
          ) : users.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Aucun utilisateur pour le moment.
            </p>
          ) : (
            <div className="space-y-2">
              {users.map((user) => {
                const image = getProfileImage(user);

                return (
                  <div
                    key={user.id}
                    className="flex items-center gap-3 rounded-2xl px-3 py-2 transition hover:bg-orange-50 dark:hover:bg-white/5"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-100 text-sm font-bold text-orange-700 dark:bg-orange-500/20 dark:text-orange-200">
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={image}
                          alt={getDisplayName(user)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        getInitials(user)
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-950 dark:text-white">
                        {getDisplayName(user)}
                      </p>

                      {user.email && (
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {user.email}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}