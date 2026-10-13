import { normalizeKey } from "./keys.js";

/*
 * Manual changes to an allocation, for single-day and multi-day.
 *
 * All functions are pure: they return a new allocation and never change the
 * one they were given.
 *
 * context: { workshops, numDays, maxPreferences }
 *   workshops   all workshops (needed when there is no allocation yet)
 *   numDays     number of days of the current settings
 */

const sameName = (a, b) => normalizeKey(a) === normalizeKey(b);

export function emptyAllocation({ workshops = [], numDays = 1, maxPreferences = 5 }) {
    const days = Math.max(1, Number(numDays) || 1);

    if (days === 1) {
        return {
            mode: "single-day",
            numDays: 1,
            maxPreferences,
            workshops: workshops.map((workshop) => ({
                ...workshop,
                participants: [],
            })),
            schedule: null,
            participantAllocations: {},
            warnings: [],
            issues: [],
        };
    }

    const schedule = {};

    for (const workshop of workshops) {
        schedule[workshop.title] = {
            ...workshop,
            days: Object.fromEntries(
                Array.from({ length: days }, (_, i) => [i + 1, []])
            ),
        };
    }

    return {
        mode: "multi-day",
        numDays: days,
        maxPreferences,
        workshops: Object.values(schedule),
        schedule,
        participantAllocations: {},
        warnings: [],
        issues: [],
    };
}

/*
 * Copies everything a change may touch.
 */
function cloneForEdit(allocation) {
    const copy = {
        ...allocation,
        participantAllocations: Object.fromEntries(
            Object.entries(allocation.participantAllocations ?? {}).map(
                ([name, list]) => [name, list.map((item) => ({ ...item }))]
            )
        ),
    };

    if (allocation.mode === "multi-day") {
        copy.schedule = Object.fromEntries(
            Object.entries(allocation.schedule ?? {}).map(([title, workshop]) => [
                title,
                {
                    ...workshop,
                    days: Object.fromEntries(
                        Object.entries(workshop.days ?? {}).map(
                            ([day, names]) => [day, [...names]]
                        )
                    ),
                },
            ])
        );

        copy.workshops = Object.values(copy.schedule);
    } else {
        copy.workshops = (allocation.workshops ?? []).map((workshop) => ({
            ...workshop,
            participants: [...(workshop.participants ?? [])],
        }));
    }

    return copy;
}

/*
 * The key under which this person is stored (keeps the stored spelling).
 */
function keyFor(allocation, name) {
    return (
        Object.keys(allocation.participantAllocations).find((key) =>
            sameName(key, name)
        ) ?? name
    );
}

function baseAllocation(allocation, context) {
    return cloneForEdit(allocation ?? emptyAllocation(context));
}

/*
 * Puts a person into a workshop (on a day).
 *
 * Single-day: the person is moved; every earlier seat is released.
 * Multi-day:  whatever the person had on that day is replaced, and if the
 *             person already had this workshop on another day it moves
 *             (nobody visits the same workshop twice).
 *
 * Seats are not checked on purpose: an over-full workshop is shown in red
 * and the organiser decides.
 */
export function assignManually(allocation, { name, workshop, day = 1 }, context = {}) {
    const next = baseAllocation(allocation, context);
    const key = keyFor(next, name);

    if (next.mode === "multi-day") {
        const dayNumber = Number(day);

        if (!next.schedule[workshop]) {
            const source = (context.workshops ?? []).find(
                (item) => item.title === workshop
            );

            next.schedule[workshop] = {
                ...(source ?? { title: workshop }),
                days: Object.fromEntries(
                    Array.from({ length: next.numDays }, (_, i) => [i + 1, []])
                ),
            };

            next.workshops = Object.values(next.schedule);
        }

        for (const item of Object.values(next.schedule)) {
            for (const [dayKey, names] of Object.entries(item.days)) {
                const isThatDay = Number(dayKey) === dayNumber;
                const isThatWorkshop = item.title === workshop;

                if (isThatDay || isThatWorkshop) {
                    item.days[dayKey] = names.filter((n) => !sameName(n, name));
                }
            }
        }

        next.schedule[workshop].days[dayNumber] ??= [];
        next.schedule[workshop].days[dayNumber].push(key);

        const kept = (next.participantAllocations[key] ?? []).filter(
            (item) => Number(item.day) !== dayNumber && item.workshop !== workshop
        );

        next.participantAllocations[key] = [
            ...kept,
            { day: dayNumber, workshop, manual: true },
        ].sort((a, b) => a.day - b.day);

        return next;
    }

    for (const item of next.workshops) {
        item.participants = item.participants.filter((n) => !sameName(n, name));
    }

    let target = next.workshops.find((item) => item.title === workshop);

    if (!target) {
        const source = (context.workshops ?? []).find(
            (item) => item.title === workshop
        );

        target = { ...(source ?? { title: workshop }), participants: [] };
        next.workshops.push(target);
    }

    target.participants.push(key);

    next.participantAllocations[key] = [{ day: 1, workshop, manual: true }];

    return next;
}

/*
 * Releases a person's seat (one day in multi-day, the only seat in
 * single-day).
 */
export function unassignManually(allocation, { name, day = 1 }, context = {}) {
    if (!allocation) {
        return allocation;
    }

    const next = baseAllocation(allocation, context);
    const key = keyFor(next, name);

    if (next.mode === "multi-day") {
        const dayNumber = Number(day);

        for (const item of Object.values(next.schedule)) {
            if (item.days[dayNumber]) {
                item.days[dayNumber] = item.days[dayNumber].filter(
                    (n) => !sameName(n, name)
                );
            }
        }

        const kept = (next.participantAllocations[key] ?? []).filter(
            (item) => Number(item.day) !== dayNumber
        );

        if (kept.length > 0) {
            next.participantAllocations[key] = kept;
        } else {
            delete next.participantAllocations[key];
        }

        return next;
    }

    for (const item of next.workshops) {
        item.participants = item.participants.filter((n) => !sameName(n, name));
    }

    delete next.participantAllocations[key];

    return next;
}

/*
 * What the context menu needs to know about one person:
 * [{ day, workshop }] for every day that has an assignment.
 */
export function assignmentsOf(allocation, name) {
    if (!allocation) {
        return [];
    }

    const entry = Object.entries(allocation.participantAllocations ?? {}).find(
        ([key]) => sameName(key, name)
    );

    return (entry?.[1] ?? []).map(({ day, workshop }) => ({ day, workshop }));
}
