/*
 * The Bonjour/mDNS announcement. Kept free of Electron so it can be tested.
 */

/*
 * The name phones can open: http://semera.local
 * Without this option the machine would only be reachable as
 * <computer name>.local, but the QR code for iPhones points to semera.local.
 */
export const BONJOUR_HOST = "semera.local";

/*
 * bonjour     a Bonjour instance
 * port        port of the HTTP server
 * getAddress  () => the IPv4 address phones can reach, or null for "all"
 */
export function publishWorkshopService(bonjour, port, getAddress) {
    const service = bonjour.publish({
        name: "Semera Workshops",
        type: "http",
        port,
        host: BONJOUR_HOST,

        /*
         * The server only listens on IPv4 (0.0.0.0); an IPv6 answer would
         * send phones to an address that refuses the connection.
         */
        disableIPv6: true,
    });

    /*
     * Announce only the address phones can reach. The library would
     * otherwise list every adapter (VirtualBox, WSL …) and a phone may try
     * the unreachable one first. Records are requested after the name check,
     * so replacing the method right after publish() is early enough.
     */
    const allRecords = service.records.bind(service);

    service.records = () => {
        const address = getAddress();

        return allRecords().filter(
            (record) =>
                record.type !== "A" || !address || record.data === address
        );
    };

    return service;
}

/*
 * The library fixes the announced addresses when it publishes. If the PC
 * gets a new address later (Wi-Fi reconnected, hotspot restarted, another
 * adapter chosen), phones would keep resolving semera.local to the old one.
 * This checks now and then and calls onChange when the address changed.
 *
 * Returns a function that stops the watching.
 */
export function watchAddress(getAddress, onChange, intervalMs = 15000) {
    let last = getAddress();

    const timer = setInterval(() => {
        const current = getAddress();

        if (current !== last) {
            last = current;
            onChange(current);
        }
    }, intervalMs);

    timer.unref?.();

    return () => clearInterval(timer);
}
