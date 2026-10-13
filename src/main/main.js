import {
    app,
    BrowserWindow,
    ipcMain,
    Menu,
    shell,
    dialog,
} from "electron";

import path from "path";
import net from "net";
import {
    startServer,
    restartServer,
    refreshBonjour,
} from "../server/index.js";
import { fileURLToPath } from "url";
import { dirname } from "path";
import fs from "fs";
import { loadSettings, saveSettings } from "./settings.js";
import { listNetworkCandidates, pickAddress } from "../lib/network.js";
import http from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/*
 * --------------------------------------------------------------------------
 * Configuration
 * --------------------------------------------------------------------------
 *
 * Runtime configuration must live in Electron's userData directory.
 *
 * Development example:
 * C:\Users\<name>\AppData\Roaming\Semera Workshops\config.json
 *
 * Release builds use their own corresponding userData directory.
 */

const configPath = path.join(
    app.getPath("userData"),
    "config.json"
);

const defaultConfig = {
    port: 80,
    host: "0.0.0.0",
};

function saveConfig(config) {
    const normalizedConfig = {
        ...defaultConfig,
        ...config,
        port:
            Number.parseInt(config?.port, 10) ||
            defaultConfig.port,
    };

    try {
        fs.writeFileSync(
            configPath,
            JSON.stringify(normalizedConfig, null, 2),
            "utf-8"
        );
    } catch (err) {
        console.error(
            "Failed to save config.json:",
            err
        );
        throw err;
    }
}

function getConfig() {
    try {
        if (!fs.existsSync(configPath)) {
            saveConfig(defaultConfig);

            return {
                ...defaultConfig,
            };
        }

        const content = fs.readFileSync(
            configPath,
            "utf-8"
        );

        const parsed = JSON.parse(content);

        return {
            ...defaultConfig,
            ...parsed,
            port:
                Number.parseInt(parsed?.port, 10) ||
                defaultConfig.port,
        };
    } catch (err) {
        console.error(
            "Failed to read config.json, falling back to default:",
            err
        );

        return {
            ...defaultConfig,
        };
    }
}

console.log(
    "USER DATA PATH:",
    app.getPath("userData")
);

console.log(
    "CONFIG PATH:",
    configPath
);

/*
 * --------------------------------------------------------------------------
 * Window
 * --------------------------------------------------------------------------
 */

let win = null;

async function createWindow() {
    win = new BrowserWindow({
        width: 1400,
        height: 800,

        icon: path.join(
            __dirname,
            "assets/icons/win/icon.ico"
        ),

        webPreferences: {
            preload: path.join(
                __dirname,
                "preload.js"
            ),

            contextIsolation: true,
            nodeIntegration: false,
        },
    });

    createAppMenu(win);

    if (
        process.env.NODE_ENV ===
        "development"
    ) {
        win.webContents.openDevTools();

        try {
            await waitForServer(
                "http://localhost:5173/admin"
            );

            await win.loadURL(
                "http://localhost:5173/admin"
            );
        } catch (err) {
            console.error(
                "Vite dev server did not become ready:",
                err
            );
        }
    } else {
        const { port } = getConfig();

        const adminUrl =
            `http://localhost:${port}/admin`;

        try {
            await waitForServer(adminUrl);

            await win.loadURL(adminUrl);
        } catch (err) {
            console.error(
                "Application server did not become ready:",
                err
            );
        }
    }
}

/*
 * --------------------------------------------------------------------------
 * Wait for HTTP server
 * --------------------------------------------------------------------------
 */

function waitForServer(
    url,
    retries = 20,
    interval = 250
) {
    return new Promise(
        (resolve, reject) => {
            let attempt = 0;
            let finished = false;

            const retry = () => {
                if (finished) {
                    return;
                }

                if (attempt++ < retries) {
                    setTimeout(
                        check,
                        interval
                    );
                } else {
                    finished = true;

                    reject(
                        new Error(
                            `Server not responding at ${url}`
                        )
                    );
                }
            };

            const check = () => {
                if (finished) {
                    return;
                }

                const request =
                    http.get(
                        url,
                        res => {
                            res.resume();

                            if (
                                res.statusCode &&
                                res.statusCode >=
                                200 &&
                                res.statusCode <
                                400
                            ) {
                                finished = true;
                                resolve();
                                return;
                            }

                            retry();
                        }
                    );

                request.once(
                    "error",
                    retry
                );

                request.setTimeout(
                    2000,
                    () => {
                        request.destroy();
                    }
                );
            };

            check();
        }
    );
}

/*
 * --------------------------------------------------------------------------
 * Application menu
 * --------------------------------------------------------------------------
 */

function createAppMenu(
    win,
    hasAllocation = false
) {
    const template = [
        {
            label: "Datei",

            submenu: [
                {
                    label:
                        "Präferenzen importieren",

                    click: () =>
                        win.webContents.send(
                            "menu-import-preferences"
                        ),
                },

                {
                    label:
                        "Präferenzen exportieren",

                    click: () =>
                        win.webContents.send(
                            "menu-export-preferences"
                        ),
                },

                {
                    type: "separator",
                },

                {
                    label:
                        "Workshops importieren",

                    click: () =>
                        win.webContents.send(
                            "menu-import-workshops"
                        ),
                },

                {
                    label:
                        "Workshops exportieren",

                    click: () =>
                        win.webContents.send(
                            "menu-export-workshops"
                        ),
                },

                {
                    label:
                        "Workshops bearbeiten",

                    click: () =>
                        win.webContents.send(
                            "menu-edit-workshops"
                        ),
                },

                {
                    type: "separator",
                },

                {
                    label:
                        "Teilnehmer importieren",

                    click: () =>
                        win.webContents.send(
                            "menu-import-participants"
                        ),
                },

                {
                    label:
                        "Teilnehmer exportieren",

                    click: () =>
                        win.webContents.send(
                            "menu-export-participants"
                        ),
                },

                {
                    type: "separator",
                },

                {
                    label:
                        "Alles als Excel exportieren…",

                    click: () =>
                        win.webContents.send(
                            "menu-export-excel"
                        ),
                },

                {
                    type: "separator",
                },

                {
                    label: "Einstellungen…",

                    click: () =>
                        win.webContents.send(
                            "menu-settings"
                        ),
                },

                {
                    type: "separator",
                },

                {
                    label:
                        "Semera Workshops schließen",

                    role: "quit",
                },
            ],
        },

        {
            label: "Zuteilungen",

            submenu: [
                {
                    label: "Zuteilung",
                    id: "allocate",

                    click: () =>
                        win.webContents.send(
                            "menu-allocate"
                        ),
                },

                {
                    label:
                        "Zuweisung zurücksetzen",

                    click: () => {
                        win.webContents.send(
                            "menu-reset-allocation"
                        );
                    },

                    enabled:
                        hasAllocation,
                },

                {
                    type: "separator",
                },

                {
                    label:
                        "Zuteilung speichern",

                    submenu: [
                        {
                            label:
                                "Speichern als HTML",

                            click: () =>
                                win.webContents.send(
                                    "menu-save-allocation-html"
                                ),

                            enabled:
                                hasAllocation,
                        },

                        {
                            label:
                                "Speichern als CSV",

                            click: () =>
                                win.webContents.send(
                                    "menu-save-allocation-csv"
                                ),

                            enabled:
                                hasAllocation,
                        },

                        {
                            label:
                                "Speichern als Excel",

                            click: () =>
                                win.webContents.send(
                                    "menu-save-allocation-xlsx"
                                ),

                            enabled:
                                hasAllocation,
                        },

                        {
                            label:
                                "Speichern als DOCX",

                            click: () =>
                                win.webContents.send(
                                    "menu-save-allocation-docx"
                                ),

                            enabled:
                                hasAllocation,
                        },
                    ],

                    enabled:
                        hasAllocation,
                },
            ],
        },

        {
            label: "Ansicht",

            submenu: [
                {
                    label:
                        "Ansicht aktualisieren",

                    click: () =>
                        win.webContents.send(
                            "menu-refresh"
                        ),
                },

                {
                    label:
                        "Abgabe Formular öffnen…",

                    click: () => {
                        const currentPort =
                            getConfig().port;

                        shell.openExternal(
                            `http://localhost:${currentPort}`
                        );
                    },
                },

                {
                    label:
                        "Fehlende Teilnehmer…",

                    click: () =>
                        win.webContents.send(
                            "menu-missing"
                        ),
                },

                {
                    label: "QR-Code…",

                    click: () =>
                        win.webContents.send(
                            "menu-qr"
                        ),
                },
            ],
        },

        {
            label: "Hilfe",

            submenu: [
                {
                    label:
                        "Handbuch (PDF)",

                    click: () => {
                        const manualPath =
                            getManualPath();

                        shell.openPath(
                            manualPath
                        );
                    },
                },

                {
                    type: "separator",
                },

                {
                    role: "about",
                    label:
                        "Über Semera Workshops",
                },
            ],
        },
    ];

    const menu =
        Menu.buildFromTemplate(
            template
        );

    Menu.setApplicationMenu(menu);
}

/*
 * --------------------------------------------------------------------------
 * LAN IP
 * --------------------------------------------------------------------------
 */

function getLocalIp() {
    const chosen =
        pickAddress(
            listNetworkCandidates(),
            loadSettings().networkAddress
        );

    return chosen?.address ?? "localhost";
}

/*
 * --------------------------------------------------------------------------
 * Manual path
 * --------------------------------------------------------------------------
 */

function getManualPath() {
    if (app.isPackaged) {
        return path.join(
            process.resourcesPath,
            "manual.pdf"
        );
    }

    return path.join(
        __dirname,
        "manual.pdf"
    );
}

/*
 * --------------------------------------------------------------------------
 * IPC: Local IP
 * --------------------------------------------------------------------------
 */

ipcMain.handle(
    "get-local-ip",
    () => {
        return getLocalIp();
    }
);

/*
 * All network adapters with a note which ones phones can use, and the one
 * that is currently chosen (the organiser's choice or the best guess).
 */
ipcMain.handle(
    "network:get",
    () => {
        const candidates =
            listNetworkCandidates();

        const saved =
            loadSettings().networkAddress ?? "";

        return {
            candidates,
            saved,
            selected:
                pickAddress(candidates, saved)?.address ?? null,
            automatic:
                pickAddress(candidates)?.address ?? null,
        };
    }
);

/*
 * address "" means: choose automatically.
 */
ipcMain.handle(
    "network:select",
    (_event, address) => {
        const value =
            typeof address === "string"
                ? address
                : "";

        const known =
            value === "" ||
            listNetworkCandidates().some(
                (candidate) => candidate.address === value
            );

        if (!known) {
            return false;
        }

        const saved =
            saveSettings({
                ...loadSettings(),
                networkAddress: value,
            });

        if (saved) {
            refreshBonjour();
        }

        return saved;
    }
);

/*
 * --------------------------------------------------------------------------
 * IPC: Settings
 * --------------------------------------------------------------------------
 */

ipcMain.handle(
    "settings:load",
    () => {
        return loadSettings();
    }
);

ipcMain.handle(
    "settings:save",
    async (_event, newSettings) => {
        const saved =
            saveSettings(
                newSettings
            );

        if (!saved) {
            return false;
        }

        /*
         * Keep Bonjour state in sync
         * with the currently running
         * server.
         */
        try {
            const currentPort =
                getConfig().port;

            await fetch(
                `http://127.0.0.1:${currentPort}/api/bonjour/toggle`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",
                    },

                    body: JSON.stringify(
                        {
                            enable:
                                newSettings.enableBonjour ??
                                true,
                        }
                    ),
                }
            );
        } catch (err) {
            console.error(
                "Failed to sync Bonjour state:",
                err
            );
        }

        return true;
    }
);

/*
 * --------------------------------------------------------------------------
 * IPC: Check whether a port is free
 * --------------------------------------------------------------------------
 */

ipcMain.handle(
    "port:check",
    async (_event, requestedPort) => {
        const port =
            Number.parseInt(
                requestedPort,
                10
            );

        const currentPort =
            getConfig().port;

        if (
            !Number.isInteger(port) ||
            port < 1 ||
            port > 65535
        ) {
            return {
                available: false,
                message:
                    "Ungültige Port-Nummer",
            };
        }

        /*
         * The currently running application
         * port is valid for the application.
         */
        if (port === currentPort) {
            return {
                available: true,
                message:
                    `Port ${port} wird bereits von Semera Workshops verwendet.`,
            };
        }

        return new Promise(
            resolve => {
                const testServer =
                    net.createServer();

                testServer.once(
                    "error",
                    err => {
                        if (
                            err.code ===
                            "EADDRINUSE"
                        ) {
                            resolve({
                                available:
                                    false,

                                message:
                                    `Port ${port} wird bereits verwendet!`,
                            });
                        } else {
                            resolve({
                                available:
                                    false,

                                message:
                                    `Fehler: ${err.message}`,
                            });
                        }
                    }
                );

                testServer.once(
                    "listening",
                    () => {
                        testServer.close(
                            () => {
                                resolve({
                                    available:
                                        true,

                                    message:
                                        `Port ${port} ist frei`,
                                });
                            }
                        );
                    }
                );

                testServer.listen(
                    port,
                    "0.0.0.0"
                );
            }
        );
    }
);

/*
 * --------------------------------------------------------------------------
 * IPC: Server configuration
 * --------------------------------------------------------------------------
 */

ipcMain.handle(
    "server:get-config",
    () => {
        return getConfig();
    }
);

/*
 * --------------------------------------------------------------------------
 * IPC: Change server port
 * --------------------------------------------------------------------------
 */

ipcMain.handle(
    "server:change-port",
    async (
        _event,
        requestedPort
    ) => {
        const port =
            Number.parseInt(
                requestedPort,
                10
            );

        if (
            !Number.isInteger(port) ||
            port < 1 ||
            port > 65535
        ) {
            return {
                success: false,
                message:
                    "Ungültige Port-Nummer",
            };
        }

        const oldConfig =
            getConfig();

        const settings =
            loadSettings();

        const enableBonjour =
            settings?.enableBonjour ??
            true;

        const host =
            oldConfig.host ??
            "0.0.0.0";

        if (
            port ===
            oldConfig.port
        ) {
            return {
                success: true,
                port,
            };
        }

        try {
            console.log(
                `Changing server port from ${oldConfig.port} to ${port}`
            );

            await restartServer(
                port,
                enableBonjour,
                host
            );

            /*
             * Only persist the new port
             * after the new server started
             * successfully.
             */
            saveConfig({
                ...oldConfig,
                port,
            });

            console.log(
                `Server successfully restarted on port ${port}`
            );

            /*
             * Production renderer is served
             * by Express. Therefore the
             * BrowserWindow must move to the
             * new origin.
             *
             * Development stays on Vite 5173.
             */
            if (
                process.env.NODE_ENV !==
                "development" &&
                win &&
                !win.isDestroyed()
            ) {
                const adminUrl =
                    `http://localhost:${port}/admin`;

                await waitForServer(
                    adminUrl
                );

                await win.loadURL(
                    adminUrl
                );

                console.log(
                    `BrowserWindow moved to ${adminUrl}`
                );
            }

            return {
                success: true,
                port,
            };
        } catch (err) {
            console.error(
                "Failed to change server port:",
                err
            );

            /*
             * restartServer() may have
             * already stopped the previous
             * server. Restore it.
             */
            try {
                await restartServer(
                    oldConfig.port,
                    enableBonjour,
                    host
                );

                console.log(
                    `Restored server on port ${oldConfig.port}`
                );
            } catch (
            restoreError
            ) {
                console.error(
                    "Failed to restore previous server:",
                    restoreError
                );
            }

            return {
                success: false,

                message:
                    err?.code ===
                        "EADDRINUSE"
                        ? `Port ${port} wird bereits verwendet.`
                        : err?.message ||
                        "Server-Port konnte nicht geändert werden.",
            };
        }
    }
);

/*
 * --------------------------------------------------------------------------
 * Allocation state
 * --------------------------------------------------------------------------
 */

ipcMain.on(
    "allocation-state",
    (_event, hasAllocation) => {
        createAppMenu(
            win,
            hasAllocation
        );
    }
);

/*
 * --------------------------------------------------------------------------
 * Import dialogs
 * --------------------------------------------------------------------------
 */

ipcMain.handle(
    "import-participants-dialog",
    async () => {
        const {
            canceled,
            filePaths,
        } =
            await dialog.showOpenDialog(
                {
                    title:
                        "Teilnehmer importieren",

                    filters: [
                        {
                            name:
                                "Unterstützte Dateien",

                            extensions: [
                                "json",
                                "csv",
                            ],
                        },

                        {
                            name: "JSON",
                            extensions: [
                                "json",
                            ],
                        },

                        {
                            name: "CSV",
                            extensions: [
                                "csv",
                            ],
                        },
                    ],

                    properties: [
                        "openFile",
                    ],
                }
            );

        if (
            canceled ||
            filePaths.length === 0
        ) {
            return null;
        }

        const filePath =
            filePaths[0];

        const content =
            fs.readFileSync(
                filePath,
                "utf-8"
            );

        return {
            content,
            path: filePath,
        };
    }
);

ipcMain.handle(
    "import-preferences-dialog",
    async () => {
        const {
            canceled,
            filePaths,
        } =
            await dialog.showOpenDialog(
                {
                    title:
                        "Präferenzen importieren",

                    filters: [
                        {
                            name:
                                "JSON Dateien",

                            extensions: [
                                "json",
                            ],
                        },
                    ],

                    properties: [
                        "openFile",
                    ],
                }
            );

        if (
            canceled ||
            filePaths.length === 0
        ) {
            return null;
        }

        const content =
            fs.readFileSync(
                filePaths[0],
                "utf-8"
            );

        return {
            content,
            path: filePaths[0],
        };
    }
);

ipcMain.handle(
    "import-workshops-dialog",
    async () => {
        const {
            canceled,
            filePaths,
        } =
            await dialog.showOpenDialog(
                {
                    title:
                        "Workshops importieren",

                    filters: [
                        {
                            name:
                                "JSON Dateien",

                            extensions: [
                                "json",
                            ],
                        },
                    ],

                    properties: [
                        "openFile",
                    ],
                }
            );

        if (
            canceled ||
            filePaths.length === 0
        ) {
            return null;
        }

        const content =
            fs.readFileSync(
                filePaths[0],
                "utf-8"
            );

        return {
            content,
            path: filePaths[0],
        };
    }
);

/*
 * --------------------------------------------------------------------------
 * Context menu
 * --------------------------------------------------------------------------
 */

/*
 * data (sent by the admin page):
 *   name        participant
 *   workshop    workshop of the clicked wish cell (may be empty)
 *   multiDay    true when the allocation has several days
 *   numDays     number of days
 *   workshops   [{ title, info }] all workshops, info e.g. "5/8"
 *   assigned    [{ day, workshop }] what this person has right now
 */
ipcMain.on(
    "show-context-menu",
    (event, data) => {
        const name = String(data?.name ?? "");
        const workshop = data?.workshop ? String(data.workshop) : "";
        const multiDay = Boolean(data?.multiDay);

        const numDays = multiDay
            ? Math.min(7, Math.max(1, Number.parseInt(data?.numDays, 10) || 1))
            : 1;

        const workshops = (Array.isArray(data?.workshops) ? data.workshops : [])
            .map((item) => ({
                title: String(item?.title ?? ""),
                info: String(item?.info ?? ""),
            }))
            .filter((item) => item.title);

        const assigned = (Array.isArray(data?.assigned) ? data.assigned : [])
            .map((item) => ({
                day: Number(item?.day) || 1,
                workshop: String(item?.workshop ?? ""),
            }));

        const days = Array.from({ length: numDays }, (_, i) => i + 1);
        const current = new Map(assigned.map((item) => [item.day, item.workshop]));

        const send = (channel, payload) => event.sender.send(channel, payload);

        /*
         * One workshop: single-day assigns directly, multi-day asks for the day.
         */
        const assignItem = (title, label) =>
            multiDay
                ? {
                    label,
                    submenu: days.map((day) => {
                        const there = current.get(day);

                        return {
                            label:
                                `Tag ${day}` +
                                (there === title
                                    ? "  ✓"
                                    : there
                                        ? `  (ersetzt: ${there})`
                                        : ""),

                            click: () =>
                                send("context-assign", { name, workshop: title, day }),
                        };
                    }),
                }
                : {
                    label,
                    click: () =>
                        send("context-assign", { name, workshop: title, day: 1 }),
                };

        const template = [
            { label: name, enabled: false },
            { type: "separator" },
        ];

        if (workshop) {
            template.push(assignItem(workshop, `„${workshop}“ zuweisen`));
        }

        template.push({
            label: "Anderen Workshop zuweisen",
            enabled: workshops.length > 0,
            submenu: workshops.map((item) =>
                assignItem(
                    item.title,
                    item.info ? `${item.title}  (${item.info})` : item.title
                )
            ),
        });

        template.push({ type: "separator" });

        if (multiDay) {
            template.push({
                label: "Zuweisung aufheben",
                enabled: assigned.length > 0,
                submenu: [...assigned]
                    .sort((a, b) => a.day - b.day)
                    .map((item) => ({
                        label: `Tag ${item.day}: ${item.workshop}`,
                        click: () =>
                            send("context-unassign", { name, day: item.day }),
                    })),
            });
        } else {
            template.push({
                label: assigned[0]
                    ? `Zuweisung aufheben (${assigned[0].workshop})`
                    : "Zuweisung aufheben",
                enabled: assigned.length > 0,
                click: () => send("context-unassign", { name, day: 1 }),
            });
        }

        Menu.buildFromTemplate(template).popup({
            window: BrowserWindow.fromWebContents(event.sender),
        });
    }
);

/*
 * --------------------------------------------------------------------------
 * Bonjour check
 * --------------------------------------------------------------------------
 */

ipcMain.handle(
    "bonjour:check",
    async () => {
        try {
            const currentPort =
                getConfig().port;

            const response =
                await fetch(
                    `http://127.0.0.1:${currentPort}/api/bonjour/verify`
                );

            return await response.json();
        } catch (err) {
            console.error(
                "Bonjour check failed:",
                err
            );

            return {
                working: false,
                message:
                    "Server-Status konnte nicht geprüft werden",
            };
        }
    }
);

/*
 * --------------------------------------------------------------------------
 * Application startup
 * --------------------------------------------------------------------------
 */

app.whenReady().then(
    async () => {
        const settings =
            loadSettings();

        const enableBonjour =
            settings?.enableBonjour ??
            true;

        const {
            port,
            host,
        } = getConfig();

        console.log(
            "LOADED CONFIG:",
            {
                port,
                host,
            }
        );

        try {
            await startServer(
                port,
                enableBonjour,
                host
            );

            await createWindow();
        } catch (err) {
            console.error(
                "Failed to start application:",
                err
            );

            app.quit();
        }
    }
);

/*
 * --------------------------------------------------------------------------
 * About panel
 * --------------------------------------------------------------------------
 */

app.setAboutPanelOptions({
    applicationName:
        "Semera Workshops",

    applicationVersion:
        app.getVersion(),

    version: "1.0.0",

    copyright:
        "© 2026 Semera",

    credits:
        "Jan Schulz-Nigmann",

    iconPath:
        "../assets/semera_workshops_48.png",
});

/*
 * --------------------------------------------------------------------------
 * Window lifecycle
 * --------------------------------------------------------------------------
 */

app.on(
    "window-all-closed",
    () => {
        if (
            process.platform !==
            "darwin"
        ) {
            app.quit();
        }
    }
);

/*
 * --------------------------------------------------------------------------
 * Error handling
 * --------------------------------------------------------------------------
 */

process.on(
    "uncaughtException",
    err => {
        console.error(
            "Uncaught exception:",
            err
        );

        app.quit();
    }
);

process.on(
    "unhandledRejection",
    reason => {
        console.error(
            "Unhandled rejection:",
            reason
        );

        app.quit();
    }
);