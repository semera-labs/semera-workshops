import express from "express";
import {
    getAllSubmissions,
    saveSubmission,
    saveImportedData,
    updateSubmissionById,
    deleteSubmissionById
} from "../../lib/data.js";

const router = express.Router();

// GET /api/preferences → fetch all submissions
router.get("/", async (req, res) => {
    try {
        const submissions = await getAllSubmissions();
        res.status(200).json(submissions);
    } catch (error) {
        console.error("Error fetching submissions:", error);
        res.status(500).json({ message: "Error fetching submissions." });
    }
});

// POST /api/preferences → save a new submission
router.post("/", async (req, res) => {
    try {
        const newSubmission = req.body;

        if (!newSubmission.name || !newSubmission.preferences) {
            return res
                .status(400)
                .json({ message: "Name and preferences are required." });
        }

        const submissions = await getAllSubmissions();
        const alreadySubmitted = submissions.some(
            (sub) => sub.name === newSubmission.name
        );

        if (alreadySubmitted) {
            return res.status(409).json({
                message: "Du hast deine Wünsche bereits eingereicht.",
            });
        }

        await saveSubmission(newSubmission);

        res.status(201).json({ message: "Submission saved successfully." });
    } catch (error) {
        console.error("Error saving submission:", error);
        res.status(500).json({ message: "Error saving submission." });
    }
});

// POST /api/import
router.post("/import", async (req, res) => {
    try {
        const importedData = req.body;

        // Speichern der importierten Daten
        await saveImportedData(importedData);

        res.status(200).json({ message: "Daten erfolgreich importiert." });
    } catch (error) {
        console.error("Fehler beim Importieren der Daten auf dem Server:", error);
        res.status(500).json({ message: "Fehler beim Importieren der Daten." });
    }
});

// PUT /api/preferences/:id → update a submission
router.put("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const updatedSubmission = req.body;

        await updateSubmissionById(id, updatedSubmission);

        res.status(200).json({ message: "Eintrag erfolgreich aktualisiert." });
    } catch (error) {
        console.error("Fehler beim Aktualisieren des Eintrags auf dem Server:", error);
        res.status(500).json({ message: "Fehler beim Aktualisieren des Eintrags." });
    }
});

// DELETE /api/preferences/:id → delete a submission
router.delete("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await deleteSubmissionById(id);

        res.status(200).json({ message: "Eintrag erfolgreich gelöscht." });
    } catch (error) {
        console.error("Fehler beim Löschen des Eintrags auf dem Server:", error);
        res.status(500).json({ message: "Fehler beim Löschen des Eintrags." });
    }
});

// Fallback for unsupported methods
router.all("/", (req, res) => {
    res.status(405).json({ message: "Method not allowed." });
});

export default router;
