/**
 * The recipe a host typed in the Studio, as stored in the live description after the recipe marker
 * (see `parseLiveDescription`). The description comes from the API and can be anything: it is validated
 * and bounded here, never trusted.
 */
export type CookingIngredient = { name: string; qty: string };
export type CookingTechnique = { name: string; desc: string };

export type CookingRecipe = {
    ingredients: CookingIngredient[];
    /** Preparation steps ("Name: description" splits into a title and a text). */
    techniques: CookingTechnique[];
    /** Seconds; 0 when the host set no cooking timer. */
    timerSeconds: number;
    plating: string[];
    utensils: string[];
    prepTimeMins: number;
    restTimeMins: number;
    sourceUrl?: string;
    sourceName?: string;
};

const MAX_ITEMS = 60;
const MAX_TEXT = 400;
const MAX_TIMER_SECONDS = 24 * 3600;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function text(value: unknown, max = MAX_TEXT): string {
    return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

function strings(value: unknown): string[] {
    if (!Array.isArray(value)) return [];
    return value.map((item) => text(item)).filter(Boolean).slice(0, MAX_ITEMS);
}

function minutes(value: unknown): number {
    const n = typeof value === 'number' ? value : Number.NaN;
    return Number.isFinite(n) && n > 0 ? Math.min(Math.round(n), 24 * 60) : 0;
}

function technique(step: string): CookingTechnique {
    const at = step.indexOf(':');
    if (at > 0 && step.slice(at + 1).trim()) return { name: step.slice(0, at).trim(), desc: step.slice(at + 1).trim() };
    return { name: '', desc: step };
}

/** Returns the recipe when there is something to follow, null otherwise (no recipe or not usable). */
export function parseRecipe(raw: unknown): CookingRecipe | null {
    if (!isRecord(raw)) return null;

    const ingredients: CookingIngredient[] = (Array.isArray(raw.ingredients) ? raw.ingredients : [])
        .map((item) => (isRecord(item) ? { name: text(item.name, 120), qty: text(item.qty, 60) } : null))
        .filter((item): item is CookingIngredient => item !== null && item.name !== '')
        .slice(0, MAX_ITEMS);

    const timerRaw = typeof raw.cookingTimer === 'number' && Number.isFinite(raw.cookingTimer) ? raw.cookingTimer : 0;
    const timerSeconds = Math.min(Math.max(Math.round(timerRaw), 0), MAX_TIMER_SECONDS);

    const sourceUrl = text(raw.sourceUrl, 500);
    const recipe: CookingRecipe = {
        ingredients,
        techniques: strings(raw.prepSteps).map(technique),
        timerSeconds,
        plating: strings(raw.platingSteps),
        utensils: strings(raw.utensils),
        prepTimeMins: minutes(raw.prepTimeMins),
        restTimeMins: minutes(raw.restTimeMins),
        // Only a real http(s) link can be shown as a source.
        sourceUrl: /^https?:\/\//i.test(sourceUrl) ? sourceUrl : undefined,
        sourceName: text(raw.sourceName, 80) || undefined,
    };

    const hasContent =
        recipe.ingredients.length > 0 || recipe.techniques.length > 0 || recipe.plating.length > 0 || recipe.utensils.length > 0 || recipe.timerSeconds > 0;
    return hasContent ? recipe : null;
}

/** "m:ss" for a number of seconds (the web assistant's format). */
export function formatTimer(totalSeconds: number): string {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const m = Math.floor(safe / 60);
    const s = safe % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
}
