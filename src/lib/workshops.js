import { Workshop } from "../models/workshop.js";

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

// Optional: replace all workshops with a new set
export async function setWorkshops(newWorkshops) {
    await Workshop.destroy({ where: {} });
    return await Workshop.bulkCreate(newWorkshops);
}