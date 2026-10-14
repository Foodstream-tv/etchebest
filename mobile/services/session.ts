/**
 * "The server just told us this session is no longer valid."
 *
 * Mirrors front-web/src/lib/session.ts: the HTTP client emits an event, a
 * single SessionGuard mounted in the root layout reacts (sign out, toast,
 * redirect to the login screen).
 */

export type SessionTerminationReason = 'banned' | 'revoked';

export type SessionTerminationDetail = {
  reason: SessionTerminationReason;
  banReason?: string;
  /** null / undefined => permanent ban */
  bannedUntil?: string | null;
};

/** Exact error string the backend uses for a banned account (login + auth middleware). */
export const BANNED_ERROR = 'your account is banned';

type Listener = (detail: SessionTerminationDetail) => void;

const listeners = new Set<Listener>();

export function onSessionTerminated(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitSessionTerminated(detail: SessionTerminationDetail): void {
  listeners.forEach((listener) => {
    try {
      listener(detail);
    } catch (error) {
      console.warn('session listener failed:', error);
    }
  });
}

type BanLocale = 'fr' | 'en';

function plural(count: number, locale: BanLocale, fr: string, en: string): string {
  const unit = locale === 'en' ? en : fr;
  return `${count} ${unit}${count > 1 ? 's' : ''}`;
}

function formatRemaining(until: Date, locale: BanLocale, now: number): string {
  const ms = until.getTime() - now;
  if (ms <= 0) return '';

  const totalMinutes = Math.ceil(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days) parts.push(plural(days, locale, 'jour', 'day'));
  if (hours) parts.push(plural(hours, locale, 'heure', 'hour'));
  if (minutes && !days) parts.push(plural(minutes, locale, 'minute', 'minute'));
  return parts.join(' ');
}

function formatUntil(until: Date, locale: BanLocale): string {
  return until.toLocaleString(locale === 'en' ? 'en-US' : 'fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Human readable explanation of a ban. `bannedUntil` null/undefined => permanent. */
export function formatBanMessage(
  bannedUntil?: string | null,
  locale: BanLocale = 'fr',
  now: number = Date.now()
): string {
  const until = bannedUntil ? new Date(bannedUntil) : null;
  const isTemporary = until !== null && !Number.isNaN(until.getTime());

  if (!isTemporary || until === null) {
    return locale === 'en'
      ? 'Your account has been permanently banned.'
      : 'Votre compte a été banni définitivement.';
  }

  const remaining = formatRemaining(until, locale, now);
  const untilLabel = formatUntil(until, locale);

  if (locale === 'en') {
    return remaining
      ? `Your account is temporarily banned. ${remaining} remaining before the ban is lifted (until ${untilLabel}).`
      : `Your account is temporarily banned until ${untilLabel}.`;
  }

  return remaining
    ? `Votre compte est temporairement banni. Il reste ${remaining} avant la levée du bannissement (jusqu'au ${untilLabel}).`
    : `Votre compte est temporairement banni jusqu'au ${untilLabel}.`;
}
