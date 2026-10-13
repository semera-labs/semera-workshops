import { normalizeKey } from "./keys.js";
import { MAX_PREFERENCES, PREFERENCE_KEYS } from "../preferenceKeys.js";

/*
 * Statistics about an allocation result. Pure and free of server code, so the
 * server (after a run) and the admin page (after manual changes) use the same
 * numbers.
 *
 * submissions: [{ name, preferences: { first, second, ... } }]
 */

export function computeAllocationStats(allocation, submissions = []) {
    if (!allocation) {
        return null;
    }

    const multiDay = allocation.mode === "multi-day";
    const numDays = multiDay ? Number(allocation.numDays) || 1 : 1;
    const maxPreferences = Math.min(
        MAX_PREFERENCES,
        Math.max(1, Number(allocation.maxPreferences) || MAX_PREFERENCES)
    );

    const wishesByName = new Map();

    for (const submission of submissions) {
        wishesByName.set(
            normalizeKey(submission.name),
            PREFERENCE_KEYS.slice(0, maxPreferences)
                .map((key) => submission.preferences?.[key])
                .filter(Boolean)
                .map(normalizeKey)
        );
    }

    const placements = allocation.participantAllocations ?? {};

    const placementsByKey = new Map(
        Object.entries(placements).map(([name, list]) => [
            normalizeKey(name),
            { name, list },
        ])
    );

    // --- Assignments and wish ranks ---
    const byRank = Array(maxPreferences).fill(0);
    let assignments = 0;
    let noWish = 0;
    let fallback = 0;
    let rankSum = 0;

    for (const { name, list } of placementsByKey.values()) {
        const wishes = wishesByName.get(normalizeKey(name)) ?? [];

        for (const placement of list) {
            assignments++;

            if (placement.fallback) {
                fallback++;
            }

            const rank = wishes.indexOf(normalizeKey(placement.workshop)) + 1;

            if (rank > 0) {
                byRank[rank - 1]++;
                rankSum += rank;
            } else {
                noWish++;
            }
        }
    }

    // --- People without a (complete) allocation ---
    const people = new Map();

    for (const submission of submissions) {
        people.set(normalizeKey(submission.name), submission.name);
    }

    for (const { name } of placementsByKey.values()) {
        people.set(normalizeKey(name), name);
    }

    const unassigned = [];
    let unassignedSlots = 0;

    for (const [key, name] of people) {
        const placedDays = new Set(
            (placementsByKey.get(key)?.list ?? []).map((item) => item.day)
        );

        const missingDays = [];

        for (let day = 1; day <= numDays; day++) {
            if (!placedDays.has(day)) {
                missingDays.push(day);
            }
        }

        if (missingDays.length > 0) {
            unassigned.push({ name, days: missingDays });
            unassignedSlots += missingDays.length;
        }
    }

    unassigned.sort((a, b) => a.name.localeCompare(b.name, "de"));

    // --- Seats and workshops ---
    const belowMinimum = [];
    const overfilled = [];
    let seatsTotal = 0;
    let seatsUsed = 0;

    const check = (workshop, day, count) => {
        const max = Number(workshop.maxParticipants) || 0;
        const min = Number(workshop.minParticipants) || 0;

        seatsTotal += max;
        seatsUsed += count;

        if (count < min) {
            belowMinimum.push({
                workshop: workshop.title,
                day: multiDay ? day : null,
                count,
                min,
            });
        }

        if (max > 0 && count > max) {
            overfilled.push({
                workshop: workshop.title,
                day: multiDay ? day : null,
                count,
                max,
            });
        }
    };

    if (multiDay) {
        for (const workshop of Object.values(allocation.schedule ?? {})) {
            for (let day = 1; day <= numDays; day++) {
                check(workshop, day, workshop.days?.[day]?.length ?? 0);
            }
        }
    } else {
        for (const workshop of allocation.workshops ?? []) {
            check(workshop, 1, workshop.participants?.length ?? 0);
        }
    }

    const wished = assignments - noWish;

    return {
        participants: people.size,
        assignments,
        byRank,
        firstChoice: byRank[0] ?? 0,
        firstChoiceRate: assignments > 0 ? (byRank[0] ?? 0) / assignments : 0,
        averageRank: wished > 0 ? rankSum / wished : 0,
        noWish,
        fallback,
        unassigned,
        unassignedSlots,
        seatsTotal,
        seatsUsed,
        seatsFree: seatsTotal - seatsUsed,
        belowMinimum,
        overfilled,
    };
}
