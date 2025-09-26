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
        console.log(`🚀 Server running at:`);
        console.log(`   Local:   http://localhost:${port}`);

        // Advertise via Bonjour (mDNS)
        const bonjour = new Bonjour.Bonjour();
        bonjour.publish({
            name: "Semera Workshops", // Friendly name shown in network
            type: "http",             // Protocol (http, https, tcp, etc.)
            port,                     // Must match your Express port
            txt: { app: "semera" },    // Optional metadata
            host: "semera.local"
        });

        console.log(`Bonjour service published: http://semera.local:${port}`);
    });
}
