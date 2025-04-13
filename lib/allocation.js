import { getAllSubmissions } from './data';
import { getAllWorkshops } from './workshops';

export async function allocateWorkshops() {
    const submissions = await getAllSubmissions();
    const workshops = await getAllWorkshops();

    // Convert models to plain objects
    const submissionsData = submissions.map((sub) => sub.get({ plain: true }));
    const workshopsData = workshops.map((ws) => ws.get({ plain: true }));

    // Map workshop titles to their data
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

    // Shuffle submissions
    const shuffledSubmissions = submissionsData.sort(() => Math.random() - 0.5);

    const unassignedParticipants = [];

    // Initial allocation attempt
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

    // Remove workshops that don't meet minParticipants
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

    // Reallocate displaced participants using preferences again
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

    return Object.values(workshopMap);
}
