import { fireEvent } from '@testing-library/react-native';
import React from 'react';

import { makeLive } from '@/test-utils/fixtures';
import { renderWithProviders } from '@/test-utils/render';

import LiveCard, { formatScheduledDate } from '../LiveCard';

describe('LiveCard', () => {
    it('shows the LIVE badge, viewers and host for a live', () => {
        const live = makeLive({ title: 'Ramen Tonkotsu', status: 'live', current_viewers: 42, user: { id: 'u', username: 'chefmo' }, dish_name: 'Ramen' });
        const { getByText } = renderWithProviders(<LiveCard live={live} onPress={jest.fn()} />);

        expect(getByText('EN DIRECT')).toBeTruthy();
        expect(getByText('42')).toBeTruthy();
        expect(getByText('chefmo')).toBeTruthy();
        expect(getByText('Ramen Tonkotsu')).toBeTruthy();
        expect(getByText('Ramen')).toBeTruthy();
    });

    it('shows the scheduled badge and date for a scheduled live, without viewers', () => {
        const live = makeLive({ status: 'scheduled', scheduled_at: '2030-05-04T18:30:00Z', current_viewers: 7 });
        const { getByText, queryByText } = renderWithProviders(<LiveCard live={live} onPress={jest.fn()} />);

        expect(getByText('PLANIFIÉ')).toBeTruthy();
        expect(queryByText('7')).toBeNull();
    });

    it('shows the replay badge for an ended live', () => {
        const { getByText } = renderWithProviders(<LiveCard live={makeLive({ status: 'ended' })} onPress={jest.fn()} />);
        expect(getByText('REDIFFUSION')).toBeTruthy();
    });

    it('falls back to a default title and host name', () => {
        const { getByText } = renderWithProviders(<LiveCard live={makeLive({ title: '', user: undefined })} onPress={jest.fn()} />);
        expect(getByText('Live sans titre')).toBeTruthy();
        expect(getByText('Foodstream')).toBeTruthy();
    });

    it('calls onPress with the live and is accessible as a button', () => {
        const live = makeLive({ title: 'Tarte', user: { id: 'u', username: 'anna' } });
        const onPress = jest.fn();
        const { getByRole } = renderWithProviders(<LiveCard live={live} onPress={onPress} />);

        const button = getByRole('button', { name: 'Regarder Tarte par anna' });
        fireEvent.press(button);
        expect(onPress).toHaveBeenCalledWith(live);
    });

    describe('formatScheduledDate', () => {
        it('returns the fallback for missing or invalid dates', () => {
            expect(formatScheduledDate(undefined, 'fr', 'Date à venir')).toBe('Date à venir');
            expect(formatScheduledDate('garbage', 'en', 'Soon')).toBe('Soon');
        });

        it('formats valid dates per locale', () => {
            expect(formatScheduledDate('2030-05-04T18:30:00Z', 'fr', '-')).not.toBe('-');
            expect(formatScheduledDate('2030-05-04T18:30:00Z', 'en', '-')).toMatch(/May/);
        });
    });
});

describe('LiveCard thumbnail', () => {
    it('resolves a relative upload path against the API host', () => {
        const live = makeLive({ thumbnail_url: '/api/uploads/thumb.jpg' });
        const { UNSAFE_getByType } = renderWithProviders(<LiveCard live={live} onPress={jest.fn()} />);
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Image } = require('react-native');
        expect(UNSAFE_getByType(Image).props.source.uri).toMatch(/^https?:\/\/.+\/api\/uploads\/thumb\.jpg$/);
    });

    it('falls back to the placeholder for an unsafe thumbnail url', () => {
        const live = makeLive({ thumbnail_url: 'javascript:alert(1)' });
        const { UNSAFE_queryByType } = renderWithProviders(<LiveCard live={live} onPress={jest.fn()} />);
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Image } = require('react-native');
        expect(UNSAFE_queryByType(Image)).toBeNull();
    });
});
