/**
 * Recipe part of the Studio form. The web client embeds it in the live description, after a marker
 * (`RECIPE_MARKER`), as JSON: the watch pages (web and mobile) read it back with `parseLiveDescription`.
 * Keep this shape identical to front-web `studio/page.tsx`.
 */
import { RECIPE_MARKER } from '@/services/lives';

export const DESCRIPTION_MAX = 500;
/** Free-text quick suggestions of the description step (content, sent as-is). */
export const DESCRIPTION_HINTS = ['Recette maison', 'Pas à pas', 'Débutant friendly', 'Matériel simple'] as const;

export const COOK_TIMER_MAX_MINUTES = 180;
export const MINUTES_MAX = 999;
/** Backend default for an ingredient without quantity (same as the web import). */
export const DEFAULT_QUANTITY = 'Au goût';

export type Ingredient = { name: string; qty: string };

export type RecipeForm = {
    ingredients: Ingredient[];
    prepSteps: string[];
    platingSteps: string[];
    utensils: string[];
    prepTimeMins: number;
    restTimeMins: number;
    /** Minutes in the form, sent as seconds (`cookingTimer`). */
    cookTimeMins: number;
    sourceUrl: string;
    sourceName: string;
};

export const EMPTY_RECIPE: RecipeForm = {
    ingredients: [],
    prepSteps: [],
    platingSteps: [],
    utensils: [],
    prepTimeMins: 0,
    restTimeMins: 0,
    cookTimeMins: 0,
    sourceUrl: '',
    sourceName: '',
};

/** Digits only, bounded: what a "minutes" field accepts. Empty input is 0. */
export function parseMinutes(raw: string, max = MINUTES_MAX): number {
    const digits = raw.replace(/[^0-9]/g, '');
    if (!digits) return 0;
    return Math.min(Number.parseInt(digits, 10), max);
}

/**
 * Units recognised after the amount, longest first so "kg" is not read as "g" and "gousses" not as "g"
 * (the web import tries "g" first and turns "2 gousses d'ail" into "2 g" + "ousses d'ail").
 */
const UNITS = ['c\\.à\\sc\\.', 'c\\.à\\ss\\.', 'cuillères?', 'sachets?', 'pincées?', 'gousses?', 'bottes?', 'brins?', 'tasses?', 'kg', 'ml', 'cl', 'g', 'l'];
const INGREDIENT_PATTERN = new RegExp(`^([\\d/\\s.,¼½¾-]+(?:(?:${UNITS.join('|')})(?=\\s|$))?)(?:\\s+(?:de\\s+|d'))?\\s*(.*)$`, 'i');

/** Splits "200 g de farine" into { qty: "200 g", name: "farine" }; "Au goût" when there is no amount. */
export function parseIngredient(raw: string): Ingredient {
    const text = raw.trim();
    const match = INGREDIENT_PATTERN.exec(text);
    if (match && match[2].trim()) return { name: match[2].trim(), qty: match[1].trim() };
    return { name: text, qty: DEFAULT_QUANTITY };
}

/** True when the host hides a Marmiton / external source behind the live (citation right). */
export function sourceNameFor(url: string): string {
    try {
        const host = new URL(url).hostname.toLowerCase();
        return host === 'marmiton.org' || host.endsWith('.marmiton.org') ? 'Marmiton' : '';
    } catch {
        return '';
    }
}

export function hasRecipeContent(recipe: RecipeForm): boolean {
    return (
        recipe.ingredients.length > 0 ||
        recipe.prepSteps.length > 0 ||
        recipe.platingSteps.length > 0 ||
        recipe.utensils.length > 0 ||
        recipe.prepTimeMins > 0 ||
        recipe.restTimeMins > 0 ||
        recipe.cookTimeMins > 0
    );
}

/** Description sent to the backend: free text, plus the recipe JSON after the marker when there is one. */
export function buildDescription(description: string, recipe: RecipeForm): string {
    const text = description.trim();
    if (!hasRecipeContent(recipe)) return text;

    const sourceUrl = recipe.sourceUrl.trim();
    const data = {
        ingredients: recipe.ingredients,
        prepSteps: recipe.prepSteps,
        cookingTimer: recipe.cookTimeMins * 60,
        platingSteps: recipe.platingSteps,
        utensils: recipe.utensils,
        prepTimeMins: recipe.prepTimeMins,
        restTimeMins: recipe.restTimeMins,
        sourceUrl: sourceUrl || undefined,
        sourceName: recipe.sourceName.trim() || (sourceUrl ? 'Source originale' : undefined),
    };
    return `${text}\n\n${RECIPE_MARKER}\n${JSON.stringify(data)}`;
}

/** Length the quick suggestion would add: "\n• hint" after some text, "• hint" on an empty field. */
function hintAddition(description: string, hint: string): string {
    return description.trim() ? `\n• ${hint}` : `• ${hint}`;
}

export function canAppendHint(description: string, hint: string): boolean {
    if (description.includes(hint)) return false;
    return description.length + hintAddition(description, hint).length <= DESCRIPTION_MAX;
}

export function appendHint(description: string, hint: string): string {
    return canAppendHint(description, hint) ? `${description}${hintAddition(description, hint)}` : description;
}

/** Maps a Marmiton scrape response (snake_case, best effort) to the recipe form. */
export type MarmitonRecipe = {
    title?: string;
    description?: string;
    ingredients?: string[];
    steps?: string[];
    prep_time_mins?: number;
    cook_time_mins?: number;
    rest_time_mins?: number;
    utensils?: string[];
};

export function recipeFromMarmiton(data: MarmitonRecipe, sourceUrl: string): Partial<RecipeForm> {
    const patch: Partial<RecipeForm> = { sourceUrl, sourceName: 'Marmiton' };
    if (Array.isArray(data.ingredients)) patch.ingredients = data.ingredients.map(parseIngredient);
    if (Array.isArray(data.steps)) patch.prepSteps = data.steps;
    if (data.cook_time_mins) patch.cookTimeMins = Math.min(data.cook_time_mins, COOK_TIMER_MAX_MINUTES);
    if (data.prep_time_mins) patch.prepTimeMins = data.prep_time_mins;
    if (data.rest_time_mins) patch.restTimeMins = data.rest_time_mins;
    if (Array.isArray(data.utensils)) patch.utensils = data.utensils;
    return patch;
}
