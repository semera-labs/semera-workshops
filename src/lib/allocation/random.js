import { shuffle } from "./rng.js";

/*
 * Ignores all wishes and distributes everybody round-robin.
 */
export function balancedRandomAllocation({
    submissions,
    workshops,
    log,
    maxPreferences,
    rng,
}) {
    const list = workshops.map((workshop) => ({
        id: workshop.id,
        title: workshop.title,
        maxParticipants: workshop.maxParticipants,
        minParticipants: workshop.minParticipants,
        participants: [],
        staff: workshop.staff,
        location: workshop.location,
    }));

    let workshopIndex = 0;

    const participantAllocations = {};

    for (const submission of shuffle(submissions, rng)) {
        let assigned = false;

        for (let attempts = 0; attempts < list.length && !assigned; attempts++) {
            const workshop = list[workshopIndex];

            if (workshop.participants.length < workshop.maxParticipants) {
                workshop.participants.push(submission.name);
                participantAllocations[submission.name] = [
                    { day: 1, workshop: workshop.title },
                ];
                assigned = true;
            }

            workshopIndex = (workshopIndex + 1) % list.length;
        }

        if (!assigned) {
            log.add(
                "unassigned",
                `„${submission.name}“ konnte nicht zugeteilt werden (alle Workshops voll).`,
                { participant: submission.name }
            );

            participantAllocations[submission.name] = [];
        }
    }

    return {
        mode: "random",
        numDays: 1,
        maxPreferences,
        workshops: list,
        schedule: null,
        participantAllocations,
    };
}
