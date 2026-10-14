/**
 * Calendar + deep-link helpers for scheduled lives (port of front-web/src/lib/calendar.ts).
 * Only the Google Calendar URL is needed on mobile: it is opened with `Linking`.
 */

/** Public web origin, used for the calendar event location and for sharing. */
export const WEB_BASE_URL = 'https://foodstream.tv';

/** Public web URL of a live (`/watch/[roomId]`). */
export function getLiveWebUrl(roomId: string): string {
    return `${WEB_BASE_URL}/watch/${encodeURIComponent(roomId)}`;
}

export type CalendarEventOptions = {
    title: string;
    description?: string;
    scheduledAt: string | Date;
    durationMinutes?: number;
    liveUrl: string;
    /** Footer appended to the description (already translated, may contain the live URL). */
    joinText?: string;
};

/** `20260101T180000Z` format expected by Google Calendar. */
export function formatIsoForGCal(date: Date): string {
    return date.toISOString().replaceAll(/-|:|\.\d+/g, '');
}

/**
 * Direct URL that pre-fills a Google Calendar event for the live.
 * Returns null when `scheduledAt` is missing or not a valid date (never throws on bad input).
 */
export function getGoogleCalendarUrl({
    title,
    description = '',
    scheduledAt,
    durationMinutes = 60,
    liveUrl,
    joinText,
}: CalendarEventOptions): string | null {
    const start = new Date(scheduledAt);
    if (Number.isNaN(start.getTime())) return null;
    const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

    const footer = joinText ?? liveUrl;
    const details = description ? `${description}\n\n${footer}` : footer;

    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: title,
        dates: `${formatIsoForGCal(start)}/${formatIsoForGCal(end)}`,
        details,
        location: liveUrl,
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
