import { act, renderHook, waitFor } from '@testing-library/react-native';
import { Vibration } from 'react-native';

import { useCookingProgress } from '../useCookingProgress';
import storage from '@/services/storage';
import { parseRecipe } from '@/utils/recipe';

jest.mock('@/services/storage', () => {
    const store = new Map<string, string>();
    const api = {
        getItem: jest.fn(async (key: string) => store.get(key) ?? null),
        setItem: jest.fn(async (key: string, value: string) => {
            store.set(key, value);
        }),
        removeItem: jest.fn(async (key: string) => {
            store.delete(key);
        }),
    };
    return { __esModule: true, default: { ...api, __store: store }, storage: api };
});
jest.mock('@/utils/haptics', () => ({ haptics: { tap: jest.fn(), success: jest.fn() } }));

const store = (storage as unknown as { __store: Map<string, string> }).__store;
const recipe = parseRecipe({
    ingredients: [{ name: 'Farine', qty: '200 g' }, { name: 'Sel', qty: '1 pincée' }, { name: 'Beurre', qty: '80 g' }],
    prepSteps: ['Tamiser', 'Pétrir'],
    platingSteps: ['Dresser'],
    cookingTimer: 90,
})!;

async function setup(roomId = 'room-1') {
    const hook = renderHook(() => useCookingProgress(roomId, recipe));
    await waitFor(() => expect(hook.result.current.ready).toBe(true));
    await act(async () => {}); // let the stored value (if any) be applied
    return hook;
}

beforeEach(() => {
    store.clear();
    jest.clearAllMocks();
    jest.useRealTimers();
});

describe('useCookingProgress', () => {
    it('starts empty on the ingredients phase with the timer at its full duration', async () => {
        const { result } = await setup();
        expect(result.current.checked).toEqual([]);
        expect(result.current.phase).toBe(0);
        expect(result.current.timer).toMatchObject({ left: 90, running: false, total: 90, done: false });
    });

    it('ticks and un-ticks ingredients, preparation and plating steps', async () => {
        const { result } = await setup();
        act(() => result.current.toggleIngredient(2));
        act(() => result.current.toggleIngredient(0));
        expect(result.current.checked).toEqual([0, 2]);
        act(() => result.current.toggleIngredient(2));
        expect(result.current.checked).toEqual([0]);

        act(() => result.current.togglePrep(1));
        act(() => result.current.togglePlating(0));
        expect(result.current.prepDone).toEqual([1]);
        expect(result.current.platingDone).toEqual([0]);
    });

    it('keeps the progress of each live separately and restores it after a reload', async () => {
        const first = await setup('room-1');
        act(() => first.result.current.toggleIngredient(1));
        act(() => first.result.current.setPhase(2));
        await waitFor(() => expect(store.get('cooking:v1:room-1')).toContain('"phase":2'));
        first.unmount();

        const again = await setup('room-1');
        expect(again.result.current.checked).toEqual([1]);
        expect(again.result.current.phase).toBe(2);

        const other = await setup('room-2');
        expect(other.result.current.checked).toEqual([]);
        expect(other.result.current.phase).toBe(0);
    });

    it('ignores saved indexes that no longer exist and survives corrupted storage', async () => {
        store.set('cooking:v1:room-1', JSON.stringify({ checked: [0, 99, -1, 'x'], prepDone: [7], phase: 9, remaining: 5000 }));
        const { result } = await setup('room-1');
        expect(result.current.checked).toEqual([0]);
        expect(result.current.prepDone).toEqual([]);
        expect(result.current.phase).toBe(0);
        expect(result.current.timer.left).toBe(90); // capped to the recipe's timer

        store.set('cooking:v1:room-3', '{not json');
        const broken = await setup('room-3');
        expect(broken.result.current.checked).toEqual([]);
    });

    it('has no state for a live without recipe', async () => {
        const { result } = renderHook(() => useCookingProgress('room-1', null));
        expect(result.current.ready).toBe(false);
        expect(result.current.timer.total).toBe(0);
    });

    describe('timer', () => {
        it('counts down from a deadline, can pause with what is left and reset', async () => {
            jest.useFakeTimers();
            const { result } = await setup();

            act(() => result.current.timer.start());
            expect(result.current.timer.running).toBe(true);
            await act(async () => {
                jest.advanceTimersByTime(30_000);
            });
            expect(result.current.timer.left).toBe(60);

            act(() => result.current.timer.pause());
            expect(result.current.timer.running).toBe(false);
            expect(result.current.timer.left).toBe(60);
            await act(async () => {
                jest.advanceTimersByTime(20_000);
            });
            expect(result.current.timer.left).toBe(60); // paused: nothing moves

            act(() => result.current.timer.start());
            await act(async () => {
                jest.advanceTimersByTime(10_000);
            });
            expect(result.current.timer.left).toBe(50); // resumed from the paused value

            act(() => result.current.timer.reset());
            expect(result.current.timer).toMatchObject({ left: 90, running: false });
        });

        it('rings once when it reaches zero', async () => {
            jest.useFakeTimers();
            const vibrate = jest.spyOn(Vibration, 'vibrate').mockImplementation(() => undefined);
            const { result } = await setup();

            act(() => result.current.timer.start());
            await act(async () => {
                jest.advanceTimersByTime(95_000);
            });

            expect(result.current.timer).toMatchObject({ left: 0, running: false, done: true });
            expect(vibrate).toHaveBeenCalledTimes(1);

            // starting again after it finished restarts from the full duration
            act(() => result.current.timer.start());
            expect(result.current.timer).toMatchObject({ left: 90, running: true, done: false });
        });

        it('keeps counting through a reload (it is a deadline, not a counter)', async () => {
            store.set('cooking:v1:room-1', JSON.stringify({ checked: [], prepDone: [], platingDone: [], phase: 2, remaining: 90, endsAt: Date.now() + 40_000 }));
            const { result } = await setup('room-1');
            expect(result.current.timer.running).toBe(true);
            expect(result.current.timer.left).toBeLessThanOrEqual(40);
            expect(result.current.timer.left).toBeGreaterThan(30);
        });
    });
});
