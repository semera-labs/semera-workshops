import express from "express";
import cors from "cors";
import preferences from "./preferences/index.js";
import workshops from "./workshops/index.js";
import participants from "./participants/index.js";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { initDatabase } from "../lib/initDatabase.js";
import Bonjour from "bonjour-service";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let bonjourRunning = false;

const app = express();
app.use(express.json());

// CORS for dev
app.use(cors({ origin: "http://localhost:5173" }));

// API routes
app.use("/api/preferences", preferences);
app.use("/api/workshops", workshops);
app.use("/api/participants", participants);

app.get("/admin", (req, res, next) => {
    const host = req.hostname;

    // only allow localhost or 127.0.0.1
    if (host === "localhost" || host === "127.0.0.1") {
        return next();
    }

    res.status(403).send("Forbidden: /admin is only accessible locally.");
});

// Serve frontend in production
const frontendPath = path.join(__dirname, "../../dist/renderer");
app.use(express.static(frontendPath));

// Fallback: serve index.html for all non-API routes
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
});

export async function startServer(port = 3001) {
    await initDatabase();

    app.listen(port, () => {
        console.log(`Server running at:`);
        console.log(`   Local:   http://localhost:${port}`);

        try {
            const bonjour = new Bonjour.Bonjour();
            bonjour.publish({
                name: "Semera Workshops",
                type: "http",
                port,
                txt: { app: "semera" },
                host: "semera.local",
            });

            bonjourRunning = true;
            console.log(`Bonjour service published: http://semera.local:${port}`);
        } catch (err) {
            bonjourRunning = false;
            console.error("Failed to start Bonjour service:", err);
        }
    });

    // Add this route near the bottom
    app.get("/api/status", (req, res) => {
        res.json({
            bonjourRunning,
            status: "ok",
        });
    });
}