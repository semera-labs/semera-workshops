/*
 * Single source of truth for how many wishes and days are possible and what
 * they are called. Change the limits here only.
 */

export const PREFERENCE_KEYS = [
    "first",
    "second",
    "third",
    "fourth",
    "fifth",
    "sixth",
    "seventh",
];

export const MAX_PREFERENCES = PREFERENCE_KEYS.length;
export const MAX_DAYS = 7;

/* How many times the greedy allocation may be repeated (best run wins). */
export const MAX_ALLOCATION_RUNS = 200;

/* Column / sheet headers: "1. Wahl" … */
export const PREFERENCE_LABELS = PREFERENCE_KEYS.map(
    (_, index) => `${index + 1}. Wahl`
);

/* Admin table headers */
export const PREFERENCE_HEADERS = [
    "Erste Wahl",
    "Zweite Wahl",
    "Dritte Wahl",
    "Vierte Wahl",
    "Fünfte Wahl",
    "Sechste Wahl",
    "Siebte Wahl",
];

/* Phone form */
export const WISH_LABELS = [
    "Erster Wunsch",
    "Zweiter Wunsch",
    "Dritter Wunsch",
    "Vierter Wunsch",
    "Fünfter Wunsch",
    "Sechster Wunsch",
    "Siebter Wunsch",
];

export const WISH_PLACEHOLDERS = [
    "Ersten Wunsch auswählen",
    "Zweiten Wunsch auswählen",
    "Dritten Wunsch auswählen",
    "Vierten Wunsch auswählen",
    "Fünften Wunsch auswählen",
    "Sechsten Wunsch auswählen",
    "Siebten Wunsch auswählen",
];

export function emptyPreferences() {
    return Object.fromEntries(PREFERENCE_KEYS.map((key) => [key, ""]));
}

export function clampPreferenceCount(value, fallback = 3) {
    const number = Number.parseInt(value, 10);

    if (!Number.isInteger(number)) {
        return fallback;
    }

    return Math.min(MAX_PREFERENCES, Math.max(1, number));
}
