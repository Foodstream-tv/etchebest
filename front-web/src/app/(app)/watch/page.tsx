"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Eye,
  Radio,
  RefreshCw,
  Users,
  Video,
  PlusCircle,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/lib/useAuth";
import { getRooms, RoomInfo } from "@/services/streaming";
import HomeFooter from "@/components/home/HomeFooter";
import StatCard from "@/components/home/watch/StatCard";
import InfoPill from "@/components/home/watch/InfoPill";

export default function WatchListPage() {
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { token, ready } = useAuth();
  const didInit = useRef(false);

  const refresh = async () => {
    if (!token) {
      setError("Utilisateur non authentifié");
      setRooms([]);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      setLoading(true);
      const data = await getRooms(token);
      setRooms(data ?? []);
    } catch (e: any) {
      setError(e?.message ?? "Impossible de charger les lives");
      setRooms([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready) return;
    if (didInit.current) return;
    didInit.current = true;

    refresh();

    const t = setInterval(refresh, 10_000);
    return () => clearInterval(t);
  }, [ready, token]);

  const hasRooms = useMemo(() => rooms.length > 0, [rooms]);

  const totalViewers = useMemo(() => {
    return rooms.reduce((sum, room) => sum + (room.viewers ?? 0), 0);
  }, [rooms]);

  const totalParticipants = useMemo(() => {
    return rooms.reduce((sum, room) => sum + (room.participants?.length ?? 0), 0);
  }, [rooms]);

  return (
    <main className="min-h-screen">
      <div className="mx-auto w-full max-w-7xl px-6 py-8 md:py-10">
        <div className="space-y-8">
          <section className="rounded-[32px] border border-black/8 bg-white/68 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/58 dark:shadow-[0_20px_60px_rgba(0,0,0,0.35)] md:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-orange-50 px-3 py-1.5 text-sm font-medium text-orange-700 dark:bg-orange-500/10 dark:text-orange-300">
                  <Radio className="h-4 w-4" />
                  Lives Foodstream
                </div>

                <h1 className="text-3xl font-semibold tracking-tight text-gray-900 dark:text-gray-50 md:text-4xl">
                  Découvre les lives en cours
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600 dark:text-gray-400 md:text-base">
                  Regarde un live, rejoins une room existante s’il reste de la place,
                  ou lance ton propre live en quelques secondes.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={refresh}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-2xl border border-black/8 bg-white/80 px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/10"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Actualiser
                </button>

                <Link
                  href="/studio"
                  className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(249,115,22,0.28)] transition hover:bg-orange-400"
                >
                  <PlusCircle className="h-4 w-4" />
                  Créer un live
                </Link>
              </div>
            </div>
          </section>

          {loading && (
            <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="overflow-hidden rounded-[28px] border border-black/8 bg-white/72 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]"
                >
                  <div className="h-44 animate-pulse bg-black/[0.05] dark:bg-white/10" />
                  <div className="space-y-3 p-5">
                    <div className="h-4 w-24 animate-pulse rounded bg-black/[0.06] dark:bg-white/10" />
                    <div className="h-5 w-3/4 animate-pulse rounded bg-black/[0.06] dark:bg-white/10" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-black/[0.06] dark:bg-white/10" />
                    <div className="h-11 w-full animate-pulse rounded-2xl bg-black/[0.06] dark:bg-white/10" />
                  </div>
                </div>
              ))}
            </section>
          )}

          {!loading && error && (
            <section className="rounded-[28px] border border-red-200 bg-red-50/80 p-5 backdrop-blur-sm dark:border-red-500/20 dark:bg-red-500/10">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-base font-semibold text-red-700 dark:text-red-200">
                    Impossible de charger les lives
                  </h2>
                  <p className="mt-1 text-sm text-red-600 dark:text-red-200/80">
                    {error}
                  </p>
                </div>

                <button
                  onClick={refresh}
                  className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                >
                  <RefreshCw className="h-4 w-4" />
                  Réessayer
                </button>
              </div>
            </section>
          )}

          {!loading && !error && !hasRooms && (
            <section className="rounded-[28px] border border-black/8 bg-white/72 p-10 text-center shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
              <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-200">
                <Video className="h-8 w-8" />
              </div>

              <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-gray-50">
                Aucun live en cours
              </h2>

              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-gray-600 dark:text-gray-400">
                Il n’y a pas encore de live actif pour le moment. Lance le premier et
                commence à cuisiner en direct.
              </p>

              <div className="mt-6">
                <Link
                  href="/studio"
                  className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_rgba(249,115,22,0.28)] transition hover:bg-orange-400"
                >
                  <PlusCircle className="h-4 w-4" />
                  Lancer un live
                </Link>
              </div>
            </section>
          )}

          {!loading && !error && hasRooms && (
            <>
              <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                <StatCard
                  label="Lives actifs"
                  value={String(rooms.length)}
                  icon={<Radio className="h-5 w-5" />}
                />
                <StatCard
                  label="Spectateurs cumulés"
                  value={String(totalViewers)}
                  icon={<Eye className="h-5 w-5" />}
                />
                <StatCard
                  label="Participants cumulés"
                  value={String(totalParticipants)}
                  icon={<Users className="h-5 w-5" />}
                />
              </section>

              <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                {rooms.map((room) => {
                  const participants = room.participants?.length ?? 0;
                  const maxParticipants = room.maxParticipants ?? 0;
                  const viewers = room.viewers ?? 0;
                  const spotsLeft = Math.max(maxParticipants - participants, 0);
                  const rid = encodeURIComponent(room.id);

                  return (
                    <article
                      key={room.id}
                      className="group overflow-hidden rounded-[28px] border border-black/8 bg-white/72 shadow-[0_16px_40px_rgba(0,0,0,0.05)] backdrop-blur-md transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_50px_rgba(0,0,0,0.08)] dark:border-white/10 dark:bg-[#120b05]/60 dark:shadow-[0_16px_40px_rgba(0,0,0,0.35)] dark:hover:shadow-[0_22px_50px_rgba(0,0,0,0.45)]"
                    >
                      <div className="relative h-44 bg-gradient-to-br from-orange-400 via-orange-500 to-red-500 p-4 text-white">
                        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_top_right,white,transparent_35%),radial-gradient(circle_at_bottom_left,white,transparent_30%)]" />

                        <div className="relative flex h-full flex-col justify-between">
                          <div className="flex items-start justify-between gap-3">
                            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur">
                              <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
                              EN DIRECT
                            </span>

                            <span className="rounded-full bg-black/20 px-3 py-1 text-xs font-semibold backdrop-blur">
                              Room #{room.id.slice(0, 6)}
                            </span>
                          </div>

                          <div>
                            <p className="line-clamp-2 text-lg font-semibold tracking-tight">
                              {room.name || "Live sans titre"}
                            </p>
                            <p className="mt-1 text-sm text-white/85">
                              Rejoins ce live et regarde la diffusion en direct.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4 p-5">
                        <div className="grid grid-cols-2 gap-3">
                          <InfoPill
                            icon={<Users className="h-4 w-4" />}
                            text={`${participants}/${maxParticipants} streamers`}
                          />
                          <InfoPill
                            icon={<Eye className="h-4 w-4" />}
                            text={`${viewers} spectateurs`}
                          />
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                            <span>Places restantes</span>
                            <span>{spotsLeft}</span>
                          </div>

                          <div className="h-2 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
                            <div
                              className="h-full rounded-full bg-orange-500 transition-all"
                              style={{
                                width:
                                  maxParticipants > 0
                                    ? `${(participants / maxParticipants) * 100}%`
                                    : "0%",
                              }}
                            />
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Link
                            href={`/watch/${rid}`}
                            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-black dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
                          >
                            Regarder
                            <ArrowRight className="h-4 w-4" />
                          </Link>

                          {spotsLeft > 0 ? (
                            <Link
                              href={`/broadcast/${rid}?mode=join`}
                              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2.5 text-sm font-semibold text-orange-700 transition hover:bg-orange-100 dark:border-orange-500/20 dark:bg-orange-500/10 dark:text-orange-200 dark:hover:bg-orange-500/15"
                            >
                              Rejoindre ({spotsLeft})
                            </Link>
                          ) : (
                            <div className="inline-flex flex-1 items-center justify-center rounded-2xl border border-black/8 bg-black/[0.04] px-4 py-2.5 text-sm font-semibold text-gray-500 dark:border-white/10 dark:bg-white/5 dark:text-white/35">
                              Complet
                            </div>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </section>
            </>
          )}
        </div>
      </div>

      <HomeFooter />
    </main>
  );
}