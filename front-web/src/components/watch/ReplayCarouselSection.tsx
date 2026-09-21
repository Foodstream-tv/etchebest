"use client";

import Image from "next/image";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  PlayCircle,
  Share2,
  Trash2,
} from "lucide-react";
import { useId, useRef, useState } from "react";

import type { LiveDTO } from "@/lib/lives";
import { useAuth } from "@/lib/useAuth";
import { useI18n } from "@/i18n/LanguageContext";

type Props = {
  title: string;
  replays: LiveDTO[];
  onDeleteReplay?: (replay: LiveDTO) => Promise<void>;
};

export default function ReplayCarouselSection({ title, replays, onDeleteReplay }: Props) {
  const { t } = useI18n();
  const { user } = useAuth();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const titleId = useId();

  const [openMenuReplayId, setOpenMenuReplayId] = useState<number | string | null>(null);
  const [copiedId, setCopiedId] = useState<number | string | null>(null);

  const scroll = (direction: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: direction === "left" ? -900 : 900,
      behavior: "smooth",
    });
  };

  const handleShare = async (replay: LiveDTO) => {
    const url = `${window.location.origin}/replays/${encodeURIComponent(replay.room_id)}`;
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      }
      setCopiedId(replay.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error("Failed to copy replay link:", err);
    }
  };

  const handleDelete = async (replay: LiveDTO) => {
    setOpenMenuReplayId(null);
    if (!window.confirm(t("replays.deleteConfirm"))) return;
    if (onDeleteReplay) {
      await onDeleteReplay(replay);
    }
  };

  if (!replays.length) return null;

  const [firstWord, ...restTitle] = title.split(" ");

  return (
    <section className="space-y-4" aria-labelledby={titleId}>
      <h2 id={titleId} className="text-xl font-bold text-gray-950 dark:text-white">
        <span className="text-orange-500">{firstWord}</span>{" "}
        {restTitle.join(" ")}
      </h2>

      <div className="relative">
        {replays.length > 4 ? (
          <>
            <button
              type="button"
              onClick={() => scroll("left")}
              aria-label={t("replays.scrollLeftAria", { title })}
              className="absolute -left-4 top-[38%] z-20 grid h-10 w-10 place-items-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur transition hover:bg-black"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={() => scroll("right")}
              aria-label={t("replays.scrollRightAria", { title })}
              className="absolute -right-4 top-[38%] z-20 grid h-10 w-10 place-items-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur transition hover:bg-black"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </>
        ) : null}

        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scroll-smooth pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {replays.map((replay) => {
            const thumbnail =
              replay.thumbnail_url || "/images/live-fallback.png";

            const creatorName = replay.user?.username || "Chef FoodStream";
            const isOwner = Boolean(
              user?.id && replay.user?.id && String(user.id) === String(replay.user.id)
            );

            return (
              <article
                key={replay.id}
                className="group relative w-[310px] shrink-0"
              >
                <Link
                  href={`/replays/${encodeURIComponent(replay.room_id)}`}
                  aria-label={t("replays.viewReplayAria", { title: replay.title, creator: creatorName })}
                  className="block"
                >
                  <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
                    <Image
                      src={thumbnail}
                      alt={t("replays.thumbnailAlt", { title: replay.title })}
                      fill
                      sizes="310px"
                      unoptimized
                      className="object-cover transition duration-300 group-hover:scale-105"
                    />

                    <div
                      className="absolute inset-0 bg-black/10 transition group-hover:bg-black/25"
                      aria-hidden="true"
                    />

                    <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs font-bold text-white">
                      <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("replays.badgeVideo")}
                    </div>

                    <div className="absolute bottom-3 left-3 rounded-md bg-black/70 px-2 py-1 text-sm font-bold text-white">
                      {t("replays.views", {
                        count: replay.view_count ?? 0,
                        plural: (replay.view_count ?? 0) > 1 ? "s" : "",
                      })}
                    </div>
                  </div>
                </Link>

                <div className="mt-3 flex gap-3">
                  <Link
                    href={`/replays/${encodeURIComponent(replay.room_id)}`}
                    className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-orange-500"
                  >
                    {replay.user?.profile_image_url ? (
                      <Image
                        src={replay.user.profile_image_url}
                        alt={`Photo de profil de ${creatorName}`}
                        width={40}
                        height={40}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </Link>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={`/replays/${encodeURIComponent(replay.room_id)}`}
                        className="line-clamp-2 text-sm font-bold text-gray-950 transition hover:text-orange-500 dark:text-white dark:hover:text-orange-400"
                      >
                        {replay.title}
                      </Link>

                      <div className="relative shrink-0">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setOpenMenuReplayId((prev) => (prev === replay.id ? null : replay.id));
                          }}
                          aria-label={t("replays.optionsAria")}
                          className="grid h-7 w-7 place-items-center rounded-lg text-gray-400 transition hover:bg-black/5 hover:text-gray-700 dark:hover:bg-white/10 dark:hover:text-white"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </button>

                        {openMenuReplayId === replay.id && (
                          <>
                            <div
                              className="fixed inset-0 z-30"
                              onClick={() => setOpenMenuReplayId(null)}
                            />
                            <div className="absolute right-0 top-full z-40 mt-1 w-44 overflow-hidden rounded-2xl border border-black/10 bg-white/95 p-1.5 shadow-2xl backdrop-blur-md dark:border-white/10 dark:bg-[#1a130e]">
                              <button
                                type="button"
                                onClick={() => handleShare(replay)}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 transition hover:bg-black/5 dark:text-gray-200 dark:hover:bg-white/10"
                              >
                                {copiedId === replay.id ? (
                                  <>
                                    <Check className="h-4 w-4 text-green-500" />
                                    <span className="text-green-600 dark:text-green-400">{t("replays.copied")}</span>
                                  </>
                                ) : (
                                  <>
                                    <Share2 className="h-4 w-4" />
                                    <span>{t("replays.share")}</span>
                                  </>
                                )}
                              </button>

                              {isOwner ? (
                                <button
                                  type="button"
                                  onClick={() => handleDelete(replay)}
                                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span>{t("replays.delete")}</span>
                                </button>
                              ) : null}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
                      {creatorName}
                    </p>

                    <p className="truncate text-sm text-gray-500 dark:text-gray-400">
                      {replay.dish_name || "Cuisine"}
                    </p>

                    {replay.tags?.length ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {replay.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag.id}
                            className="rounded-full bg-black/[0.06] px-2 py-1 text-xs font-semibold text-gray-700 dark:bg-white/10 dark:text-gray-300"
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}