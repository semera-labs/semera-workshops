/*
 * --------------------------------------------------------------------------
 * Allocation validation
 * --------------------------------------------------------------------------
 */

export function validateAllocationResult(
    allocations
) {
    if (
        !allocations ||
        typeof allocations !==
        "object"
    ) {
        throw new Error(
            "Keine Zuteilung vorhanden."
        );
    }

    if (
        ![
            "single-day",
            "multi-day",
            "random",
        ].includes(
            allocations.mode
        )
    ) {
        throw new Error(
            `Unbekannter Zuteilungsmodus: ${allocations.mode ??
            "(nicht gesetzt)"
            }`
        );
    }

    if (
        !Array.isArray(
            allocations.workshops
        )
    ) {
        throw new Error(
            "Die Zuteilung enthält keine Workshop-Liste."
        );
    }

    if (
        allocations.mode ===
        "multi-day" &&
        (
            !allocations.schedule ||
            typeof allocations.schedule !==
            "object"
        )
    ) {
        throw new Error(
            "Die Mehrtages-Zuteilung enthält keinen Zeitplan."
        );
    }

    return allocations;
}


/*
 * --------------------------------------------------------------------------
 * Workshop information
 * --------------------------------------------------------------------------
 */

export function getWorkshopInfo(
    workshop
) {
    return {
        id:
            workshop?.id,

        title:
            workshop?.title ??
            "(Unbenannter Workshop)",

        staff:
            workshop?.staff ??
            "",

        /*
         * Your current project appears to use
         * "location" for the room field.
         *
         * room is also supported for compatibility
         * with the cleaned allocator.
         */
        room:
            workshop?.location ??
            workshop?.room ??
            "",

        maxParticipants:
            workshop?.maxParticipants ??
            "-",

        minParticipants:
            workshop?.minParticipants ??
            0,
    };
}


/*
 * --------------------------------------------------------------------------
 * Information shown underneath workshop title
 * --------------------------------------------------------------------------
 */

export function buildInfoParts(
    workshop,
    participantCount,
    settings
) {
    const info =
        getWorkshopInfo(
            workshop
        );

    const parts = [];

    if (
        settings.reportShowStaff &&
        info.staff
    ) {
        parts.push(
            `Personal: ${info.staff}`
        );
    }

    if (
        settings.reportShowRoom &&
        info.room
    ) {
        parts.push(
            `Raum: ${info.room}`
        );
    }

    if (
        settings.reportShowParticipantCount &&
        participantCount != null
    ) {
        parts.push(
            `Teilnehmer: ${participantCount}/${info.maxParticipants}`
        );
    }

    return parts;
}


/*
 * --------------------------------------------------------------------------
 * HTML escaping
 * --------------------------------------------------------------------------
 */

export function escapeHtml(
    value
) {
    return String(
        value ?? ""
    )
        .replaceAll(
            "&",
            "&amp;"
        )
        .replaceAll(
            "<",
            "&lt;"
        )
        .replaceAll(
            ">",
            "&gt;"
        )
        .replaceAll(
            '"',
            "&quot;"
        )
        .replaceAll(
            "'",
            "&#039;"
        );
}


/*
 * --------------------------------------------------------------------------
 * CSV escaping
 * --------------------------------------------------------------------------
 */

export function escapeCsv(
    value
) {
    const text =
        String(
            value ?? ""
        );

    return `"${text.replaceAll(
        '"',
        '""'
    )}"`;
}


/*
 * --------------------------------------------------------------------------
 * Multi-day helper
 * --------------------------------------------------------------------------
 */

export function getScheduleWorkshops(
    allocations
) {
    if (
        allocations.mode !==
        "multi-day"
    ) {
        return [];
    }

    return Object.values(
        allocations.schedule ??
        {}
    );
}