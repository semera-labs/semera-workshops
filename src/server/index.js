import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import net from "net";
import { Bonjour } from "bonjour-service";
import { loadSettings } from "../main/settings.js";
import { localOnly } from "./localOnly.js";
import {
    NO_CACHE_HEADERS,
    applyTransport,
    rendererStatic,
} from "./transport.js";
import { publishWorkshopService, watchAddress } from "./bonjourService.js";
import {
    listNetworkCandidates,
    pickAddress,
} from "../lib/network.js";
import { clampPreferenceCount } from "../lib/preferenceKeys.js";

import preferencesRouter from "./preferences/index.js";
import workshopsRouter from "./workshops/index.js";
import participantsRouter from "./participants/index.js";

import { initDatabase } from "../lib/initDatabase.js";

const __filename =
    fileURLToPath(
        import.meta.url
    );

const __dirname =
    path.dirname(
        __filename
    );

const app =
    express();

/*
 * --------------------------------------------------------------------------
 * Runtime server state
 * --------------------------------------------------------------------------
 */

let httpServer = null;

let currentPort = 80;

let currentHost =
    "0.0.0.0";

let currentBonjourEnabled =
    true;

let bonjourInstance =
    null;

let publishedService =
    null;

let stopAddressWatch =
    null;

/*
 * --------------------------------------------------------------------------
 * Middleware
 * --------------------------------------------------------------------------
 */

app.use(
    cors({
        origin:
            process.env.NODE_ENV ===
                "development"
                ? "http://localhost:5173"
                : true,
    })
);

applyTransport(app);

app.use(
    express.json({
        // Imports of a whole class list can exceed the 100 kB default.
        limit: "5mb",
    })
);

app.use(
    express.urlencoded({
        extended: true,
    })
);

/*
 * --------------------------------------------------------------------------
 * API routes
 * --------------------------------------------------------------------------
 */

app.use(
    "/api/preferences",
    preferencesRouter
);

app.use(
    "/api/workshops",
    workshopsRouter
);

app.use(
    "/api/participants",
    participantsRouter
);


app.get("/api/public-settings", (req, res) => {
    try {
        const settings = loadSettings();

        const numPreferences = clampPreferenceCount(
            settings?.numPreferences,
            3
        );

        console.log(
            "Public settings requested:",
            {
                numPreferences,
            }
        );

        res.json({
            numPreferences,
        });
    } catch (error) {
        console.error(
            "Failed to load public settings:",
            error
        );

        res.status(500).json({
            message:
                "Failed to load settings",
        });
    }
});

/*
 * --------------------------------------------------------------------------
 * Status
 * --------------------------------------------------------------------------
 */

app.get(
    "/api/status",
    (_req, res) => {
        res.json({
            status: "ok",
            port: currentPort,
            host: currentHost,

            bonjourRunning:
                Boolean(
                    publishedService
                ),
        });
    }
);

/*
 * --------------------------------------------------------------------------
 * Server configuration
 *
 * GET only. The Electron main process owns persistence.
 * --------------------------------------------------------------------------
 */

app.get(
    "/api/config",
    (_req, res) => {
        res.json({
            port:
                currentPort,

            host:
                currentHost,

            bonjourRunning:
                Boolean(
                    publishedService
                ),
        });
    }
);

/*
 * --------------------------------------------------------------------------
 * Check port
 * --------------------------------------------------------------------------
 */

app.get(
    "/api/config/check-port",
    localOnly,
    (req, res) => {
        const port =
            Number.parseInt(
                req.query.port,
                10
            );

        if (
            !Number.isInteger(port) ||
            port < 1 ||
            port > 65535
        ) {
            return res
                .status(400)
                .json({
                    available:
                        false,

                    message:
                        "Ungültiger Port",
                });
        }

        /*
         * Our own current port is valid.
         */
        if (
            port ===
            currentPort
        ) {
            return res.json({
                available:
                    true,

                current:
                    true,
            });
        }

        const testServer =
            net.createServer();

        testServer.once(
            "error",
            err => {
                res.json({
                    available:
                        false,

                    message:
                        err.code ===
                            "EADDRINUSE"
                            ? `Port ${port} wird bereits verwendet.`
                            : err.message,
                });
            }
        );

        testServer.once(
            "listening",
            () => {
                testServer.close(
                    () => {
                        res.json({
                            available:
                                true,
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

/*
 * --------------------------------------------------------------------------
 * Bonjour
 * --------------------------------------------------------------------------
 */

/*
 * The address for the QR code and for Bonjour: the organiser's choice from the
 * settings, otherwise the best real LAN address.
 */
function advertisedAddress() {
    try {
        return (
            pickAddress(
                listNetworkCandidates(),
                loadSettings()?.networkAddress
            )?.address ?? null
        );
    } catch {
        return null;
    }
}

/*
 * Announce again, e.g. after the organiser picked another network.
 */
export function refreshBonjour() {
    if (publishedService) {
        startBonjour(currentPort);
    }
}

function startBonjour(port) {
    try {
        stopBonjour();

        bonjourInstance =
            new Bonjour();

        publishedService =
            publishWorkshopService(
                bonjourInstance,
                port,
                advertisedAddress
            );

        console.log(
            `Bonjour service published on port ${port}`
        );

        // Re-announce when the PC's network address changes.
        stopAddressWatch = watchAddress(
            advertisedAddress,
            () => startBonjour(currentPort)
        );
    } catch (err) {
        publishedService =
            null;

        bonjourInstance =
            null;

        console.error(
            "Failed to start Bonjour:",
            err
        );
    }
}

function stopBonjour() {
    try {
        if (stopAddressWatch) {
            stopAddressWatch();
            stopAddressWatch = null;
        }

        if (
            publishedService
        ) {
            try {
                publishedService.stop();
            } catch (
            serviceError
            ) {
                console.error(
                    "Failed to stop published Bonjour service:",
                    serviceError
                );
            }

            publishedService =
                null;
        }

        if (
            bonjourInstance
        ) {
            try {
                bonjourInstance.destroy();
            } catch (
            destroyError
            ) {
                console.error(
                    "Failed to destroy Bonjour instance:",
                    destroyError
                );
            }

            bonjourInstance =
                null;
        }
    } catch (err) {
        console.error(
            "Failed to stop Bonjour:",
            err
        );
    }
}

/*
 * --------------------------------------------------------------------------
 * Bonjour toggle
 * --------------------------------------------------------------------------
 */

app.post(
    "/api/bonjour/toggle",
    localOnly,
    (req, res) => {
        const enable =
            req.body?.enable ??
            true;

        currentBonjourEnabled =
            Boolean(enable);

        if (
            currentBonjourEnabled
        ) {
            startBonjour(
                currentPort
            );
        } else {
            stopBonjour();
        }

        res.json({
            success: true,

            enabled:
                currentBonjourEnabled,

            bonjourRunning:
                Boolean(
                    publishedService
                ),
        });
    }
);

/*
 * --------------------------------------------------------------------------
 * Bonjour verification
 * --------------------------------------------------------------------------
 */

app.get(
    "/api/bonjour/verify",
    localOnly,
    async (_req, res) => {
        let verifyBonjour =
            null;

        let browser =
            null;

        let found =
            false;

        try {
            verifyBonjour =
                new Bonjour();

            browser =
                verifyBonjour.find(
                    {
                        type: "http",
                    },

                    service => {
                        if (
                            service.name ===
                            "Semera Workshops"
                        ) {
                            found =
                                true;
                        }
                    }
                );

            setTimeout(
                () => {
                    try {
                        browser?.stop();
                    } catch {
                        // ignore
                    }

                    try {
                        verifyBonjour?.destroy();
                    } catch {
                        // ignore
                    }

                    if (
                        !res.headersSent
                    ) {
                        res.json({
                            working:
                                found,

                            running:
                                found,
                        });
                    }
                },
                1500
            );
        } catch (err) {
            try {
                browser?.stop();
            } catch {
                // ignore
            }

            try {
                verifyBonjour?.destroy();
            } catch {
                // ignore
            }

            console.error(
                "Bonjour verification failed:",
                err
            );

            if (
                !res.headersSent
            ) {
                res.json({
                    working:
                        false,

                    running:
                        false,

                    message:
                        err.message,
                });
            }
        }
    }
);

/*
 * --------------------------------------------------------------------------
 * Renderer
 * --------------------------------------------------------------------------
 */

const rendererPath =
    path.resolve(
        __dirname,
        "../../dist/renderer"
    );

app.use(
    rendererStatic(
        rendererPath
    )
);

/*
 * Admin UI may only be opened locally.
 */
app.get(
    "/admin",
    (req, res, next) => {
        const remoteAddress =
            req.socket.remoteAddress;

        const isLocal =
            remoteAddress ===
            "127.0.0.1" ||
            remoteAddress ===
            "::1" ||
            remoteAddress ===
            "::ffff:127.0.0.1";

        if (!isLocal) {
            return res
                .status(403)
                .send(
                    "Admin access is only available locally."
                );
        }

        const adminFile =
            path.join(
                rendererPath,
                "index.html"
            );

        res.sendFile(
            adminFile,
            { headers: NO_CACHE_HEADERS },
            err => {
                if (err) {
                    next(err);
                }
            }
        );
    }
);

/*
 * --------------------------------------------------------------------------
 * SPA fallback
 * --------------------------------------------------------------------------
 */

app.use(
    (req, res, next) => {
        /*
         * Unknown API endpoint:
         * do not return index.html.
         */
        if (
            req.path.startsWith(
                "/api/"
            )
        ) {
            return next();
        }

        const indexFile =
            path.join(
                rendererPath,
                "index.html"
            );

        res.sendFile(
            indexFile,
            { headers: NO_CACHE_HEADERS },
            err => {
                if (err) {
                    next(err);
                }
            }
        );
    }
);

/*
 * --------------------------------------------------------------------------
 * Final API 404
 * --------------------------------------------------------------------------
 */

app.use(
    (req, res) => {
        if (
            req.path.startsWith(
                "/api/"
            )
        ) {
            return res
                .status(404)
                .json({
                    error:
                        "API endpoint not found",
                });
        }

        res.status(404).send(
            "Not found"
        );
    }
);

/*
 * --------------------------------------------------------------------------
 * Start server
 * --------------------------------------------------------------------------
 */

export async function startServer(
    port = 80,
    enableBonjour = true,
    host = "0.0.0.0"
) {
    const parsedPort =
        Number.parseInt(
            port,
            10
        );

    if (
        !Number.isInteger(
            parsedPort
        ) ||
        parsedPort < 1 ||
        parsedPort > 65535
    ) {
        throw new Error(
            `Invalid server port: ${port}`
        );
    }

    if (httpServer) {
        throw new Error(
            "Server is already running. Use restartServer() to change the port."
        );
    }

    currentPort =
        parsedPort;

    currentHost =
        host ||
        "0.0.0.0";

    currentBonjourEnabled =
        Boolean(
            enableBonjour
        );

    await initDatabase();

    return new Promise(
        (resolve, reject) => {
            let settled =
                false;

            const onError =
                err => {
                    if (
                        settled
                    ) {
                        console.error(
                            "HTTP server error:",
                            err
                        );

                        return;
                    }

                    settled =
                        true;

                    httpServer =
                        null;

                    reject(err);
                };

            httpServer =
                app.listen(
                    currentPort,
                    currentHost
                );

            httpServer.once(
                "error",
                onError
            );

            httpServer.once(
                "listening",
                () => {
                    if (
                        settled
                    ) {
                        return;
                    }

                    settled =
                        true;

                    console.log(
                        `Server listening on http://${currentHost}:${currentPort}`
                    );

                    if (
                        currentBonjourEnabled
                    ) {
                        startBonjour(
                            currentPort
                        );
                    }

                    resolve(
                        httpServer
                    );
                }
            );
        }
    );
}

/*
 * --------------------------------------------------------------------------
 * Stop server
 * --------------------------------------------------------------------------
 */

export async function stopServer() {
    stopBonjour();

    if (!httpServer) {
        return;
    }

    const serverToClose =
        httpServer;

    /*
     * Clear immediately so a subsequent
     * startServer() can assign the new
     * server after close completes.
     */
    httpServer = null;

    await new Promise(
        (resolve, reject) => {
            serverToClose.close(
                err => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    resolve();
                }
            );

            /*
             * Node versions that support
             * this can proactively close
             * idle keep-alive connections.
             */
            if (
                typeof serverToClose.closeIdleConnections ===
                "function"
            ) {
                serverToClose.closeIdleConnections();
            }
        }
    );

    console.log(
        "Server stopped"
    );
}

/*
 * --------------------------------------------------------------------------
 * Restart server
 * --------------------------------------------------------------------------
 */

export async function restartServer(
    port,
    enableBonjour = true,
    host = "0.0.0.0"
) {
    await stopServer();

    return startServer(
        port,
        enableBonjour,
        host
    );
}

/*
 * --------------------------------------------------------------------------
 * Current runtime server configuration
 * --------------------------------------------------------------------------
 */

export function getServerConfig() {
    return {
        port:
            currentPort,

        host:
            currentHost,

        bonjourEnabled:
            currentBonjourEnabled,

        bonjourRunning:
            Boolean(
                publishedService
            ),

        running:
            Boolean(
                httpServer
            ),
    };
}