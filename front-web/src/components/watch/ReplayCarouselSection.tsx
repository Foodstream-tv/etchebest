"use client";

import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, ChevronRight, MoreVertical, PlayCircle } from "lucide-react";
import { useRef } from "react";
import type { LiveDTO } from "@/lib/lives";

type Props = {
  title: string;
  replays: LiveDTO[];
};

export default function ReplayCarouselSection({ title, replays }: Props) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const scroll = (direction: "left" | "right") => {
    scrollRef.current?.scrollBy({
      left: direction === "left" ? -900 : 900,
      behavior: "smooth",
    });
  };

  if (!replays.length) return null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold text-gray-950 dark:text-white">
        <span className="text-orange-500">{title.split(" ")[0]}</span>{" "}
        {title.split(" ").slice(1).join(" ")}
      </h2>

      <div className="relative">
        {replays.length > 4 ? (
          <>
            <button
              type="button"
              onClick={() => scroll("left")}
              className="absolute -left-4 top-[38%] z-20 grid h-10 w-10 place-items-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur transition hover:bg-black"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => scroll("right")}
              className="absolute -right-4 top-[38%] z-20 grid h-10 w-10 place-items-center rounded-full bg-black/70 text-white shadow-lg backdrop-blur transition hover:bg-black"
            >
              <ChevronRight className="h-5 w-5" />
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

            return (
              <Link
                key={replay.id}
                href={`/replays/${encodeURIComponent(replay.room_id)}`}
                className="group w-[310px] shrink-0"
              >
                <div className="relative aspect-video overflow-hidden rounded-2xl bg-black">
                  <Image
                    src={thumbnail}
                    alt={replay.title}
                    fill
                    className="object-cover transition duration-300 group-hover:scale-105"
                  />

                  <div className="absolute inset-0 bg-black/10 transition group-hover:bg-black/25" />

                  <div className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs font-bold text-white">
                    <PlayCircle className="h-3.5 w-3.5" />
                    REPLAY
                  </div>

                  <div className="absolute bottom-3 left-3 rounded-md bg-black/70 px-2 py-1 text-sm font-bold text-white">
                    {replay.view_count ?? 0} vue
                    {(replay.view_count ?? 0) > 1 ? "s" : ""}
                  </div>
                </div>

                <div className="mt-3 flex gap-3">
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-orange-500">
                    {replay.user?.profile_image_url ? (
                      <Image
                        src={replay.user.profile_image_url}
                        alt={replay.user.username || "Créateur"}
                        width={40}
                        height={40}
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex gap-2">
                      <h3 className="line-clamp-2 text-sm font-bold text-gray-950 dark:text-white">
                        {replay.title}
                      </h3>

                      <MoreVertical className="h-4 w-4 shrink-0 text-gray-400" />
                    </div>

                    <p className="mt-1 truncate text-sm text-gray-500 dark:text-gray-400">
                      {replay.user?.username || "Chef FoodStream"}
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
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}