import React, { useMemo, useState } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

import { computeAllocationStats } from "../lib/allocation/stats.js";

const percent = (value) => `${Math.round(value * 100)} %`;

const STORAGE_KEY = "allocationSummaryOpen";

/*
 * Remember whether the user left the summary open. Storage can be
 * unavailable (blocked, private window), so everything is guarded.
 */
function readOpen() {
    try {
        return window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
        return false;
    }
}

function writeOpen(open) {
    try {
        window.localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
    } catch {
        // not remembered, that is fine
    }
}

/*
 * Shows how good an allocation is before it is exported. The numbers are
 * recomputed from the current allocation, so manual assignments are included.
 */
export default function AllocationSummary({ allocations, submissions }) {
    const [open, setOpen] = useState(readOpen);

    const stats = useMemo(
        () => computeAllocationStats(allocations, submissions),
        [allocations, submissions]
    );

    if (!stats) {
        return null;
    }

    const multiDay = allocations.mode === "multi-day";
    const unit = multiDay ? "Tageszuteilungen" : "Zuteilungen";

    return (
        <div className="mb-3 rounded border border-gray-200 bg-white text-xs text-gray-700">
            <button
                type="button"
                aria-expanded={open}
                onClick={() => {
                    setOpen(!open);
                    writeOpen(!open);
                }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
            >
                <span className="font-semibold">Auswertung</span>

                <span className="flex items-center gap-1 text-gray-500">
                    {!open && (
                        <span
                            className={
                                stats.unassigned.length > 0
                                    ? "text-red-600 font-semibold"
                                    : ""
                            }
                        >
                            {percent(stats.firstChoiceRate)} 1. Wahl ·{" "}
                            {stats.unassigned.length} offen
                        </span>
                    )}

                    <ExpandMoreIcon
                        fontSize="small"
                        style={{
                            transform: open ? "rotate(180deg)" : "none",
                            transition: "transform 150ms",
                        }}
                    />
                </span>
            </button>

            {open && (
                <div className="px-3 pb-3 space-y-0.5">
                    <div className="flex justify-between">
                        <span>{unit}</span>
                        <span>{stats.assignments}</span>
                    </div>

                    {stats.byRank.map((count, index) => (
                        <div key={index} className="flex justify-between">
                            <span>{index + 1}. Wahl</span>
                            <span>
                                {count}
                                {stats.assignments > 0 &&
                                    ` (${percent(count / stats.assignments)})`}
                            </span>
                        </div>
                    ))}

                    {stats.noWish > 0 && (
                        <div className="flex justify-between">
                            <span title="Zugeteilt, aber nicht in den Wünschen (z. B. von Hand)">
                                Ohne Wunsch zugeteilt
                            </span>
                            <span>
                                {stats.noWish}
                                {stats.fallback > 0 &&
                                    ` (davon aufgefüllt: ${stats.fallback})`}
                            </span>
                        </div>
                    )}

                    <div
                        className={`flex justify-between ${stats.unassigned.length > 0
                            ? "text-red-600 font-semibold"
                            : ""
                            }`}
                    >
                        <span>Nicht zugeteilt</span>
                        <span>{stats.unassigned.length}</span>
                    </div>

                    {stats.unassigned.length > 0 && (
                        <details className="mt-1">
                            <summary className="cursor-pointer text-red-600">
                                Namen anzeigen
                            </summary>

                            <ul className="mt-1 pl-4 list-disc max-h-32 overflow-y-auto">
                                {stats.unassigned.map((person) => (
                                    <li key={person.name}>
                                        {person.name}
                                        {multiDay &&
                                            ` (Tag ${person.days.join(", ")})`}
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}

                    <div className="flex justify-between">
                        <span>Freie Plätze</span>
                        <span>
                            {stats.seatsFree}/{stats.seatsTotal}
                        </span>
                    </div>

                    {stats.belowMinimum.length > 0 && (
                        <details className="mt-1">
                            <summary className="cursor-pointer text-amber-700">
                                {stats.belowMinimum.length} unter Minimum / nicht
                                durchgeführt
                            </summary>

                            <ul className="mt-1 pl-4 list-disc max-h-32 overflow-y-auto">
                                {stats.belowMinimum.map((item, index) => (
                                    <li key={index}>
                                        {item.workshop}
                                        {item.day != null && `, Tag ${item.day}`}:{" "}
                                        {item.count}/{item.min}
                                    </li>
                                ))}
                            </ul>
                        </details>
                    )}

                    {allocations.attempts > 1 && (
                        <div className="mt-1 text-gray-500">
                            Bester von {allocations.attempts} Durchläufen
                        </div>
                    )}

                    {allocations.seed != null && (
                        <div className="mt-1 text-gray-400">
                            Seed {allocations.seed}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
