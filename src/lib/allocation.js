import { getAllSubmissions } from './data.js';
import { getAllWorkshops } from './workshops.js';

export async function allocateWorkshops(numDays = 1, maxPreferences = 5, predefinedAllocations = [], forceRandom = true) {
    const submissions = await getAllSubmissions();
    const workshops = await getAllWorkshops();

    const submissionsData = submissions.map((sub) => sub.get({ plain: true }));
    const workshopsData = workshops.map((ws) => ws.get({ plain: true }));

    const warnings = [];
    const days = Array.from({ length: numDays }, (_, i) => i + 1);

    const getPreferences = (submission) => {
        const allPrefs = [
            submission.preferences.first,
            submission.preferences.second,
            submission.preferences.third,
            submission.preferences.fourth,
            submission.preferences.fifth,
        ];
        // filter out undefined/empty and limit to maxPreferences
        return allPrefs.filter(Boolean).slice(0, maxPreferences);
    };

    if (forceRandom) {
        return balancedRandomAllocation(submissionsData, workshopsData, warnings);
    }

    if (numDays === 1) {
        return singleDayAllocation(submissionsData, workshopsData, warnings, getPreferences, predefinedAllocations);
    }

    return multiDayAllocation(submissionsData, workshopsData, warnings, getPreferences, days);
}

function singleDayAllocation(
    submissionsData,
    workshopsData,
    warnings,
    getPreferences,
    predefinedAllocations = []
) {
    // --- Helper: normalize names to avoid mismatch bugs ---
    const normalize = (name) => name.trim().toLowerCase();

    // --- 1. Prepare predefined mappings ---
    const predefinedByWorkshop = {};
    const predefinedNames = new Set();

    for (const { name, workshopTitle } of predefinedAllocations) {
        const normName = normalize(name);

        if (!predefinedByWorkshop[workshopTitle]) {
            predefinedByWorkshop[workshopTitle] = [];
        }

        predefinedByWorkshop[workshopTitle].push(name);
        predefinedNames.add(normName);
    }

    // --- 2. Remove predefined participants from submissions ---
    const filteredSubmissions = submissionsData.filter(
        (s) => !predefinedNames.has(normalize(s.name))
    );

    // --- 3. Build workshop map with reduced capacity ---
    const workshopMap = {};

    workshopsData.forEach((workshop) => {
        const predefinedCount =
            predefinedByWorkshop[workshop.title]?.length || 0;

        if (predefinedCount > workshop.maxParticipants) {
            warnings.push(
                `Too many predefined participants for ${workshop.title}`
            );
        }

        workshopMap[workshop.title] = {
            id: workshop.id,
            title: workshop.title,
            maxParticipants: Math.max(
                0,
                workshop.maxParticipants - predefinedCount
            ),
            minParticipants: Math.max(
                0,
                workshop.minParticipants - predefinedCount
            ),
            participants: [],
            staff: workshop.staff,
        };
    });

    // --- 4. Normal allocation (UNCHANGED) ---
    const shuffledSubmissions = filteredSubmissions.sort(
        () => Math.random() - 0.5
    );

    const unassignedParticipants = [];

    shuffledSubmissions.forEach((submission) => {
        const preferences = getPreferences(submission);

        let assigned = false;
        for (const preference of preferences) {
            const workshop = workshopMap[preference];
            if (
                workshop &&
                workshop.participants.length < workshop.maxParticipants
            ) {
                workshop.participants.push(submission.name);
                assigned = true;
                break;
            }
        }

        if (!assigned) {
            unassignedParticipants.push(submission);
        }
    });

    // --- 5. Handle underfilled workshops (SAFE VERSION) ---
    const toReallocate = [];
    const failedWorkshops = new Set();

    for (const [title, workshop] of Object.entries(workshopMap)) {
        const hasPredefined = (predefinedByWorkshop[title]?.length || 0) > 0;

        // ❗ Do NOT invalidate workshops that contain predefined participants
        if (
            workshop.participants.length < workshop.minParticipants &&
            !hasPredefined
        ) {
            console.log(
                `Workshop "${title}" didn't meet minimum participants. Reallocating.`
            );

            const displacedNames = workshop.participants;
            failedWorkshops.add(title);

            toReallocate.push(
                ...filteredSubmissions.filter((s) =>
                    displacedNames.includes(s.name)
                )
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
            if (
                workshop &&
                !failedWorkshops.has(preference) &&
                workshop.participants.length < workshop.maxParticipants
            ) {
                workshop.participants.push(submission.name);
                assigned = true;
                break;
            }
        }

        if (!assigned) {
            stillUnassigned.push(submission);
            warnings.push(
                `Could not assign participant: ${submission.name}`
            );
        }
    });

    // --- 6. Reinsert predefined participants (FINAL STEP ONLY) ---
    for (const [title, names] of Object.entries(predefinedByWorkshop)) {
        if (!workshopMap[title]) {
            warnings.push(`Predefined workshop not found: ${title}`);
            continue;
        }

        workshopMap[title].participants.push(...names);
    }

    // --- 7. Return result ---
    return {
        workshops: Object.values(workshopMap),
        warnings,
    };
}

function multiDayAllocation(submissionsData, workshopsData, warnings, getPreferences, days){
        const workshopSchedule = {};
    for (const workshop of workshopsData) {
        workshopSchedule[workshop.title] = {
            id: workshop.id,
            title: workshop.title,
            staff: workshop.staff,
            maxParticipants: workshop.maxParticipants,
            minParticipants: workshop.minParticipants,
            days: {}
        };
        for (const day of days) {
            workshopSchedule[workshop.title].days[day] = [];
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
        let preferences = getPreferences(submission);
        preferences = shuffle(preferences);

        const allocated = [];
        const usedDays = new Set();
        const usedProjects = new Set();

        for (const pref of preferences) {
            if (allocated.length >= days.length) break;

            for (const day of days) {
                if (usedDays.has(day)) continue;

                const workshop = workshopsData.find(w => w.title === pref);
                const projectDay = workshopSchedule[pref]?.days?.[day];

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
            warnings.push(`Could not allocate all ${days.length} preferences for ${submission.name}`);
        }

        studentAllocations[submission.name] = allocated;
    }

    return {
        schedule: workshopSchedule,
        allocations: studentAllocations,
        warnings,
    };
}

function balancedRandomAllocation(submissionsData, workshopsData, warnings) {
    // 1. Workshops vorbereiten
    const workshopMap = {};
    workshopsData.forEach((workshop) => {
        workshopMap[workshop.title] = {
            id: workshop.id,
            title: workshop.title,
            maxParticipants: workshop.maxParticipants,
            minParticipants: workshop.minParticipants,
            participants: [],
            staff: workshop.staff,
        };
    });

    const activeWorkshops = Object.values(workshopMap);
    
    // 2. Teilnehmer zufällig mischen (Fisher-Yates Shuffle)
    const shuffledSubmissions = [...submissionsData];
    for (let i = shuffledSubmissions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffledSubmissions[i], shuffledSubmissions[j]] = [shuffledSubmissions[j], shuffledSubmissions[i]];
    }

    // 3. Verteilung im Round-Robin Verfahren
    // Wir gehen die Teilnehmer nacheinander durch und weisen sie dem nächsten freien Workshop zu
    let workshopIndex = 0;

    shuffledSubmissions.forEach((submission) => {
        let assigned = false;
        let attempts = 0;

        // Suche den nächsten Workshop, der noch Platz hat
        while (!assigned && attempts < activeWorkshops.length) {
            const currentWorkshop = activeWorkshops[workshopIndex];

            if (currentWorkshop.participants.length < currentWorkshop.maxParticipants) {
                currentWorkshop.participants.push(submission.name);
                assigned = true;
            }

            // Index weiterschalten (und am Ende wieder bei 0 anfangen)
            workshopIndex = (workshopIndex + 1) % activeWorkshops.length;
            attempts++;
        }

        if (!assigned) {
            warnings.push(`Could not assign participant (all workshops full): ${submission.name}`);
        }
    });

    return {
        workshops: Object.values(workshopMap),
        warnings,
    };
}