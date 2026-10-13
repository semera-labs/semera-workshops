import express from "express";
import { localOnly } from "../localOnly.js";
import { Participant } from "../../models/participant.js";
import sequelize from "../../lib/db.js";

const router = express.Router();

// GET all participants
router.get("/", localOnly, async (req, res) => {
    try {
        const participants = await Participant.findAll();
        res.status(200).json(participants);
    } catch (err) {
        console.error("Error fetching participants:", err);
        res.status(500).json({ message: "Error fetching participants" });
    }
});

// POST bulk import
router.post("/import", localOnly, async (req, res) => {
    try {
        const participants = req.body;

        if (!Array.isArray(participants)) {
            return res.status(400).json({ message: "Expected array of participants" });
        }

        const rows = participants.map((entry, index) => {
            const Vorname = String(entry?.Vorname ?? "").trim();
            const Name = String(entry?.Name ?? "").trim();

            if (!Vorname || !Name) {
                const error = new Error(
                    `Participant ${index + 1} needs a first and last name.`
                );
                error.status = 400;
                throw error;
            }

            return { Vorname, Name, Kurs: String(entry?.Kurs ?? "").trim() };
        });

        // Replace everything in one transaction: if anything fails the old list stays.
        await sequelize.transaction(async (transaction) => {
            await Participant.destroy({ where: {}, transaction });
            await Participant.bulkCreate(rows, { transaction });
        });

        res.status(200).json({ message: "Participants imported successfully" });
    } catch (err) {
        console.error("Error importing participants:", err);
        res
            .status(err.status === 400 ? 400 : 500)
            .json({
                message:
                    err.status === 400
                        ? `Ungültige Daten: ${err.message}`
                        : "Error importing participants",
            });
    }
});

// DELETE participant
router.delete("/:id", localOnly, async (req, res) => {
    try {
        const participant = await Participant.findByPk(req.params.id);
        if (!participant) return res.status(404).json({ message: "Not found" });

        await participant.destroy();
        res.status(200).json({ message: "Deleted successfully" });
    } catch (err) {
        console.error("Error deleting participant:", err);
        res.status(500).json({ message: "Error deleting participant" });
    }
});

export default router;
