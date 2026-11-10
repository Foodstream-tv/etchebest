/** Date/time helpers of the Studio schedule step (values use the web's "YYYY-MM-DD" / "HH:mm" formats). */

const pad = (value: number) => String(value).padStart(2, '0');

export function toDateString(date: Date): string {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toTimeString(date: Date): string {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A scheduled live must start more than this far ahead (margin for the request). */
export const SCHEDULE_MARGIN_MS = 60_000;

/** The default slot leaves at least this long to fill in the Studio form before it is refused. */
const DEFAULT_SLOT_LEAD_MS = 5 * 60_000;

/**
 * Default slot of a new live: the next full hour (the web defaults to "now", which is already past).
 * Too close to it (13:56 and later) the hour after is used: 14:00 would be refused before the form is done.
 */
export function defaultSchedule(now: Date = new Date()): { date: string; time: string } {
    const next = new Date(now);
    next.setMinutes(0, 0, 0);
    next.setHours(next.getHours() + 1);
    if (next.getTime() - now.getTime() < DEFAULT_SLOT_LEAD_MS) {
        next.setHours(next.getHours() + 1);
    }
    return { date: toDateString(next), time: toTimeString(next) };
}

/** Parses the form values into a Date (local time), or null when they are not a real date. */
export function parseSchedule(date: string, time: string): Date | null {
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
    if (!dateMatch || !timeMatch) return null;
    const [, y, mo, d] = dateMatch.map(Number);
    const [, h, mi] = timeMatch.map(Number);
    const parsed = new Date(y, mo - 1, d, h, mi, 0, 0);
    const exact =
        parsed.getFullYear() === y && parsed.getMonth() === mo - 1 && parsed.getDate() === d && parsed.getHours() === h && parsed.getMinutes() === mi;
    return exact ? parsed : null;
}

/** RFC 3339 instant expected by the backend, or null. */
export function buildScheduledAt(date: string, time: string): string | null {
    return parseSchedule(date, time)?.toISOString() ?? null;
}

/** A scheduled live must start in the future (SCHEDULE_MARGIN_MS of margin for the request). */
export function isFutureSchedule(date: string, time: string, now: Date = new Date()): boolean {
    const parsed = parseSchedule(date, time);
    return parsed !== null && parsed.getTime() > now.getTime() + SCHEDULE_MARGIN_MS;
}
