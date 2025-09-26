import { getAllSubmissions } from './data.js';
import { getAllWorkshops } from './workshops.js';

export async function allocateWorkshops(numDays = 1) {
    const submissions = await getAllSubmissions();
    const workshops = await getAllWorkshops();

    const submissionsData = submissions.map((sub) => sub.get({ plain: true }));
    const workshopsData = workshops.map((ws) => ws.get({ plain: true }));

    const days = Array.from({ length: numDays }, (_, i) => i + 1);

    // Single-day mode
    if (numDays === 1) {
        const workshopMap = {};
        workshopsData.forEach((workshop) => {
            workshopMap[workshop.title] = {
                id: workshop.id,
                title: workshop.title,
                maxParticipants: workshop.maxParticipants,
                minParticipants: workshop.minParticipants,
                participants: [],
            };
        });

        const shuffledSubmissions = submissionsData.sort(() => Math.random() - 0.5);
        const unassignedParticipants = [];

        shuffledSubmissions.forEach((submission) => {
            const preferences = [
                submission.preferences.first,
                submission.preferences.second,
                submission.preferences.third,
            ];

            let assigned = false;
            for (const preference of preferences) {
                const workshop = workshopMap[preference];
                if (workshop && workshop.participants.length < workshop.maxParticipants) {
                    workshop.participants.push(submission.name);
                    assigned = true;
                    break;
                }
            }

            if (!assigned) {
                unassignedParticipants.push(submission);
            }
        });

        // Remove underfilled workshops
        const toReallocate = [];

        for (const [title, workshop] of Object.entries(workshopMap)) {
            if (workshop.participants.length < workshop.minParticipants) {
                console.log(`Workshop "${title}" didn't meet minimum participants. Reallocating.`);
                const displacedNames = workshop.participants;
                toReallocate.push(
                    ...submissionsData.filter((s) => displacedNames.includes(s.name))
                );
                workshop.participants = [];
            }
        }

        const stillUnassigned = [];

        [...toReallocate, ...unassignedParticipants].forEach((submission) => {
            const preferences = [
                submission.preferences.first,
                submission.preferences.second,
                submission.preferences.third,
            ];

            let assigned = false;
            for (const preference of preferences) {
                const workshop = workshopMap[preference];
                if (workshop && workshop.participants.length < workshop.maxParticipants) {
                    workshop.participants.push(submission.name);
                    assigned = true;
                    break;
                }
            }

            if (!assigned) {
                stillUnassigned.push(submission);
                console.warn(`Could not assign participant: ${submission.name}`);
            }
        });

        return Object.values(workshopMap); // Same return as original single-day version
    }

    // Multi-day mode
    const workshopSchedule = {};
    for (const workshop of workshopsData) {
        workshopSchedule[workshop.title] = {};
        for (const day of days) {
            workshopSchedule[workshop.title][day] = [];
        }
    }

    function shuffle(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    const studentAllocations = {};

    for (const submission of submissionsData) {
        let preferences = [
            submission.preferences.first,
            submission.preferences.second,
            submission.preferences.third,
            submission.preferences.fourth,
        ];

        preferences = shuffle(preferences);

        const allocated = [];
        const usedDays = new Set();
        const usedProjects = new Set();

        for (const pref of preferences) {
            if (allocated.length >= days.length) break;

            for (const day of days) {
                if (usedDays.has(day)) continue;

                const workshop = workshopsData.find(w => w.title === pref);
                const projectDay = workshopSchedule[pref]?.[day];

                if (
                    projectDay &&
                    projectDay.length < workshop.maxParticipants &&
                    !usedProjects.has(pref)
                ) {
                    projectDay.push(submission.name);
                    allocated.push({ project: pref, day });
                    usedDays.add(day);
                    usedProjects.add(pref);
                    break;
                }
            }
        }

        if (allocated.length < days.length) {
            console.warn(`Could not allocate all ${days.length} preferences for ${submission.name}`);
        }

        studentAllocations[submission.name] = allocated;
    }

    return {
        schedule: workshopSchedule,
        allocations: studentAllocations,
    };
}