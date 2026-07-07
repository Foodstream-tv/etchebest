// Central place for "the server just told us this session is no longer valid".
// apiFetch dispatches this event; SessionGuard (mounted in the root layout)
// reacts by signing the user out, showing a toast and redirecting to /signin.

export const SESSION_TERMINATED_EVENT = "fs:session-terminated";

export type SessionTerminationReason = "banned" | "revoked";

export type SessionTerminationDetail = {
  // "banned"  -> the account was banned (temporary or permanent)
  // "revoked" -> the token is no longer valid (user deleted, token expired…)
  reason: SessionTerminationReason;
  banReason?: string;
  // null / undefined => permanent ban
  bannedUntil?: string | null;
};

// The exact error string the backend uses for a banned account, both on
// /api/login and inside the auth middleware.
export const BANNED_ERROR = "your account is banned";

function formatRemaining(until: Date): string {
  const ms = until.getTime() - Date.now();
  if (ms <= 0) return "";

  const totalMinutes = Math.ceil(ms / 60_000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  const parts: string[] = [];
  if (days) parts.push(`${days} jour${days > 1 ? "s" : ""}`);
  if (hours) parts.push(`${hours} heure${hours > 1 ? "s" : ""}`);
  // Only bother with minutes for short (< 1 day) bans.
  if (minutes && !days) parts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`);

  return parts.join(" ");
}

function formatUntil(until: Date): string {
  return until.toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Human-readable French explanation of a ban, used both on the sign-in page
// and in the forced-logout toast. `bannedUntil` null/undefined => permanent.
export function formatBanMessage(bannedUntil?: string | null): string {
  const until = bannedUntil ? new Date(bannedUntil) : null;
  const isTemporary = until !== null && !Number.isNaN(until.getTime());

  if (!isTemporary) {
    return "Votre compte a été banni définitivement.";
  }

  const remaining = formatRemaining(until as Date);
  return remaining
    ? `Votre compte est temporairement banni. Il reste ${remaining} avant la levée du bannissement (jusqu'au ${formatUntil(
        until as Date
      )}).`
    : `Votre compte est temporairement banni jusqu'au ${formatUntil(
        until as Date
      )}.`;
}

export function dispatchSessionTerminated(detail: SessionTerminationDetail) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<SessionTerminationDetail>(SESSION_TERMINATED_EVENT, {
      detail,
    })
  );
}
