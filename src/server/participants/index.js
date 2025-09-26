import express from "express";
import { Participant } from "../../models/participant.js";

const router = express.Router();

// GET all participants
router.get("/", async (req, res) => {
    try {
        const participants = await Participant.findAll();
        res.status(200).json(participants);
    } catch (err) {
        console.error("Error fetching participants:", err);
        res.status(500).json({ message: "Error fetching participants" });
    }
});

// POST bulk import
router.post("/import", async (req, res) => {
    try {
        const participants = req.body;

        if (!Array.isArray(participants)) {
            return res.status(400).json({ message: "Expected array of participants" });
        }

        await Participant.destroy({ where: {} }); // wipe old
        await Participant.bulkCreate(participants);

        res.status(200).json({ message: "Participants imported successfully" });
    } catch (err) {
        console.error("Error importing participants:", err);
        res.status(500).json({ message: "Error importing participants" });
    }
});

// DELETE participant
router.delete("/:id", async (req, res) => {
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
