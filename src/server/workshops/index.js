import express from "express";
import { localOnly } from "../localOnly.js";
import {
    getAllWorkshops,
    createWorkshop,
    setWorkshops,
    getWorkshopById,
    updateWorkshop,
    deleteWorkshop,
    deleteAllWorkshops
} from "../../lib/workshops.js";
import { allocateWorkshops } from "../../lib/allocation.js"

const router = express.Router();

// GET /api/workshops → list all workshops
router.get("/", async (req, res) => {
    try {
        const workshops = await getAllWorkshops();
        res.status(200).json(workshops);
    } catch (err) {
        console.error("Error fetching workshops:", err);
        res.status(500).json({ message: "Error fetching workshops" });
    }
});

// POST /api/workshops → create a new workshop
router.post("/", localOnly, async (req, res) => {
    try {
        const newWorkshop = await createWorkshop(req.body);
        res.status(201).json(newWorkshop);
    } catch (err) {
        console.error("Error creating workshop:", err);
        res.status(500).json({ message: "Error creating workshop" });
    }
});

// POST /api/workshops/import
router.post("/import", localOnly, async (req, res) => {
    try {
        const newWorkshops = req.body;

        if (!Array.isArray(newWorkshops)) {
            return res
                .status(400)
                .json({ message: "Expected an array of workshops." });
        }

        await setWorkshops(newWorkshops);
        res
            .status(200)
            .json({ message: "Workshops imported successfully." });
    } catch (error) {
        console.error("Error importing workshops:", error);
        res
            .status(error.status === 400 ? 400 : 500)
            .json({
                message:
                    error.status === 400
                        ? `Ungültige Daten: ${error.message}`
                        : "Error importing workshops.",
            });
    }
});

// POST /api/workshops/allocate
// body: { numDays, maxPreferences, forceRandom, predefinedAllocations,
//         seed?, fallback?, attempts? }
router.post("/allocate", localOnly, async (req, res) => {
    try {
        const {
            numDays = 1,
            maxPreferences = 5,
            forceRandom = false,
            predefinedAllocations = [],
            seed = null,
            fallback = false,
            attempts = 1,
        } = req.body ?? {};

        // Ranges and data problems are checked by the allocator (status 400).
        const result = await allocateWorkshops(
            Number.parseInt(numDays, 10),
            Number.parseInt(maxPreferences, 10),
            predefinedAllocations,
            Boolean(forceRandom),
            { seed, fallback: fallback === true, attempts }
        );

        res.status(200).json(result);
    } catch (error) {
        if (error.status === 400) {
            return res.status(400).json({ message: error.message });
        }

        console.error("Error during allocation:", error);
        res.status(500).json({ message: "Error during allocation." });
    }
});

// GET /api/workshops/:id
router.get("/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const workshop = await getWorkshopById(id);
        if (workshop) {
            res.status(200).json(workshop);
        } else {
            res.status(404).json({ message: "Workshop not found" });
        }
    } catch (err) {
        console.error("Error fetching workshop:", err);
        res.status(500).json({ message: "Error fetching workshop" });
    }
});

// PUT /api/workshops/:id
router.put("/:id", localOnly, async (req, res) => {
    const { id } = req.params;
    try {
        const updated = await updateWorkshop(id, req.body);
        res.status(200).json(updated);
    } catch (err) {
        console.error("Error updating workshop:", err);
        res.status(500).json({ message: "Error updating workshop" });
    }
});

// DELETE /api/workshops/:id
router.delete("/:id", localOnly, async (req, res) => {
    const { id } = req.params;
    try {
        await deleteWorkshop(id);
        res.status(204).end();
    } catch (err) {
        console.error("Error deleting workshop:", err);
        res.status(500).json({ message: "Error deleting workshop" });
    }
});

// DELETE /api/workshops → delete all workshops
router.delete("/", localOnly, async (req, res) => {
    try {
        await deleteAllWorkshops();
        res.status(200).json({ message: "Alle Einträge erfolgreich gelöscht." });
    } catch (error) {
        console.error("Fehler beim Löschen aller Einträge:", error);
        res.status(500).json({ message: "Fehler beim Löschen aller Einträge." });
    }
});

// Fallback for unsupported methods
router.all("/", (req, res) => {
    res.status(405).json({ message: "Method not allowed" });
});

export default router;
