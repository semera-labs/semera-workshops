import { MAX_PREFERENCES, PREFERENCE_KEYS } from "../preferenceKeys.js";

export function createPreferenceGetter(maxPreferences = MAX_PREFERENCES) {
    const safeMaxPreferences = Math.min(
        MAX_PREFERENCES,
        Math.max(
            1,
            Number.parseInt(maxPreferences, 10) || MAX_PREFERENCES
        )
    );

    return function getPreferences(submission) {
        const preferences =
            submission?.preferences ?? {};

        return PREFERENCE_KEYS
            .map((key) => preferences[key])
            .filter(Boolean)
            .slice(0, safeMaxPreferences);
    };
}
