import { buildScheduledAt, defaultSchedule, isFutureSchedule, parseSchedule, toDateString, toTimeString } from '../studioSchedule';

describe('studioSchedule', () => {
    it('formats local date and time like the web inputs', () => {
        const d = new Date(2026, 0, 5, 9, 7);
        expect(toDateString(d)).toBe('2026-01-05');
        expect(toTimeString(d)).toBe('09:07');
    });

    it('defaults to the next full hour', () => {
        expect(defaultSchedule(new Date(2026, 9, 15, 14, 20))).toEqual({ date: '2026-10-15', time: '15:00' });
        expect(defaultSchedule(new Date(2026, 9, 15, 23, 59))).toEqual({ date: '2026-10-16', time: '00:00' });
    });

    it('rejects values that are not a real date', () => {
        expect(parseSchedule('2026-02-30', '10:00')).toBeNull();
        expect(parseSchedule('2026-02-10', '25:00')).toBeNull();
        expect(parseSchedule('', '10:00')).toBeNull();
        expect(buildScheduledAt('nope', '10:00')).toBeNull();
    });

    it('builds an ISO instant from local values', () => {
        const iso = buildScheduledAt('2026-10-15', '14:30');
        expect(iso).toBe(new Date(2026, 9, 15, 14, 30).toISOString());
    });

    it('requires the slot to be in the future (one minute margin)', () => {
        const now = new Date(2026, 9, 15, 14, 0, 0);
        expect(isFutureSchedule('2026-10-15', '14:00', now)).toBe(false);
        expect(isFutureSchedule('2026-10-15', '14:01', now)).toBe(false); // exactly 60 s ahead
        expect(isFutureSchedule('2026-10-15', '14:02', now)).toBe(true);
        expect(isFutureSchedule('2026-10-14', '23:00', now)).toBe(false);
    });
});
