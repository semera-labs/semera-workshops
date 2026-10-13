/*
 * --------------------------------------------------------------------------
 * Report settings
 * --------------------------------------------------------------------------
 */

const defaultReportSettings = {
    reportShowParticipantCount:
        true,

    reportShowStaff:
        true,

    reportShowRoom:
        true,
};


export async function getReportSettings() {
    try {
        if (
            window.electron?.ipcRenderer
        ) {
            const settings =
                await window.electron.ipcRenderer.invoke(
                    "settings:load"
                );

            return {
                ...defaultReportSettings,
                ...settings,
            };
        }
    } catch (error) {
        console.warn(
            "Could not load report settings:",
            error
        );
    }

    return {
        ...defaultReportSettings,
    };
}