import express from "express";
import { localOnly } from "../localOnly.js";
import {
    getAllSubmissions,
    saveSubmission,
    saveImportedData,
    updateSubmissionById,
    deleteSubmissionById,
    deleteAllSubmissions
} from "../../lib/data.js";

const router = express.Router();

// GET /api/preferences → fetch all submissions
router.get("/", localOnly, async (req, res) => {
    try {
        const submissions = await getAllSubmissions();
        res.status(200).json(submissions);
    } catch (error) {
        console.error("Error fetching submissions:", error);
        res.status(500).json({ message: "Error fetching submissions." });
    }
});

// POST /api/preferences → save a new submission (public: used by the phones)
router.post("/", async (req, res) => {
    try {
        const newSubmission = req.body;

        if (!newSubmission?.name || !newSubmission?.preferences) {
            return res
                .status(400)
                .json({ message: "Name and preferences are required." });
        }

        const { created } = await saveSubmission(newSubmission);

        res
            .status(created ? 201 : 200)
            .json({
                message: created
                    ? "Submission saved successfully."
                    : "Submission was already saved.",
            });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ message: error.message });
        }

        console.error("Error saving submission:", error);
        res.status(500).json({ message: "Error saving submission." });
    }
});

// POST /api/import
router.post("/import", localOnly, async (req, res) => {
    try {
        const importedData = req.body;

        // Speichern der importierten Daten
        await saveImportedData(importedData);

        res.status(200).json({ message: "Daten erfolgreich importiert." });
    } catch (error) {
        console.error("Fehler beim Importieren der Daten auf dem Server:", error);
        res
            .status(error.status === 400 ? 400 : 500)
            .json({
                message:
                    error.status === 400
                        ? `Ungültige Daten: ${error.message}`
                        : "Fehler beim Importieren der Daten.",
            });
    }
});

// PUT /api/preferences/:id → update a submission
router.put("/:id", localOnly, async (req, res) => {
    const { id } = req.params;
    try {
        const updatedSubmission = req.body;

        await updateSubmissionById(id, updatedSubmission);

        res.status(200).json({ message: "Eintrag erfolgreich aktualisiert." });
    } catch (error) {
        if (error.status) {
            return res.status(error.status).json({ message: error.message });
        }

        console.error("Fehler beim Aktualisieren des Eintrags auf dem Server:", error);
        res.status(500).json({ message: "Fehler beim Aktualisieren des Eintrags." });
    }
});

// DELETE /api/preferences/:id → delete a submission
router.delete("/:id", localOnly, async (req, res) => {
    const { id } = req.params;
    try {
        await deleteSubmissionById(id);

        res.status(200).json({ message: "Eintrag erfolgreich gelöscht." });
    } catch (error) {
        console.error("Fehler beim Löschen des Eintrags auf dem Server:", error);
        res.status(500).json({ message: "Fehler beim Löschen des Eintrags." });
    }
});

// DELETE /api/preferences → delete all submissions
router.delete("/", localOnly, async (req, res) => {
    try {
        await deleteAllSubmissions();
        res.status(200).json({ message: "Alle Einträge erfolgreich gelöscht." });
    } catch (error) {
        console.error("Fehler beim Löschen aller Einträge:", error);
        res.status(500).json({ message: "Fehler beim Löschen aller Einträge." });
    }
});

// Fallback for unsupported methods
router.all("/", (req, res) => {
    res.status(405).json({ message: "Method not allowed." });
});

export default router;
