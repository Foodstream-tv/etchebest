/**
 * Calendar helpers for FoodStream scheduled lives.
 * Generates Google Calendar URLs and downloadable .ics files.
 */

type CalendarEventOptions = {
  title: string;
  description?: string;
  scheduledAt: string | Date;
  durationMinutes?: number;
  liveUrl: string;
};

function formatIsoForGCal(date: Date): string {
  return date.toISOString().replace(/-|:|\.\d+/g, "");
}

/**
 * Returns a direct URL to create this event in Google Calendar.
 */
export function getGoogleCalendarUrl({
  title,
  description = "",
  scheduledAt,
  durationMinutes = 60,
  liveUrl,
}: CalendarEventOptions): string {
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const fullDesc = description
    ? `${description}\n\nRejoindre le live : ${liveUrl}`
    : `Rejoindre le live sur FoodStream : ${liveUrl}`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `FoodStream : ${title}`,
    dates: `${formatIsoForGCal(start)}/${formatIsoForGCal(end)}`,
    details: fullDesc,
    location: liveUrl,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Triggers a browser download of a standard .ics calendar file.
 */
export function downloadIcsFile({
  title,
  description = "",
  scheduledAt,
  durationMinutes = 60,
  liveUrl,
}: CalendarEventOptions): void {
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);

  const startFormatted = formatIsoForGCal(start);
  const endFormatted = formatIsoForGCal(end);
  const nowFormatted = formatIsoForGCal(new Date());

  const escapeIcsText = (text: string) =>
    text
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");

  const cleanTitle = escapeIcsText(title);
  const fullDesc = escapeIcsText(
    description
      ? `${description}\n\nLien du live : ${liveUrl}`
      : `Rejoindre le live sur FoodStream : ${liveUrl}`
  );

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FoodStream//Live Streaming//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${start.getTime()}@foodstream.tv`,
    `DTSTAMP:${nowFormatted}`,
    `DTSTART:${startFormatted}`,
    `DTEND:${endFormatted}`,
    `SUMMARY:FoodStream : ${cleanTitle}`,
    `DESCRIPTION:${fullDesc}`,
    `URL:${liveUrl}`,
    `LOCATION:${liveUrl}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", `foodstream-${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
