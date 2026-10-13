import { getAllSubmissions } from "../data.js";
import { getAllWorkshops } from "../workshops.js";
import { runAllocation } from "./run.js";

export { AllocationInputError } from "./issues.js";
export { MAX_DAYS } from "./prepare.js";

/*
 * Loads the data and runs an allocation. Throws AllocationInputError
 * (status 400) when the data or settings cannot be allocated.
 *
 * options: { seed, fallback, attempts } – see runAllocation().
 */
export async function allocateWorkshops(
    numDays = 1,
    maxPreferences = 5,
    predefinedAllocations = [],
    forceRandom = false,
    options = {}
) {
    const [submissions, workshops] = await Promise.all([
        getAllSubmissions(),
        getAllWorkshops(),
    ]);

    return runAllocation({
        numDays,
        maxPreferences,
        predefinedAllocations,
        forceRandom,
        submissions: submissions.map((item) => item.get({ plain: true })),
        workshops: workshops.map((item) => item.get({ plain: true })),
        ...options,
    });
}
