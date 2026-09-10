import { app, BrowserWindow, ipcMain, Menu, shell, dialog } from "electron";
import path from "path";
import { startServer } from "../server/index.js";
import { fileURLToPath } from "url";
import { dirname } from "path";
import os from "os";
import fs from "fs";
import { loadSettings, saveSettings } from "./settings.js";
import http from "http";
import { config } from "../server/config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let win;

async function createWindow() {
    win = new BrowserWindow({
        width: 1400,
        height: 800,
        icon: path.join(__dirname, "assets/icons/win/icon.ico"),
        webPreferences: {
            preload: path.join(__dirname, "preload.js"),
            contextIsolation: true,
            nodeIntegration: false
        },
    });

    createAppMenu(win);

    if (process.env.NODE_ENV === "development") {
        win.webContents.openDevTools();
        waitForServer('http://localhost:5173/admin', () => {
            win.loadURL("http://localhost:5173/admin");
        });
    } else {
        waitForServer(`http://localhost:${config.port}/admin`, () => {
            win.loadURL(`http://localhost:${config.port}/admin`);
        });
    }
}

function waitForServer(url, callback, retries = 10, interval = 500) {
    let attempt = 0;

    const check = () => {
        http.get(url, res => {
            if (res.statusCode === 200) {
                callback();
            } else {
                retry();
            }
        }).on('error', retry);
    };

    const retry = () => {
        if (attempt++ < retries) {
            setTimeout(check, interval);
        } else {
            console.error('Server not responding after multiple attempts.');
        }
    };

    check();
}

function createAppMenu(win, hasAllocation = false) {
    const template = [
        {
            label: "Datei",
            submenu: [
                { label: "Präferenzen importieren", click: () => win.webContents.send("menu-import-preferences") },
                { label: "Präferenzen exportieren", click: () => win.webContents.send("menu-export-preferences") },
                { type: "separator" },
                { label: "Workshops importieren", click: () => win.webContents.send("menu-import-workshops") },
                { label: "Workshops exportieren", click: () => win.webContents.send("menu-export-workshops") },
                { label: "Workshops bearbeiten", click: () => win.webContents.send("menu-edit-workshops") },
                { type: "separator" },
                { label: "Teilnehmer importieren", click: () => win.webContents.send("menu-import-participants") },
                { type: "separator" },
                { label: "Einstellungen…", click: () => win.webContents.send("menu-settings") },
                { type: "separator" },
                { label: "Semera Workshops schließen", role: "quit" },
            ]
        },
        {
            label: "Zuteilungen",
            submenu: [
                { label: "Zuteilung", id: "allocate", click: () => win.webContents.send("menu-allocate")},
                { label: "Neu-Zuteilung", id: "reallocate", click: () => win.webContents.send("menu-reallocate"), enabled: hasAllocation },
                { label: "Zuweisung zurücksetzen", click: () => {win.webContents.send("menu-reset-allocation");}, enabled: hasAllocation },
                { type: "separator" },
                {
                    label: "Zuteilung speichern",
                    submenu: [
                        { label: "Speichern als HTML", click: () => win.webContents.send("menu-save-allocation-html"), enabled: hasAllocation },
                        { label: "Speichern als CSV", click: () => win.webContents.send("menu-save-allocation-csv"), enabled: hasAllocation },
                        { label: "Speichern als DOCX", click: () => win.webContents.send("menu-save-allocation-docx"), enabled: hasAllocation },
                    ],
                    enabled: hasAllocation
                }
            ]
        },
        {
            label: "Ansicht",
            submenu: [
                { label: "Ansicht aktualisieren", click: () => win.webContents.send("menu-refresh") },
                {
                    label: "Abgabe Formular öffnen…",
                    click: () => {
                        shell.openExternal(`http://localhost:${config.port}`);
                    },
                },
                { label: "Fehlende Teilnehmer…", click: () => win.webContents.send("menu-missing") },
                { label: "QR-Code…", click: () => win.webContents.send("menu-qr") }
            ]
        },
        {
            label: "Hilfe",
            submenu: [
                {
                    label: "Handbuch (PDF)",
                    click: () => {
                        const manualPath = getManualPath();
                        shell.openPath(manualPath);
                    }
                },
                { type: "separator" },
                { role: "about", label: "Über Semera Workshops" }
            ]
        }
    ];

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

function getLocalIp() {
    const nets = os.networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name]) {
            if (net.family === "IPv4" && !net.internal) {
                if (/^(192\.168|10\.|172\.(1[6-9]|2\d|3[0-1]))\./) {
                    return net.address;
                }
            }
        }
    }
    return "localhost";
}


function getManualPath() {
    if (app.isPackaged) {
        return path.join(process.resourcesPath, "manual.pdf");
    } else {
        return path.join(__dirname, "manual.pdf");
    }
}

ipcMain.handle("get-local-ip", () => {
    return getLocalIp();
});

ipcMain.handle("settings:load", () => {
    return loadSettings();
});

ipcMain.handle("settings:save", (event, newSettings) => {
    return saveSettings(newSettings);
});

ipcMain.on("allocation-state", (event, hasAllocation) => {
    createAppMenu(win, hasAllocation);
});

ipcMain.handle("import-participants-dialog", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: "Teilnehmer importieren",
        filters: [
            { name: "Unterstützte Datein", extensions: ["json", "csv"] },
            { name: "JSON", extensions: ["json"] },
            { name: "CSV", extensions: ["csv"] }
        ],
        properties: ["openFile"]
    });

    if (canceled || filePaths.length === 0) return null;

    const filePath = filePaths[0];
    const content = fs.readFileSync(filePath, "utf-8");

    return { content, path: filePath };
});

ipcMain.handle("import-preferences-dialog", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: "Präferenzen importieren",
        filters: [{ name: "JSON Datein", extensions: ["json"] }],
        properties: ["openFile"]
    });

    if (canceled || filePaths.length === 0) return null;

    // Read the file contents
    const content = fs.readFileSync(filePaths[0], "utf-8");
    return { content, path: filePaths[0] };
});

ipcMain.handle("import-workshops-dialog", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
        title: "Workshops importieren",
        filters: [{ name: "JSON Datein", extensions: ["json"] }],
        properties: ["openFile"]
    });

    if (canceled || filePaths.length === 0) return null;

    // Read the file contents
    const content = fs.readFileSync(filePaths[0], "utf-8");
    return { content, path: filePaths[0] };
});

ipcMain.on("show-context-menu", (event, data) => {
    const menu = Menu.buildFromTemplate([
        {
            label: "Zuweisen",
            click: () => {
                event.sender.send("context-assign", data);
            }
        }
    ]);

    menu.popup({
        window: BrowserWindow.fromWebContents(event.sender)
    });
});

app.whenReady().then(() => {
    startServer(config.port);
    createWindow();
});

app.setAboutPanelOptions({
    applicationName: "Semera Workshops",
    applicationVersion: app.getVersion(),
    version: "1.0.0", // optional MacOS
    copyright: "© 2026 Semera",
    credits: "Jan Schulz-Nigmann",
    iconPath: "../assets/semera_workshops_48.png",
});

app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
});

process.on("uncaughtException", (err) => {
    console.error("Uncaught exception:", err);
    app.quit();
});

process.on("unhandledRejection", (reason) => {
    console.error("Unhandled rejection:", reason);
    app.quit();
});
