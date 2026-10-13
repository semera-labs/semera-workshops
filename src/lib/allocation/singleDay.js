import { normalizeKey } from "./keys.js";
import { shuffle } from "./rng.js";

/*
 * Greedy single-day allocation.
 *
 *   1. Predefined participants take their seats first.
 *   2. Everybody else is processed in random order and gets the first wish
 *      that still has room.
 *   3. Workshops below their minimum are cancelled and their people are
 *      re-placed on their remaining wishes.
 *   4. Fallback (optional, off by default): whoever is still left gets the least-full
 *      workshop with room. This runs after all wishes were handled, so it
 *      can never take a seat away from somebody's wish.
 *   5. Predefined participants are added to their workshops.
 */
export function singleDayAllocation({
    submissions,
    workshops,
    log,
    getPreferences,
    predefinedAllocations = [],
    maxPreferences,
    rng,
    fallback = false,
}) {
    // --- Workshops ---
    const byTitle = new Map();

    for (const workshop of workshops) {
        byTitle.set(workshop.title, {
            id: workshop.id,
            title: workshop.title,
            maxParticipants: workshop.maxParticipants,
            minParticipants: workshop.minParticipants,
            participants: [],
            predefined: [],
            availableCapacity: workshop.maxParticipants,
            staff: workshop.staff,
            location: workshop.location,
        });
    }

    // --- 1. Predefined participants reduce the capacity ---
    const predefinedNames = new Set();

    for (const { name, workshopTitle } of predefinedAllocations) {
        const workshop = byTitle.get(workshopTitle);
        const key = normalizeKey(name);

        if (!name || !workshop) {
            log.add(
                "predefined-workshop-missing",
                `Vorab-Zuteilung für „${name}“: Den Workshop „${workshopTitle}“ gibt es nicht. Die Person wird normal zugeteilt.`
            );

            continue;
        }

        if (predefinedNames.has(key)) {
            continue;
        }

        predefinedNames.add(key);
        workshop.predefined.push(name);
    }

    for (const workshop of byTitle.values()) {
        if (workshop.predefined.length > workshop.maxParticipants) {
            log.add(
                "predefined-over-capacity",
                `Zu viele vorab zugeteilte Teilnehmer für „${workshop.title}“ (${workshop.predefined.length} von ${workshop.maxParticipants}).`,
                { workshop: workshop.title }
            );
        }

        workshop.availableCapacity = Math.max(
            0,
            workshop.maxParticipants - workshop.predefined.length
        );
    }

    // --- 2. Normal allocation in random order ---
    const pool = submissions.filter(
        (submission) => !predefinedNames.has(normalizeKey(submission.name))
    );

    const poolByName = new Map(
        pool.map((submission) => [submission.name, submission])
    );

    const place = (submission, isAllowed) => {
        for (const preference of getPreferences(submission)) {
            const workshop = byTitle.get(preference);

            if (
                workshop &&
                isAllowed(workshop) &&
                workshop.participants.length < workshop.availableCapacity
            ) {
                workshop.participants.push(submission.name);

                return true;
            }
        }

        return false;
    };

    const unassigned = [];

    for (const submission of shuffle(pool, rng)) {
        if (!place(submission, () => true)) {
            unassigned.push(submission);
        }
    }

    // --- 3. Cancel workshops that did not reach their minimum ---
    const displaced = [];
    const cancelled = new Set();

    for (const workshop of byTitle.values()) {
        /*
         * Workshops with predefined participants are never cancelled.
         */
        if (
            workshop.predefined.length === 0 &&
            workshop.participants.length < workshop.minParticipants
        ) {
            log.add(
                "workshop-cancelled",
                `Der Workshop „${workshop.title}“ hat das Minimum von ${workshop.minParticipants} nicht erreicht (${workshop.participants.length}) und wird nicht durchgeführt.`,
                { workshop: workshop.title }
            );

            cancelled.add(workshop.title);

            displaced.push(
                ...workshop.participants.map((name) => poolByName.get(name))
            );

            workshop.participants = [];
        }
    }

    // --- 3b. Re-place displaced and unplaced people on their wishes ---
    const stillUnassigned = [];

    for (const submission of [...displaced, ...unassigned]) {
        if (!place(submission, (workshop) => !cancelled.has(workshop.title))) {
            stillUnassigned.push(submission);
        }
    }

    // --- 4. Fallback: least-full workshop with room ---
    const fallbackNames = new Set();

    if (fallback) {
        for (const submission of stillUnassigned) {
            const candidates = [...byTitle.values()]
                .filter(
                    (workshop) =>
                        !cancelled.has(workshop.title) &&
                        workshop.participants.length <
                        workshop.availableCapacity
                )
                .map((workshop) => {
                    const filled =
                        workshop.participants.length +
                        workshop.predefined.length;

                    return {
                        workshop,
                        belowMinimum: filled < workshop.minParticipants ? 0 : 1,
                        fill: filled / workshop.maxParticipants,
                        tie: rng(),
                    };
                })
                .sort(
                    (a, b) =>
                        a.belowMinimum - b.belowMinimum ||
                        a.fill - b.fill ||
                        a.tie - b.tie
                );

            if (candidates.length > 0) {
                const { workshop } = candidates[0];

                workshop.participants.push(submission.name);
                fallbackNames.add(submission.name);

                log.add(
                    "fallback",
                    `„${submission.name}“ konnte keinen Wunsch erhalten und wurde „${workshop.title}“ zugeteilt.`,
                    {
                        severity: "info",
                        participant: submission.name,
                        workshop: workshop.title,
                    }
                );
            }
        }
    }

    for (const submission of stillUnassigned) {
        if (!fallbackNames.has(submission.name)) {
            log.add(
                "unassigned",
                fallback
                    ? `„${submission.name}“ konnte nicht zugeteilt werden (keine freien Plätze mehr).`
                    : `„${submission.name}“ hat in keinem Wunsch-Workshop einen Platz bekommen und ist nicht zugeteilt.`,
                { participant: submission.name }
            );
        }
    }

    if (fallbackNames.size > 0) {
        log.add(
            "fallback-summary",
            `${fallbackNames.size} Person(en) ohne erfüllbaren Wunsch wurden mit einem nicht gewünschten Workshop aufgefüllt.`,
            { count: fallbackNames.size }
        );
    }

    // --- 5. Add predefined participants ---
    for (const workshop of byTitle.values()) {
        workshop.participants.push(...workshop.predefined);

        if (
            workshop.predefined.length > 0 &&
            workshop.participants.length < workshop.minParticipants
        ) {
            log.add(
                "below-minimum",
                `Der Workshop „${workshop.title}“ hat nur ${workshop.participants.length} Teilnehmer (Minimum ${workshop.minParticipants}).`,
                { workshop: workshop.title }
            );
        }
    }

    // --- 6. Result ---
    const participantAllocations = {};

    for (const workshop of byTitle.values()) {
        for (const participant of workshop.participants) {
            participantAllocations[participant] = [
                {
                    day: 1,
                    workshop: workshop.title,
                    ...(fallbackNames.has(participant)
                        ? { fallback: true }
                        : {}),
                },
            ];
        }
    }

    return {
        mode: "single-day",
        numDays: 1,
        maxPreferences,

        workshops: [...byTitle.values()].map(
            ({
                id,
                title,
                maxParticipants,
                minParticipants,
                participants,
                staff,
                location,
            }) => ({
                id,
                title,
                maxParticipants,
                minParticipants,
                participants,
                staff,
                location,
            })
        ),

        schedule: null,
        participantAllocations,
    };
}
