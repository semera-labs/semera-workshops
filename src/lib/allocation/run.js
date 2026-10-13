import { createPreferenceGetter } from "./preferences.js";
import { singleDayAllocation } from "./singleDay.js";
import { multiDayAllocation } from "./multiDay.js";
import { balancedRandomAllocation } from "./random.js";
import { createIssueLog, toWarnings } from "./issues.js";
import { createRng, parseSeed, randomSeed } from "./rng.js";
import { computeAllocationStats } from "./stats.js";
import {
    checkCapacity,
    normalizeConfig,
    prepareInput,
} from "./prepare.js";

import { MAX_ALLOCATION_RUNS } from "../preferenceKeys.js";

export const MAX_ATTEMPTS = MAX_ALLOCATION_RUNS;

/*
 * Runs one complete allocation on plain data (no database access).
 *
 * options:
 *   seed      reproduces a run; a random one is chosen (and returned) if omitted
 *   fallback  fill people without a possible wish with a free workshop (default false:
 *             they stay unassigned so they can be placed by hand)
 *   attempts  run the greedy algorithm N times with different seeds and keep
 *             the run with the most first choices (default 1 = a single run)
 */
export function runAllocation({
    numDays = 1,
    maxPreferences = 5,
    submissions,
    workshops,
    predefinedAllocations = [],
    forceRandom = false,
    seed = null,
    fallback = false,
    attempts = 1,
}) {
    const config = normalizeConfig(numDays, maxPreferences);
    const multiDay = !forceRandom && config.numDays > 1;

    const prepLog = createIssueLog();

    const input = prepareInput({
        submissions,
        workshops,
        predefinedAllocations,
        maxPreferences: config.maxPreferences,
        log: prepLog,
    });

    checkCapacity({
        ...input,
        numDays: config.numDays,
        maxPreferences: config.maxPreferences,
        multiDay,
        fallback,
        log: prepLog,
    });

    const baseSeed = parseSeed(seed) ?? randomSeed();

    const runCount = Math.min(
        MAX_ATTEMPTS,
        Math.max(1, Number.parseInt(attempts, 10) || 1)
    );

    const getPreferences = createPreferenceGetter(config.maxPreferences);
    const days = Array.from({ length: config.numDays }, (_, i) => i + 1);

    let best = null;

    for (let attempt = 0; attempt < runCount; attempt++) {
        const runSeed = (baseSeed + attempt * 0x9e3779b1) >>> 0;
        const log = createIssueLog();
        const rng = createRng(runSeed);

        let result;

        if (forceRandom) {
            result = balancedRandomAllocation({
                submissions: input.submissions,
                workshops: input.workshops,
                log,
                maxPreferences: config.maxPreferences,
                rng,
            });
        } else if (config.numDays === 1) {
            result = singleDayAllocation({
                submissions: input.submissions,
                workshops: input.workshops,
                log,
                getPreferences,
                predefinedAllocations: input.predefined,
                maxPreferences: config.maxPreferences,
                rng,
                fallback,
            });
        } else {
            result = multiDayAllocation({
                submissions: input.submissions,
                workshops: input.workshops,
                log,
                getPreferences,
                days,
                numDays: config.numDays,
                maxPreferences: config.maxPreferences,
                rng,
                fallback,
            });
        }

        const stats = computeAllocationStats(result, input.submissions);

        const better =
            !best ||
            stats.firstChoice > best.stats.firstChoice ||
            (stats.firstChoice === best.stats.firstChoice &&
                stats.unassignedSlots < best.stats.unassignedSlots);

        if (better) {
            best = { result, stats, log, seed: runSeed };
        }
    }

    const issues = [...prepLog.issues, ...best.log.issues];

    return {
        ...best.result,
        warnings: toWarnings(issues),
        issues,
        unassigned: best.stats.unassigned,
        stats: best.stats,
        seed: best.seed,
        attempts: runCount,
    };
}
