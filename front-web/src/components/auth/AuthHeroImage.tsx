"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { useI18n } from "@/i18n";

// The framed visual of the auth pages.
//
// When a session is on air (or next in line) its own thumbnail fills the frame,
// so the picture is the real live. Without a thumbnail, the placeholder
// illustration below is shown instead. To use a still photo in that case (a chef
// plating a vibrant dish), drop it in public/images, point FALLBACK.src to it and
// set fit to "cover": nothing else needs to change.
const FALLBACK = {
  src: "/images/auth-signin.png",
  signupSrc: "/images/auth-signup.png",
  fit: "contain" as "contain" | "cover",
};

type AuthHeroImageProps = Readonly<{
  /** Thumbnail of the featured live session, when it has one. */
  photoSrc?: string;
  /** Live session card laid over the bottom-left corner of the picture. */
  overlay?: ReactNode;
}>;

export default function AuthHeroImage({ photoSrc, overlay }: AuthHeroImageProps) {
  const pathname = usePathname();
  const { t } = useI18n();
  // The thumbnail comes from the API (any host, any size). An <img> in the page keeps the
  // browser's loading indicator spinning until it has arrived, so it is fetched off-page,
  // once the page itself has finished loading, and only shown (fade in) when ready.
  const [readySrc, setReadySrc] = useState<string | null>(null);

  useEffect(() => {
    // A previous thumbnail is never shown for a new one: showPhoto compares readySrc to photoSrc.
    if (!photoSrc) return;

    let cancelled = false;
    let probe: HTMLImageElement | null = null;

    const start = () => {
      if (cancelled) return;
      probe = new window.Image();
      probe.decoding = "async";
      probe.onload = () => {
        if (!cancelled) setReadySrc(photoSrc);
      };
      probe.src = photoSrc;
    };

    if (document.readyState === "complete") {
      start();
    } else {
      window.addEventListener("load", start, { once: true });
    }

    return () => {
      cancelled = true;
      window.removeEventListener("load", start);
      if (probe) {
        probe.onload = null;
        probe.src = "";
      }
    };
  }, [photoSrc]);

  const showPhoto = Boolean(photoSrc) && readySrc === photoSrc;
  const fallbackSrc = pathname === "/signup" ? FALLBACK.signupSrc : FALLBACK.src;
  const cover = FALLBACK.fit === "cover";

  return (
    // Takes the room left under the text; the picture fills it, whatever the screen height.
    <figure className="relative m-0 min-h-[236px] min-w-0 flex-1 select-none overflow-hidden rounded-2xl bg-[radial-gradient(120%_100%_at_70%_15%,#f6e8d4_0%,#ecd9bf_100%)] dark:border-white/10 dark:bg-[radial-gradient(120%_100%_at_70%_15%,#3d2616_0%,#1b120c_72%)]">
      {showPhoto ? (
        // Plain <img>: thumbnails come from the API, not from a known image host.
        // The browser already has it cached (see the probe above), so it shows at once.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoSrc}
          alt={t("authHero.photoAlt")}
          decoding="async"
          className="fs-fade-in absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <div className={cover ? "absolute inset-0" : "absolute inset-x-6 inset-y-5"}>
          <Image
            key={fallbackSrc}
            src={fallbackSrc}
            alt={t("authHero.photoAlt")}
            fill
            priority
            sizes="(min-width: 1024px) 560px, 0px"
            className={`${cover ? "object-cover" : "object-contain"} object-center`}
          />
        </div>
      )}

      {/* Keeps the overlay readable on any photo. */}
      {showPhoto && overlay ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 to-transparent"
        />
      ) : null}

      {overlay}
    </figure>
  );
}
