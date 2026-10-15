import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Vibration } from 'react-native';

import storage from '@/services/storage';
import { haptics } from '@/utils/haptics';
import { type CookingRecipe } from '@/utils/recipe';

export type CookingPhase = 0 | 1 | 2 | 3; // ingredients, preparation, cooking, plating

type Saved = {
    checked: number[];
    prepDone: number[];
    platingDone: number[];
    phase: CookingPhase;
    /** Seconds left while the timer is idle or paused. */
    remaining: number;
    /** Epoch ms at which a running timer ends. */
    endsAt: number | null;
};

const storageKey = (roomId: string) => `cooking:v1:${roomId}`;

function toggled(list: readonly number[], index: number): number[] {
    return list.includes(index) ? list.filter((i) => i !== index) : [...list, index].sort((a, b) => a - b);
}

/** Keep only indexes that still exist (the recipe may have changed since it was saved). */
function within(list: unknown, max: number): number[] {
    if (!Array.isArray(list)) return [];
    return list.filter((i): i is number => Number.isInteger(i) && i >= 0 && i < max);
}

function initial(recipe: CookingRecipe): Saved {
    return { checked: [], prepDone: [], platingDone: [], phase: 0, remaining: recipe.timerSeconds, endsAt: null };
}

function restore(raw: string | null, recipe: CookingRecipe): Saved {
    const base = initial(recipe);
    if (!raw) return base;
    try {
        const parsed = JSON.parse(raw) as Partial<Saved>;
        const phase = parsed.phase === 1 || parsed.phase === 2 || parsed.phase === 3 ? parsed.phase : 0;
        const endsAt = typeof parsed.endsAt === 'number' && Number.isFinite(parsed.endsAt) ? parsed.endsAt : null;
        const remaining =
            typeof parsed.remaining === 'number' && parsed.remaining >= 0 ? Math.min(parsed.remaining, recipe.timerSeconds) : recipe.timerSeconds;
        return {
            checked: within(parsed.checked, recipe.ingredients.length),
            prepDone: within(parsed.prepDone, recipe.techniques.length),
            platingDone: within(parsed.platingDone, recipe.plating.length),
            phase,
            remaining,
            endsAt: recipe.timerSeconds > 0 ? endsAt : null,
        };
    } catch {
        return base;
    }
}

/**
 * What a cook has done so far on one live's recipe: ticked ingredients and steps, the current phase and the
 * cooking timer. Saved per live so a reload or a call does not lose it; the timer is a deadline, so it keeps
 * counting while the app is in the background.
 */
export function useCookingProgress(roomId: string, recipe: CookingRecipe | null) {
    const [state, setState] = useState<Saved | null>(null);
    const [now, setNow] = useState(() => Date.now());
    const loadedFor = useRef<string | null>(null);
    const announced = useRef(false);

    // Load once per live.
    useEffect(() => {
        if (!recipe) {
            setState(null);
            return;
        }
        let cancelled = false;
        loadedFor.current = null;
        setState(initial(recipe));
        void storage.getItem(storageKey(roomId)).then((raw) => {
            if (cancelled) return;
            setState(restore(raw, recipe));
            loadedFor.current = roomId;
        });
        return () => {
            cancelled = true;
        };
    }, [roomId, recipe]);

    // Save after the saved value was loaded (never overwrite it with the blank state).
    useEffect(() => {
        if (!state || loadedFor.current !== roomId) return;
        void storage.setItem(storageKey(roomId), JSON.stringify(state));
    }, [state, roomId]);

    const running = state?.endsAt != null;

    useEffect(() => {
        if (!running) return;
        setNow(Date.now());
        const id = setInterval(() => setNow(Date.now()), 500);
        return () => clearInterval(id);
    }, [running]);

    const timerLeft = !state ? 0 : state.endsAt != null ? Math.max(0, Math.ceil((state.endsAt - now) / 1000)) : state.remaining;

    // Deadline reached: stop, and tell the cook once.
    useEffect(() => {
        if (!state || state.endsAt == null || timerLeft > 0) return;
        setState((prev) => (prev && prev.endsAt != null ? { ...prev, endsAt: null, remaining: 0 } : prev));
        if (!announced.current) {
            announced.current = true;
            Vibration.vibrate([0, 400, 200, 400, 200, 400]);
            haptics.success();
        }
    }, [state, timerLeft]);

    const patch = useCallback((fn: (prev: Saved) => Saved) => setState((prev) => (prev ? fn(prev) : prev)), []);

    const timer = useMemo(
        () => ({
            left: timerLeft,
            running,
            total: recipe?.timerSeconds ?? 0,
            done: Boolean(recipe && recipe.timerSeconds > 0 && timerLeft === 0 && !running),
            start: () => {
                announced.current = false;
                patch((prev) => {
                    const from = prev.remaining > 0 ? prev.remaining : recipe?.timerSeconds ?? 0;
                    return from > 0 ? { ...prev, remaining: from, endsAt: Date.now() + from * 1000 } : prev;
                });
            },
            pause: () => patch((prev) => (prev.endsAt == null ? prev : { ...prev, remaining: Math.max(0, Math.ceil((prev.endsAt - Date.now()) / 1000)), endsAt: null })),
            reset: () => {
                announced.current = false;
                patch((prev) => ({ ...prev, remaining: recipe?.timerSeconds ?? 0, endsAt: null }));
            },
        }),
        [patch, recipe, running, timerLeft]
    );

    return {
        ready: state !== null,
        checked: state?.checked ?? [],
        prepDone: state?.prepDone ?? [],
        platingDone: state?.platingDone ?? [],
        phase: (state?.phase ?? 0) as CookingPhase,
        timer,
        toggleIngredient: (index: number) => patch((prev) => ({ ...prev, checked: toggled(prev.checked, index) })),
        togglePrep: (index: number) => patch((prev) => ({ ...prev, prepDone: toggled(prev.prepDone, index) })),
        togglePlating: (index: number) => patch((prev) => ({ ...prev, platingDone: toggled(prev.platingDone, index) })),
        setPhase: (phase: CookingPhase) => patch((prev) => ({ ...prev, phase })),
    };
}

export type CookingProgress = ReturnType<typeof useCookingProgress>;
