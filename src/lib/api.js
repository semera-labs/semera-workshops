/*
 * API_BASE intentionally does NOT include
 * http:// because the existing application
 * already builds URLs like:
 *
 * http://${API_BASE}/api/workshops
 */

let API_BASE =
    window.location.host;

/*
 * Development Electron renderer:
 *
 * React/Vite:
 *   http://localhost:5173
 *
 * Express:
 *   configurable port, e.g. 80 / 81 / 8080
 *
 * Only Electron has IPC access. A phone
 * loading the public page does not.
 */
if (
    window.electron?.ipcRenderer &&
    window.location.port === "5173"
) {
    try {
        const config =
            await window.electron.ipcRenderer.invoke(
                "server:get-config"
            );

        const port =
            Number.parseInt(
                config?.port,
                10
            ) || 80;

        /*
         * Use 127.0.0.1 for the local
         * development connection.
         */
        API_BASE =
            `127.0.0.1:${port}`;
    } catch (err) {
        console.error(
            "Failed to load server configuration:",
            err
        );

        API_BASE =
            "127.0.0.1:80";
    }
}

/*
 * Packaged Electron:
 *
 * If BrowserWindow is:
 * http://localhost:81/admin
 *
 * window.location.host is:
 * localhost:81
 *
 *
 * Phone:
 *
 * If the phone opens:
 * http://192.168.178.50:81
 *
 * window.location.host is:
 * 192.168.178.50:81
 *
 * Therefore no Electron IPC is required.
 */

export default API_BASE;