import { normalizeKey } from "./keys.js";
import { AllocationInputError } from "./issues.js";
import {
    MAX_DAYS,
    MAX_PREFERENCES,
    PREFERENCE_KEYS,
} from "../preferenceKeys.js";

export { MAX_DAYS, MAX_PREFERENCES };

/*
 * --------------------------------------------------------------------------
 * Input validation and cleaning. Everything that can be wrong with the data
 * is found here, once, so the allocators themselves can rely on clean input.
 *
 * Hard errors (the allocation cannot run) throw AllocationInputError.
 * Everything else becomes a message in the issue log.
 * --------------------------------------------------------------------------
 */


export function normalizeConfig(numDays, maxPreferences) {
    const days = Number(numDays);
    const preferences = Number(maxPreferences);

    if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
        throw new AllocationInputError(
            `Die Anzahl der Tage muss eine ganze Zahl zwischen 1 und ${MAX_DAYS} sein.`
        );
    }

    if (
        !Number.isInteger(preferences) ||
        preferences < 1 ||
        preferences > MAX_PREFERENCES
    ) {
        throw new AllocationInputError(
            `Die Anzahl der Wünsche muss zwischen 1 und ${MAX_PREFERENCES} liegen.`
        );
    }

    return { numDays: days, maxPreferences: preferences };
}

function prepareWorkshops(workshops, log) {
    if (!Array.isArray(workshops) || workshops.length === 0) {
        throw new AllocationInputError("Es sind keine Workshops angelegt.");
    }

    const seen = new Set();

    return workshops.map((workshop) => {
        const title = String(workshop?.title ?? "").trim();

        if (!title) {
            throw new AllocationInputError(
                "Mindestens ein Workshop hat keinen Titel."
            );
        }

        const key = normalizeKey(title);

        if (seen.has(key)) {
            throw new AllocationInputError(
                `Der Workshop-Titel „${title}“ kommt mehrfach vor (Groß-/Kleinschreibung und Leerzeichen werden ignoriert). Bitte Titel eindeutig machen.`
            );
        }

        seen.add(key);

        const maxParticipants = Number(workshop.maxParticipants);

        if (!Number.isInteger(maxParticipants) || maxParticipants < 1) {
            throw new AllocationInputError(
                `Der Workshop „${title}“ hat keine gültige maximale Teilnehmerzahl.`
            );
        }

        let minParticipants = Number(workshop.minParticipants ?? 0);

        if (!Number.isInteger(minParticipants) || minParticipants < 0) {
            minParticipants = 0;
        }

        if (minParticipants > maxParticipants) {
            log.add(
                "minimum-above-maximum",
                `Workshop „${title}“: Das Minimum (${minParticipants}) ist größer als das Maximum (${maxParticipants}). Es wird auf ${maxParticipants} gesetzt.`,
                { workshop: title }
            );

            minParticipants = maxParticipants;
        }

        return { ...workshop, title, maxParticipants, minParticipants };
    });
}

function prepareSubmissions(submissions, workshopIndex, maxPreferences, log) {
    const ordered = [...(submissions ?? [])].sort(
        (a, b) => (a?.id ?? 0) - (b?.id ?? 0)
    );

    const seenNames = new Set();
    const unknownTitles = new Map();
    const prepared = [];

    for (const submission of ordered) {
        /*
         * The name is kept exactly as stored (the admin table compares the
         * stored names); only the comparison key is normalised.
         */
        const name = String(submission?.name ?? "");

        if (!name.trim()) {
            log.add(
                "submission-without-name",
                "Eine Abgabe ohne Namen wurde übersprungen."
            );

            continue;
        }

        const nameKey = normalizeKey(name);

        if (seenNames.has(nameKey)) {
            log.add(
                "duplicate-name",
                `„${name}“ hat mehrfach abgegeben. Nur die erste Abgabe wird berücksichtigt.`,
                { participant: name }
            );

            continue;
        }

        seenNames.add(nameKey);

        const preferences = {};
        let validWishes = 0;

        PREFERENCE_KEYS.slice(0, maxPreferences).forEach((key) => {
            const value = String(submission.preferences?.[key] ?? "").trim();

            if (!value) {
                return;
            }

            const workshop = workshopIndex.get(normalizeKey(value));

            if (workshop) {
                preferences[key] = workshop.title;
                validWishes++;
            } else {
                preferences[key] = value;
                unknownTitles.set(value, (unknownTitles.get(value) ?? 0) + 1);
            }
        });

        if (validWishes === 0) {
            log.add(
                "no-valid-wishes",
                `„${name}“ hat keinen gültigen Wunsch angegeben und kann nur aufgefüllt werden.`,
                { participant: name }
            );
        }

        prepared.push({ id: submission.id, name, preferences });
    }

    for (const [title, count] of unknownTitles) {
        log.add(
            "unknown-workshop-wish",
            `Der Wunsch „${title}“ passt zu keinem Workshop (${count}×) und wird ignoriert.`,
            { workshop: title, count }
        );
    }

    return prepared;
}

function preparePredefined(predefined, workshopIndex, submissions, log) {
    if (predefined == null) {
        return [];
    }

    if (!Array.isArray(predefined)) {
        throw new AllocationInputError(
            "predefinedAllocations muss eine Liste sein."
        );
    }

    const submissionByKey = new Map(
        submissions.map((submission) => [
            normalizeKey(submission.name),
            submission,
        ])
    );

    const seen = new Set();
    const prepared = [];

    for (const entry of predefined) {
        const rawName = String(entry?.name ?? "").trim();
        const rawTitle = String(entry?.workshopTitle ?? "").trim();

        if (!rawName || !rawTitle) {
            log.add(
                "predefined-invalid",
                "Eine Vorab-Zuteilung ohne Name oder Workshop wurde ignoriert."
            );

            continue;
        }

        const workshop = workshopIndex.get(normalizeKey(rawTitle));

        if (!workshop) {
            log.add(
                "predefined-workshop-missing",
                `Vorab-Zuteilung für „${rawName}“: Den Workshop „${rawTitle}“ gibt es nicht. Die Person wird normal zugeteilt.`,
                { participant: rawName, workshop: rawTitle }
            );

            continue;
        }

        const nameKey = normalizeKey(rawName);

        if (seen.has(nameKey)) {
            log.add(
                "predefined-duplicate",
                `„${rawName}“ ist mehrfach vorab zugeteilt. Nur die erste Zuteilung gilt.`,
                { participant: rawName }
            );

            continue;
        }

        seen.add(nameKey);

        prepared.push({
            name: submissionByKey.get(nameKey)?.name ?? rawName,
            workshopTitle: workshop.title,
        });
    }

    return prepared;
}

/*
 * Returns clean copies; the database objects are never modified.
 */
export function prepareInput({
    submissions,
    workshops,
    predefinedAllocations,
    maxPreferences,
    log,
}) {
    const cleanWorkshops = prepareWorkshops(workshops, log);

    const workshopIndex = new Map(
        cleanWorkshops.map((workshop) => [
            normalizeKey(workshop.title),
            workshop,
        ])
    );

    const cleanSubmissions = prepareSubmissions(
        submissions,
        workshopIndex,
        maxPreferences,
        log
    );

    const predefined = preparePredefined(
        predefinedAllocations,
        workshopIndex,
        cleanSubmissions,
        log
    );

    if (cleanSubmissions.length === 0 && predefined.length === 0) {
        log.add(
            "no-submissions",
            "Es liegen keine Präferenzen vor. Es kann niemand zugeteilt werden."
        );
    }

    return {
        submissions: cleanSubmissions,
        workshops: cleanWorkshops,
        predefined,
    };
}

/*
 * Checks that depend on the number of days.
 */
export function checkCapacity({
    submissions,
    workshops,
    predefined,
    numDays,
    maxPreferences,
    multiDay,
    fallback = false,
    log,
}) {
    if (multiDay && numDays > workshops.length) {
        throw new AllocationInputError(
            `Bei ${numDays} Tagen werden mindestens ${numDays} verschiedene Workshops benötigt (vorhanden: ${workshops.length}), weil niemand denselben Workshop zweimal besuchen soll.`
        );
    }

    const people = new Set([
        ...submissions.map((submission) => normalizeKey(submission.name)),
        ...predefined.map((entry) => normalizeKey(entry.name)),
    ]).size;

    const seatsPerDay = workshops.reduce(
        (sum, workshop) => sum + workshop.maxParticipants,
        0
    );

    if (seatsPerDay < people) {
        log.add(
            "not-enough-seats",
            `Es gibt nur ${seatsPerDay} Plätze für ${people} Teilnehmer${multiDay ? " pro Tag" : ""
            }. Nicht alle können zugeteilt werden.`,
            { seats: seatsPerDay, participants: people }
        );
    }

    if (multiDay && numDays > maxPreferences) {
        log.add(
            "days-exceed-wishes",
            `Es gibt ${numDays} Tage, aber nur ${maxPreferences} Wünsche pro Person. ${fallback
                ? "Fehlende Tage werden mit nicht gewünschten Workshops aufgefüllt."
                : "Mindestens " + (numDays - maxPreferences) + " Tag(e) pro Person bleiben offen und müssen manuell zugewiesen werden."
            }`,
            { severity: "warn" }
        );
    }
}
