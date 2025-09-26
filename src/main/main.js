import { app, BrowserWindow, ipcMain, Menu, shell } from "electron";
import path from "path";
import { startServer } from "../server/index.js";
import { fileURLToPath } from "url";
import { dirname } from "path";
import os from "os";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function createWindow() {
    const win = new BrowserWindow({
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
        await win.loadURL("http://localhost:5173/admin");
    } else {
        await win.loadURL("http://localhost:3001/admin");
    }
}

function createAppMenu(win) {
    const template = [
        {
            label: "File",
            submenu: [
                { label: "Import Preferences", click: () => win.webContents.send("menu-import-preferences"), enabled: false },
                { label: "Export Preferences", click: () => win.webContents.send("menu-export-preferences"), enabled: false },
                { type: "separator" },
                { label: "Import Workshops", click: () => win.webContents.send("menu-import-workshops"), enabled: false },
                { label: "Export Workshops", click: () => win.webContents.send("menu-export-workshops"), enabled: false },
                { type: "separator" },
                { label: "Import Participants", click: () => win.webContents.send("menu-import-participants"), enabled: false },
                { type: "separator" },
                { label: "Exit Semera Workshops", role: "quit" },
            ]
        },
        {
            label: "Allocation",
            submenu: [
                { label: "Allocate", id: "allocate", enabled: true, click: () => win.webContents.send("menu-allocate"), enabled: false },
                { label: "Re-allocate", id: "reallocate", enabled: false, click: () => win.webContents.send("menu-reallocate"), enabled: false },
                { type: "separator" },
                {
                    label: "Save Allocation",
                    submenu: [
                        { label: "Save as HTML", click: () => win.webContents.send("menu-save-allocation-html"), enabled: false },
                        { label: "Save as CSV", click: () => win.webContents.send("menu-save-allocation-csv"), enabled: false },
                        { label: "Save as DOCX", click: () => win.webContents.send("menu-save-allocation-docx"), enabled: false },
                    ]
                }
            ]
        },
        {
            label: "View",
            submenu: [
                { label: "Refresh View", click: () => win.webContents.send("menu-refresh"), enabled: false },
                { label: "Missing Matches…", click: () => win.webContents.send("menu-missing"), enabled: false },
                { label: "QR Code…", click: () => win.webContents.send("menu-qr"), enabled: false }
            ]
        },
        {
            label: "Tools",
            submenu: [
                { label: "Settings…", click: () => win.webContents.send("menu-settings"), enabled: false }
            ]
        },
        {
            label: "Help",
            submenu: [
                {
                    label: "Handbuch (PDF)",
                    click: () => {
                        const manualPath = path.join(process.cwd(), "manual.pdf");
                        shell.openPath(manualPath);
                    }
                },
                { type: "separator" },
                { role: "about", label: "About Semera Workshops" }
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
                if (/^(192\.168|10\.)/.test(net.address)) {
                    return net.address;
                }
            }
        }
    }
    return "localhost";
}

ipcMain.handle("get-local-ip", () => {
    return getLocalIp();
});

app.whenReady().then(() => {
    startServer(3001);
    createWindow();
});

app.setAboutPanelOptions({
    applicationName: "Semera Workshops",
    applicationVersion: app.getVersion(),
    version: "1.0.0", // optional MacOS
    copyright: "© 2025 Semera",
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
