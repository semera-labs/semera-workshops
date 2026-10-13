import { shuffle } from "./rng.js";

/*
 * Greedy multi-day allocation.
 *
 *   Pass 1: in random order, every participant gets for every day the first
 *           wish that still has room on that day and that they have not
 *           had on another day yet.
 *   Pass 2 (optional fallback, off by default): the person-days that are still empty are
 *           filled with the least-full workshop of that day. This runs after
 *           pass 1 for everybody, so it can never take a seat away from a wish.
 */
export function multiDayAllocation({
    submissions,
    workshops,
    log,
    getPreferences,
    days,
    numDays,
    maxPreferences,
    rng,
    fallback = false,
}) {
    const schedule = {};

    for (const workshop of workshops) {
        schedule[workshop.title] = {
            id: workshop.id,
            title: workshop.title,
            staff: workshop.staff,
            location: workshop.location,
            maxParticipants: workshop.maxParticipants,
            minParticipants: workshop.minParticipants,
            days: Object.fromEntries(days.map((day) => [day, []])),
        };
    }

    const state = new Map();

    // --- Pass 1: wishes ---
    for (const submission of shuffle(submissions, rng)) {
        const preferences = getPreferences(submission);
        const used = new Set();
        const allocated = [];

        for (const day of days) {
            for (const preference of preferences) {
                const workshop = schedule[preference];

                if (
                    !workshop ||
                    used.has(preference) ||
                    workshop.days[day].length >= workshop.maxParticipants
                ) {
                    continue;
                }

                workshop.days[day].push(submission.name);
                allocated.push({ day, workshop: preference });
                used.add(preference);

                break;
            }
        }

        state.set(submission.name, { used, allocated });
    }

    // --- Pass 2: fill the gaps ---
    const gaps = [];

    for (const [name, { allocated }] of state) {
        for (const day of days) {
            if (!allocated.some((item) => item.day === day)) {
                gaps.push({ name, day });
            }
        }
    }

    let filled = 0;

    for (const { name, day } of shuffle(gaps, rng)) {
        const { used, allocated } = state.get(name);
        let placed = false;

        if (fallback) {
            const candidates = Object.values(schedule)
                .filter(
                    (workshop) =>
                        !used.has(workshop.title) &&
                        workshop.days[day].length < workshop.maxParticipants
                )
                .map((workshop) => ({
                    workshop,
                    belowMinimum:
                        workshop.days[day].length < workshop.minParticipants
                            ? 0
                            : 1,
                    fill:
                        workshop.days[day].length / workshop.maxParticipants,
                    tie: rng(),
                }))
                .sort(
                    (a, b) =>
                        a.belowMinimum - b.belowMinimum ||
                        a.fill - b.fill ||
                        a.tie - b.tie
                );

            if (candidates.length > 0) {
                const { workshop } = candidates[0];

                workshop.days[day].push(name);
                allocated.push({
                    day,
                    workshop: workshop.title,
                    fallback: true,
                });
                used.add(workshop.title);
                filled++;
                placed = true;
            }
        }

        if (!placed) {
            log.add(
                "unassigned",
                `„${name}“ hat an Tag ${day} keinen Platz in den Wünschen bekommen und ist nicht zugeteilt.`,
                { participant: name, day }
            );
        }
    }

    if (filled > 0) {
        log.add(
            "fallback-summary",
            `${filled} Tageszuteilung(en) ohne erfüllbaren Wunsch wurden mit einem nicht gewünschten Workshop aufgefüllt.`,
            { count: filled }
        );
    }

    // --- Underfilled workshop days ---
    for (const workshop of Object.values(schedule)) {
        for (const day of days) {
            const count = workshop.days[day].length;

            if (count > 0 && count < workshop.minParticipants) {
                log.add(
                    "below-minimum",
                    `Der Workshop „${workshop.title}“ hat an Tag ${day} nur ${count} Teilnehmer (Minimum ${workshop.minParticipants}).`,
                    { workshop: workshop.title, day, count }
                );
            }
        }
    }

    const participantAllocations = {};

    for (const [name, { allocated }] of state) {
        participantAllocations[name] = [...allocated].sort(
            (a, b) => a.day - b.day
        );
    }

    return {
        mode: "multi-day",
        numDays,
        maxPreferences,
        workshops: Object.values(schedule),
        schedule,
        participantAllocations,
    };
}
