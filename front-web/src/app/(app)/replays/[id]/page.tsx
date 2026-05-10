"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Eye,
  PlayCircle,
  Tag,
  User,
} from "lucide-react";

import HomeFooter from "@/components/home/HomeFooter";
import { getLiveByRoomId, type LiveDTO } from "@/lib/lives";

export default function ReplayDetailPage() {
  const params = useParams<{ id: string }>();
  const replayId = params?.id;

  const [replay, setReplay] = useState<LiveDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadReplay() {
      if (!replayId) return;

      try {
        setLoading(true);
        setError("");

        const data = await getLiveByRoomId(replayId);
        console.log("REPLAY DATA:", data);
        setReplay(data);
        console.log("REPLAY DATA:", data);
      } catch (err: any) {
        setError(err?.message || "Impossible de charger le replay.");
        setReplay(null);
      } finally {
        setLoading(false);
      }
    }

    loadReplay();
  }, [replayId]);

  const dateLabel = useMemo(() => {
    if (!replay?.created_at) return "Date inconnue";

    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(replay.created_at));
  }, [replay]);

  if (loading) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto w-full max-w-7xl px-6 py-8">
          <div className="h-[520px] animate-pulse rounded-[34px] bg-black/10 dark:bg-white/10" />
        </div>
      </main>
    );
  }

  if (error || !replay) {
    return (
      <main className="min-h-screen">
        <div className="mx-auto w-full max-w-7xl px-6 py-8">
          <div className="rounded-[30px] border border-red-200 bg-red-50 p-8 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200">
            {error || "Replay introuvable."}
          </div>
        </div>
      </main>
    );
  }

  const thumbnail = replay.thumbnail_url || "/images/live-fallback.png";

  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-7xl px-6 py-8 md:py-10">
        <div className="mb-5">
          <Link
            href="/replays"
            className="inline-flex items-center gap-2 rounded-2xl border border-black/8 bg-white/70 px-4 py-2.5 text-sm font-semibold text-gray-900 shadow-sm transition hover:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour aux replays
          </Link>
        </div>

        <section className="overflow-hidden rounded-[34px] border border-black/8 bg-white/72 shadow-[0_20px_60px_rgba(0,0,0,0.06)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <div className="relative aspect-video bg-black">
                {replay.replay_url ? (
                    <video
                    src={
                        replay.replay_url.startsWith("http")
                            ? replay.replay_url
                            : `${process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/api\/?$/, "")}${replay.replay_url}`
                        }
                    controls
                    autoPlay={false}
                    className="h-full w-full object-cover"
                    />
                ) : (
                    <>
                    <img
                        src={thumbnail}
                        alt={replay.title}
                        className="h-full w-full object-cover opacity-80"
                    />

                    <div className="absolute inset-0 bg-black/35" />

                    <div className="absolute inset-0 grid place-items-center">
                        <div className="rounded-full bg-white/95 px-5 py-3 text-sm font-bold text-gray-950 shadow-2xl">
                        Replay en préparation
                        </div>
                    </div>
                    </>
                )}

            <div className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full bg-gray-900 px-3 py-1.5 text-xs font-bold text-white dark:bg-white dark:text-neutral-900">
                <PlayCircle className="h-3.5 w-3.5" />
                REPLAY
            </div>
            </div>

          <div className="grid gap-8 p-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:p-8">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-gray-950 dark:text-white md:text-3xl">
                {replay.title}
              </h1>

              {replay.description ? (
                <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-600 dark:text-gray-400">
                  {replay.description}
                </p>
              ) : (
                <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-500 dark:text-gray-400">
                  Aucun descriptif pour ce replay.
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-2">
                {replay.tags?.map((tag) => (
                  <span
                    key={tag.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-3 py-1.5 text-xs font-bold text-orange-700 dark:bg-orange-500/10 dark:text-orange-300"
                  >
                    <Tag className="h-3.5 w-3.5" />
                    {tag.name}
                  </span>
                ))}
              </div>
            </div>

            <aside className="space-y-3">
              <div className="rounded-3xl bg-black/[0.03] p-4 dark:bg-white/[0.04]">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <User className="h-4 w-4 text-orange-500" />
                  Créateur
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {replay.user?.username || "Chef Foodstream"}
                </p>
              </div>

              <div className="rounded-3xl bg-black/[0.03] p-4 dark:bg-white/[0.04]">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <Eye className="h-4 w-4 text-orange-500" />
                  Vues
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {replay.view_count ?? 0} vue{(replay.view_count ?? 0) > 1 ? "s" : ""}
                </p>
              </div>

              <div className="rounded-3xl bg-black/[0.03] p-4 dark:bg-white/[0.04]">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                  <CalendarDays className="h-4 w-4 text-orange-500" />
                  Publié le
                </div>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {dateLabel}
                </p>
              </div>
            </aside>
          </div>
        </section>
      </div>

      <HomeFooter />
    </main>
  );
}