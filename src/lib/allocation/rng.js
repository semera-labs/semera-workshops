/*
 * Seedable random numbers (mulberry32). The same seed always gives the same
 * sequence, so an allocation can be reproduced.
 */

export function randomSeed() {
    return Math.floor(Math.random() * 2 ** 32);
}

export function parseSeed(value) {
    if (value == null || String(value).trim() === "") {
        return null;
    }

    const seed = Number(value);

    return Number.isInteger(seed) && seed >= 0 && seed < 2 ** 32
        ? seed
        : null;
}

export function createRng(seed) {
    let state = seed >>> 0;

    return function rng() {
        state = (state + 0x6d2b79f5) >>> 0;

        let t = state;

        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);

        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/*
 * Fisher-Yates shuffle (unbiased, unlike sort(() => Math.random() - 0.5)).
 */
export function shuffle(array, rng) {
    const copy = [...array];

    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));

        [copy[i], copy[j]] = [copy[j], copy[i]];
    }

    return copy;
}
