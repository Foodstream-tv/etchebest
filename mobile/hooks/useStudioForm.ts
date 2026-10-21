import { useCallback, useMemo, useRef, useState } from 'react';

import { type PickedImage } from '@/services/studio';
import { appendHint, EMPTY_RECIPE, type RecipeForm } from '@/utils/studioRecipe';
import { defaultSchedule, isFutureSchedule } from '@/utils/studioSchedule';
import { LIVE_TAGS_MAX, validateTitle, type TitleError } from '@/utils/webrtcParams';

export type StudioStep = 1 | 2 | 3;
/** Stored French, like the web Studio (the backend receives it as-is). */
export type Level = 'Débutant' | 'Intermédiaire' | 'Avancé';
export const LEVELS: readonly Level[] = ['Débutant', 'Intermédiaire', 'Avancé'];

export const DURATION_MIN = 10;
export const DURATION_MAX = 180;
export const DURATION_STEP = 5;
export const DURATION_PRESETS = [30, 45, 60, 90] as const;
const TAG_MAX_LENGTH = 40;

export type StudioForm = {
    title: string;
    description: string;
    tags: string[];
    level: Level;
    recipe: RecipeForm;
    date: string;
    time: string;
    durationMinutes: number;
    /** Picture chosen on the device (uploaded on submit). Mutually exclusive with `imageUrl`. */
    image: PickedImage | null;
    imageUrl: string;
    /** Keep a replay once the live is over. Off: the recording is deleted at the end. */
    recordReplay: boolean;
};

function initialForm(now?: Date): StudioForm {
    const { date, time } = defaultSchedule(now);
    return {
        title: '',
        description: '',
        tags: [],
        level: 'Débutant',
        recipe: EMPTY_RECIPE,
        date,
        time,
        durationMinutes: 60,
        image: null,
        imageUrl: '',
        recordReplay: true,
    };
}

const clampDuration = (value: number) => Math.min(DURATION_MAX, Math.max(DURATION_MIN, Math.round(value / DURATION_STEP) * DURATION_STEP));

export type TagResult = 'added' | 'removed' | 'limit' | 'duplicate' | 'empty';

/** State and edit actions of the 3-step Studio wizard (no I/O: the screen submits it). */
export function useStudioForm() {
    const [step, setStep] = useState<StudioStep>(1);
    const [form, setForm] = useState<StudioForm>(() => initialForm());

    const update = useCallback((patch: Partial<StudioForm>) => setForm((prev) => ({ ...prev, ...patch })), []);
    const updateRecipe = useCallback(
        (patch: Partial<RecipeForm>) => setForm((prev) => ({ ...prev, recipe: { ...prev.recipe, ...patch } })),
        []
    );

    // Tag actions answer synchronously ("limit reached"), so they read the latest form from a ref.
    const formRef = useRef(form);
    formRef.current = form;

    /** Toggles a suggested tag; refuses a new one past the limit. */
    const toggleTag = useCallback((tag: string): TagResult => {
        const { tags } = formRef.current;
        if (tags.includes(tag)) {
            setForm((prev) => ({ ...prev, tags: prev.tags.filter((item) => item !== tag) }));
            return 'removed';
        }
        if (tags.length >= LIVE_TAGS_MAX) return 'limit';
        setForm((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
        return 'added';
    }, []);

    /** Adds a free tag (trimmed, case-insensitive duplicates ignored, bounded like the backend route param). */
    const addCustomTag = useCallback((raw: string): TagResult => {
        const tag = raw.replace(/\s+/g, ' ').trim().slice(0, TAG_MAX_LENGTH);
        if (!tag) return 'empty';
        const { tags } = formRef.current;
        if (tags.some((item) => item.toLowerCase() === tag.toLowerCase())) return 'duplicate';
        if (tags.length >= LIVE_TAGS_MAX) return 'limit';
        setForm((prev) => ({ ...prev, tags: [...prev.tags, tag] }));
        return 'added';
    }, []);

    const addHint = useCallback((hint: string) => setForm((prev) => ({ ...prev, description: appendHint(prev.description, hint) })), []);

    const setDuration = useCallback((minutes: number) => update({ durationMinutes: clampDuration(minutes) }), [update]);

    const reset = useCallback(() => {
        setForm(initialForm());
        setStep(1);
    }, []);

    const titleError: TitleError = useMemo(() => validateTitle(form.title), [form.title]);
    const hasValidSchedule = isFutureSchedule(form.date, form.time);

    return {
        step,
        setStep,
        form,
        update,
        updateRecipe,
        toggleTag,
        addCustomTag,
        addHint,
        setDuration,
        reset,
        titleError,
        canStart: titleError === null,
        hasValidSchedule,
    };
}
