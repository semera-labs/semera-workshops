import os from "os";

/*
 * --------------------------------------------------------------------------
 * Which network address do phones have to use?
 *
 * A PC often has several adapters (Wi-Fi/Ethernet, VirtualBox, WSL, Docker,
 * VPN …). Only the real LAN one can be reached from a phone. This module
 * lists all candidates, marks the ones phones cannot use, and picks the
 * best one – unless the organiser chose one explicitly.
 *
 * Pure functions: the interface table is a parameter, so this can be tested.
 * --------------------------------------------------------------------------
 */

const VIRTUAL_NAME =
    /virtualbox|vbox|vmware|vmnet|vethernet|hyper-v|wsl|docker|podman|libvirt|virbr|veth|zerotier|hamachi|wireguard|openvpn|\bvpn\b|\btap\b|tap-|\btun\b|npcap|loopback|bluetooth|isatap|teredo|pseudo|^utun|^awdl|^llw|^bridge|^br-/i;

const OVERLAY_NAME = /tailscale|zerotier|hamachi|wireguard|openvpn|\bvpn\b|\btun\b|^utun/i;

/* MAC prefixes (OUI) of virtual network cards. */
const VIRTUAL_MAC_PREFIXES = [
    "0a:00:27", // VirtualBox host-only
    "08:00:27", // VirtualBox
    "00:50:56", // VMware
    "00:0c:29", // VMware
    "00:05:69", // VMware
    "00:15:5d", // Hyper-V / WSL
    "00:1c:42", // Parallels
    "52:54:00", // KVM / libvirt
    "02:42:", // Docker
];

/* Default subnets of virtual networks. 192.168.137.x is the Windows
 * hotspot and deliberately NOT in this list. */
const VIRTUAL_SUBNETS = [/^192\.168\.56\./, /^192\.168\.99\./];

const PRIVATE_RANGE = /^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/;

function isCarrierGradeNat(address) {
    const [a, b] = address.split(".").map(Number);

    return a === 100 && b >= 64 && b <= 127;
}

export function classify(name, address, mac) {
    if (address.startsWith("169.254.")) {
        return {
            kind: "linklocal",
            reason: "Keine Adresse vom Router erhalten (169.254.x.x).",
        };
    }

    if (isCarrierGradeNat(address) || OVERLAY_NAME.test(name)) {
        return {
            kind: "vpn",
            reason: "VPN-/Overlay-Netz – Handys im WLAN erreichen es nicht.",
        };
    }

    const lowerMac = String(mac ?? "").toLowerCase();

    if (
        VIRTUAL_NAME.test(name) ||
        VIRTUAL_MAC_PREFIXES.some((prefix) => lowerMac.startsWith(prefix)) ||
        VIRTUAL_SUBNETS.some((pattern) => pattern.test(address))
    ) {
        return {
            kind: "virtual",
            reason: "Virtueller Adapter (VirtualBox, WSL, Docker …) – Handys erreichen ihn nicht.",
        };
    }

    if (PRIVATE_RANGE.test(address)) {
        return { kind: "lan", reason: null };
    }

    return {
        kind: "other",
        reason: "Keine private Adresse – vermutlich nicht das WLAN der Handys.",
    };
}

const KIND_ORDER = { lan: 0, other: 1, vpn: 2, virtual: 3, linklocal: 4 };

/*
 * [{ name, address, mac, kind, reason, usable }] best candidate first.
 */
export function listNetworkCandidates(interfaces = os.networkInterfaces()) {
    const candidates = [];

    for (const [name, addresses] of Object.entries(interfaces ?? {})) {
        for (const item of addresses ?? []) {
            if (item.family !== "IPv4" || item.internal) {
                continue;
            }

            const { kind, reason } = classify(name, item.address, item.mac);

            candidates.push({
                name,
                address: item.address,
                mac: item.mac ?? "",
                kind,
                reason,
                usable: kind === "lan" || kind === "other",
            });
        }
    }

    // Array.prototype.sort is stable: equal kinds keep the system's order.
    return candidates.sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind]);
}

/*
 * The address to put into the QR code.
 *
 *   saved       the organiser's choice (settings); used when that address
 *               still exists
 *   otherwise   the best real LAN address, or null when there is none
 */
export function pickAddress(candidates, saved = "") {
    if (saved) {
        const chosen = candidates.find((item) => item.address === saved);

        if (chosen) {
            return chosen;
        }
    }

    return (
        candidates.find((item) => item.kind === "lan") ??
        candidates.find((item) => item.kind === "other") ??
        null
    );
}
