import type { LiveDTO } from "@/lib/lives";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** When a replay became available: the end of the live (older rows may not have one: the creation date). */
export function replayDate(replay: Pick<LiveDTO, "ended_at" | "created_at">): string {
  return replay.ended_at ?? replay.created_at;
}

/**
 * How long ago a replay was added: "il y a 2 h" / "2 hours ago", "hier" / "yesterday", then a plain
 * date once it is a week old (without the year while it is the current one). Empty when the date is
 * missing or unreadable, so a card simply shows no date rather than "Invalid Date".
 */
export function formatReplayDate(iso: string | undefined | null, locale: string, now: number = Date.now()): string {
  if (!iso) return "";
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "";

  const lang = locale === "en" ? "en" : "fr";
  const elapsed = Math.max(0, now - time); // a clock a little ahead is "just now", not "in 2 minutes"

  if (elapsed < 7 * DAY) {
    const rtf = new Intl.RelativeTimeFormat(lang, { numeric: "auto" });
    if (elapsed < MINUTE) return rtf.format(0, "second");
    if (elapsed < HOUR) return rtf.format(-Math.floor(elapsed / MINUTE), "minute");
    if (elapsed < DAY) return rtf.format(-Math.floor(elapsed / HOUR), "hour");
    return rtf.format(-Math.floor(elapsed / DAY), "day");
  }

  const sameYear = new Date(time).getFullYear() === new Date(now).getFullYear();
  return new Intl.DateTimeFormat(lang, {
    day: "numeric",
    month: "short",
    year: sameYear ? undefined : "numeric",
  }).format(time);
}

/** The full date and time, for the tooltip of the relative label. */
export function formatReplayDateLong(iso: string | undefined | null, locale: string): string {
  if (!iso) return "";
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "";
  return new Intl.DateTimeFormat(locale === "en" ? "en" : "fr", { dateStyle: "long", timeStyle: "short" }).format(time);
}
