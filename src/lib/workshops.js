import { Workshop } from "../models/workshop.js";
import sequelize from "./db.js";
import { importError } from "./httpError.js";

export async function getAllWorkshops() {
    return await Workshop.findAll();
}

export async function getWorkshopById(id) {
    return await Workshop.findByPk(id);
}

export async function createWorkshop(data) {
    const workshop = await Workshop.create({
        title: data.title,
        maxParticipants: data.maxParticipants,
        minParticipants: data.minParticipants,
        staff: data.staff,
        location: data.location,
    });
    return workshop;
}

export async function updateWorkshop(id, data) {
    const workshop = await Workshop.findByPk(id);
    if (!workshop) return null;

    await workshop.update({
        title: data.title,
        maxParticipants: data.maxParticipants,
        minParticipants: data.minParticipants,
        staff: data.staff,
        location: data.location,
    });

    return workshop;
}

export async function deleteWorkshop(id) {
    const workshop = await Workshop.findByPk(id);
    if (!workshop) return null;

    await workshop.destroy();
    return workshop;
}

export async function deleteAllWorkshops() {
    try {
        await Workshop.destroy({ where: {}, truncate: true });
    } catch (error) {
        console.error("Error deleting all workshops:", error);
        throw error;
    }
}

// Replace all workshops with a new set (all or nothing)
export async function setWorkshops(newWorkshops) {
    if (!Array.isArray(newWorkshops)) {
        throw importError("Expected an array of workshops.");
    }

    const toCount = (value, fallback) => {
        const number = Number.parseInt(value, 10);
        return Number.isInteger(number) && number >= 0 ? number : fallback;
    };

    const rows = newWorkshops.map((entry, index) => {
        const title = String(entry?.title ?? "").trim();
        const maxParticipants = toCount(entry?.maxParticipants, null);

        if (!title || maxParticipants == null || maxParticipants < 1) {
            throw importError(
                `Workshop ${index + 1} needs a title and a maximum of at least 1.`
            );
        }

        return {
            title,
            maxParticipants,
            minParticipants: toCount(entry?.minParticipants, 0),
            staff: String(entry?.staff ?? ""),
            location: String(entry?.location ?? entry?.room ?? ""),
        };
    });

    return await sequelize.transaction(async (transaction) => {
        await Workshop.destroy({ where: {}, transaction });
        return await Workshop.bulkCreate(rows, { transaction });
    });
}
