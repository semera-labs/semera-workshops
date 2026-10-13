import { Submission } from "../models/submission.js";
import { Workshop } from "../models/workshop.js";
import sequelize from "./db.js";
import { httpError, importError } from "./httpError.js";
import { normalizeKey } from "./allocation/keys.js";
import { PREFERENCE_KEYS } from "./preferenceKeys.js";

export { importError };

/*
 * Writes that check for duplicates run one after another, otherwise two
 * submissions arriving at the same moment could both pass the check.
 */
let writeQueue = Promise.resolve();

function serialized(task) {
    const run = writeQueue.then(task, task);

    writeQueue = run.catch(() => { });

    return run;
}

function cleanName(value) {
    return String(value ?? "").trim().replace(/\s+/g, " ");
}

/*
 * Wishes are stored with the exact workshop title, even if the person typed
 * it with another case or extra spaces. Unknown titles are kept as written.
 */
async function cleanPreferences(preferences) {
    if (
        !preferences ||
        typeof preferences !== "object" ||
        Array.isArray(preferences)
    ) {
        throw httpError(400, "Die Wünsche fehlen oder sind ungültig.");
    }

    const workshops = await Workshop.findAll({ attributes: ["title"] });

    const titles = new Map(
        workshops.map((workshop) => [
            normalizeKey(workshop.title),
            workshop.title,
        ])
    );

    const cleaned = {};

    for (const key of PREFERENCE_KEYS) {
        const value = String(preferences[key] ?? "").trim();

        if (value) {
            cleaned[key] = titles.get(normalizeKey(value)) ?? value;
        }
    }

    return cleaned;
}

function samePreferences(a, b) {
    return PREFERENCE_KEYS.every(
        (key) => normalizeKey(a?.[key]) === normalizeKey(b?.[key])
    );
}

async function findByName(name) {
    const key = normalizeKey(name);
    const all = await Submission.findAll();

    return all.find((submission) => normalizeKey(submission.name) === key) ?? null;
}

async function assertNameFree(name, exceptId = null) {
    const existing = await Submission.findAll({ attributes: ["id", "name"] });
    const key = normalizeKey(name);

    if (
        existing.some(
            (submission) =>
                submission.id !== exceptId &&
                normalizeKey(submission.name) === key
        )
    ) {
        throw httpError(409, "Du hast deine Wünsche bereits eingereicht.");
    }
}

function translateUniqueError(error) {
    if (error?.name === "SequelizeUniqueConstraintError") {
        return httpError(409, "Du hast deine Wünsche bereits eingereicht.");
    }

    return error;
}

export async function getAllSubmissions() {
    return await Submission.findAll();
}

export function saveSubmission(newSubmission) {
    return serialized(async () => {
        const name = cleanName(newSubmission?.name);

        if (!name) {
            throw httpError(400, "Name and preferences are required.");
        }

        const preferences = await cleanPreferences(newSubmission.preferences);

        /*
         * The same person sending the same wishes again is not an error: the
         * first answer may simply have been lost on the way to the phone.
         * Different wishes under an existing name are still refused.
         */
        const existing = await findByName(name);

        if (existing) {
            if (samePreferences(existing.preferences, preferences)) {
                return { created: false };
            }

            throw httpError(409, "Du hast deine Wünsche bereits eingereicht.");
        }

        try {
            await Submission.create({ name, preferences });
        } catch (error) {
            throw translateUniqueError(error);
        }

        return { created: true };
    });
}

export function updateSubmissionById(id, updatedSubmission) {
    return serialized(async () => {
        const submission = await Submission.findByPk(id);

        if (!submission) {
            throw httpError(404, "Submission not found.");
        }

        const name = cleanName(updatedSubmission?.name);

        if (!name) {
            throw httpError(400, "Der Name darf nicht leer sein.");
        }

        const preferences = await cleanPreferences(
            updatedSubmission.preferences
        );

        await assertNameFree(name, submission.id);

        try {
            await submission.update({ name, preferences });
        } catch (error) {
            throw translateUniqueError(error);
        }
    });
}

export async function saveImportedData(newSubmissions) {
    if (!Array.isArray(newSubmissions)) {
        throw importError("Expected an array of submissions.");
    }

    const rows = newSubmissions.map((entry, index) => {
        const name = cleanName(entry?.name);
        const preferences = entry?.preferences;

        if (
            !name ||
            !preferences ||
            typeof preferences !== "object" ||
            Array.isArray(preferences)
        ) {
            throw importError(
                `Entry ${index + 1} needs a name and a preferences object.`
            );
        }

        return { name, preferences };
    });

    const seen = new Set();

    for (const row of rows) {
        const key = normalizeKey(row.name);

        if (seen.has(key)) {
            throw importError(`„${row.name}“ kommt mehrfach vor.`);
        }

        seen.add(key);
    }

    // Replace everything in one transaction: if anything fails the old data stays.
    await sequelize.transaction(async (transaction) => {
        await Submission.destroy({ where: {}, transaction });
        await Submission.bulkCreate(rows, { transaction });
    });
}

export async function deleteSubmissionById(id) {
    try {
        const submission = await Submission.findByPk(id);

        if (submission) {
            await submission.destroy();
            console.log(`Submission with ID ${id} deleted successfully.`);
        } else {
            console.error(`Submission with ID ${id} not found.`);
            throw new Error('Submission not found.');
        }
    } catch (error) {
        console.error('Error deleting submission:', error);
        throw error;
    }
}

export async function deleteAllSubmissions() {
    try {
        await Submission.destroy({ where: {}, truncate: true });
    } catch (error) {
        console.error("Error deleting all submissions:", error);
        throw error;
    }
}