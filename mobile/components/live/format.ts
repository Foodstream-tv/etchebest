/** Same formatting as the web watch page (`formatScheduledDate`). */
export function formatScheduledDate(value: string | null | undefined, locale: string, fallback: string): string {
    if (!value) return fallback;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;
    return new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'fr-FR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

export const pluralSuffix = (count: number): string => (count > 1 ? 's' : '');
