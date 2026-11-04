import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { resetReducedMotionForTests, useReducedMotion } from '../motion';

describe('useReducedMotion', () => {
    let handler: ((value: boolean) => void) | undefined;
    const remove = jest.fn();

    beforeEach(() => {
        resetReducedMotionForTests();
        handler = undefined;
        remove.mockClear();
        jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation(((_event: string, cb: (value: boolean) => void) => {
            handler = cb;
            return { remove };
        }) as never);
    });

    afterEach(() => jest.restoreAllMocks());

    it('follows the system setting while the screen is open', () => {
        const { result } = renderHook(() => useReducedMotion());
        expect(result.current).toBe(false);
        act(() => handler?.(true));
        expect(result.current).toBe(true);
        act(() => handler?.(false));
        expect(result.current).toBe(false);
    });

    it('is one shared answer: a component mounted later already knows it, without its own probe', () => {
        const first = renderHook(() => useReducedMotion());
        act(() => handler?.(true));
        const second = renderHook(() => useReducedMotion());
        expect(second.result.current).toBe(true); // no first animated frame for a user who asked for less motion
        expect(first.result.current).toBe(true);
    });
});
