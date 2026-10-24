"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import AuthHeroImage from "@/components/auth/AuthHeroImage";
import AuthRoomAvatars from "@/components/auth/AuthRoomAvatars";
import { authDisplay } from "@/components/auth/authFont";
import { useI18n } from "@/i18n";
import { getLives, type LiveDTO } from "@/lib/lives";

// Real sessions only: nothing is shown when the API has no live or scheduled session.
function useAuthLives() {
  const [live, setLive] = useState<LiveDTO | null>(null);
  const [upcoming, setUpcoming] = useState<LiveDTO[]>([]);

  useEffect(() => {
    let cancelled = false;

    Promise.allSettled([
      getLives({ status: "live", limit: 1 }),
      getLives({ status: "scheduled", limit: 8 }),
    ]).then(([liveRes, scheduledRes]) => {
      if (cancelled) return;

      if (liveRes.status === "fulfilled") {
        setLive(liveRes.value.lives?.[0] ?? null);
      }

      if (scheduledRes.status === "fulfilled") {
        const now = Date.now();
        const next = (scheduledRes.value.lives ?? [])
          .filter((l) => l.scheduled_at && new Date(l.scheduled_at).getTime() >= now)
          .sort(
            (a, b) =>
              new Date(a.scheduled_at as string).getTime() -
              new Date(b.scheduled_at as string).getTime()
          )
          .slice(0, 4);
        setUpcoming(next);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { live, upcoming };
}

export default function AuthHero() {
  const { t, locale } = useI18n();
  const pathname = usePathname();
  const { live, upcoming } = useAuthLives();

  const featured = live ?? upcoming[0] ?? null;
  const isLive = Boolean(live);
  const formatDate = (iso?: string) => {
    if (!iso) return "";
    return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  };

  const overlay = featured ? (
    <Link
      href={`/watch/${encodeURIComponent(featured.room_id)}`}
      className="absolute bottom-4 left-4 right-4 z-10 flex max-w-md items-center gap-3 rounded-2xl bg-black/55 px-4 py-3 text-[#f5ede0] shadow-lg ring-1 ring-white/10 backdrop-blur-md transition hover:bg-black/65 sm:right-auto"
    >
      <div className="min-w-0">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em]">
          <span
            aria-hidden="true"
            className={`h-1.5 w-1.5 rounded-full ${isLive ? "bg-red-500" : "bg-[#f5ede0]/60"}`}
          />
          {isLive ? t("common.live") : t("authHero.live.next")}
        </span>
        <p className="mt-2 truncate text-base font-semibold leading-tight">
          {featured.title}
        </p>
        <p className="mt-0.5 truncate text-sm text-[#f5ede0]/75">
          {t("common.by", { name: featured.user?.username || "FoodStream" })}
          {!isLive && featured.scheduled_at ? ` · ${formatDate(featured.scheduled_at)}` : ""}
        </p>
      </div>
    </Link>
  ) : null;

  return (
    <>
      <p className="text-base font-semibold uppercase tracking-[0.28em] text-[#1f1711]/60 dark:text-[#f5ede0]/60">
        FOODSTREAM
      </p>

      <h1
        className={`${authDisplay.className} mt-4 max-w-4xl text-[3.5rem] font-semibold leading-[1.04] tracking-[-0.02em] text-[#1f1711] dark:text-[#f5ede0] xl:text-[4.25rem]`}
      >
        {t("authHero.title.line1")}
        <br />
        <span className="italic">{t("authHero.title.line2")}</span>
      </h1>

      <p className="mt-5 max-w-2xl text-xl leading-9 text-[#1f1711]/75 dark:text-[#f5ede0]/75">
        {t("authHero.subtitle")}
      </p>

      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Link
          href="/home"
          className="rounded-2xl bg-[#ff7a1a] px-7 py-4 text-lg font-semibold text-[#1a0f05] shadow-[0_10px_30px_rgba(255,122,26,0.25)] transition hover:bg-[#ff8d3a]"
        >
          {t("authHero.cta.discover")}
        </Link>

        {pathname !== "/signup" ? (
          <Link
            href="/signup"
            className="rounded-2xl border border-black/20 px-7 py-4 text-lg font-semibold text-[#1f1711] transition hover:bg-black/5 dark:border-white/25 dark:text-[#f5ede0] dark:hover:bg-white/10"
          >
            {t("authHero.cta.creator")}
          </Link>
        ) : null}
      </div>

      {/* Room preview: one band holding the live (left) and the two people cooking (right).
          Its bottom edge lines up with the bottom of the sign-in card. */}
      <div className="mt-8 flex min-h-0 flex-1 gap-3 rounded-[28px] border border-black/8 bg-[#e9d9c2]/60 p-3 dark:border-white/10 dark:bg-white/[0.05]">
        <AuthHeroImage photoSrc={featured?.thumbnail_url} overlay={overlay} />
        <AuthRoomAvatars
          chefLabel={featured?.user?.username || t("authHero.room.chef")}
          guestLabel={t("authHero.room.guest")}
        />
      </div>
    </>
  );
}
