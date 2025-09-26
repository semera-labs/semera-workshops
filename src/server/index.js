import express from "express";
import cors from "cors";
import preferences from "./preferences/index.js";
import workshops from "./workshops/index.js";
import participants from "./participants/index.js";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { initDatabase } from "../lib/initDatabase.js";

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

// Serve frontend in production
const frontendPath = path.join(__dirname, "../../dist/renderer");
app.use(express.static(frontendPath));

// Fallback: serve index.html for all non-API routes
app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(frontendPath, "index.html"));
});

export async function startServer(port = 3001) {
    await initDatabase();

    app.listen(port, "0.0.0.0", () => {
        console.log(`🚀 Server running at:`);
        console.log(`   Local:   http://localhost:${port}`);
    });
}
