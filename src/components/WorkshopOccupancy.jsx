import React, { useState } from "react";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";

/*
 * Seats taken per workshop.
 *
 * counts: { [title]: { count, max, overfilled, days: null | [{ day, count, max, overfilled, under }] } }
 *
 * Single-day: one line per workshop.
 * Multi-day:  one collapsible block per workshop (collapsed by default,
 *             because 7 workshops x 7 days is a long list).
 */
export default function WorkshopOccupancy({ counts, multiDay }) {
    const [expanded, setExpanded] = useState(() => new Set());

    const titles = Object.keys(counts);

    if (titles.length === 0) {
        return null;
    }

    const allOpen = titles.every((title) => expanded.has(title));

    const toggle = (title) =>
        setExpanded((previous) => {
            const next = new Set(previous);

            if (next.has(title)) {
                next.delete(title);
            } else {
                next.add(title);
            }

            return next;
        });

    if (!multiDay) {
        return (
            <div>
                {titles.map((title) => {
                    const info = counts[title];

                    return (
                        <div
                            key={title}
                            className={`flex justify-between gap-2 py-2 text-sm border-b border-gray-200 last:border-b-0 ${info.overfilled ? "text-red-600 font-bold" : ""
                                }`}
                        >
                            <span className="font-medium break-words">{title}</span>

                            <span className="font-semibold shrink-0">
                                {info.count}/{info.max || "-"}
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-end mb-1">
                <button
                    type="button"
                    className="text-xs text-blue-700 hover:underline"
                    onClick={() =>
                        setExpanded(allOpen ? new Set() : new Set(titles))
                    }
                >
                    {allOpen ? "Alle einklappen" : "Alle ausklappen"}
                </button>
            </div>

            {titles.map((title) => {
                const info = counts[title];
                const days = info.days ?? [];
                const open = expanded.has(title);

                const perDay = days.map((day) => day.count);
                const lowest = perDay.length ? Math.min(...perDay) : 0;
                const highest = perDay.length ? Math.max(...perDay) : 0;
                const anyUnder = days.some((day) => day.under);

                return (
                    <div
                        key={title}
                        className="border-b border-gray-200 last:border-b-0"
                    >
                        <button
                            type="button"
                            aria-expanded={open}
                            onClick={() => toggle(title)}
                            className={`w-full flex items-center justify-between gap-2 py-2 text-left text-sm ${info.overfilled ? "text-red-600 font-bold" : ""
                                }`}
                        >
                            <span className="font-medium break-words">{title}</span>

                            <span className="flex items-center gap-1 shrink-0">
                                <span
                                    className={`text-xs ${!info.overfilled && anyUnder
                                            ? "text-amber-700"
                                            : "text-gray-500"
                                        }`}
                                    title="Teilnehmer pro Tag (niedrigster bis höchster Wert)"
                                >
                                    {lowest === highest
                                        ? lowest
                                        : `${lowest}–${highest}`}
                                    /{info.max || "-"}
                                </span>

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
                            <div className="pb-2 space-y-1">
                                {days.length > 0 ? (
                                    days.map((day) => (
                                        <div
                                            key={day.day}
                                            className={`flex justify-between text-xs pl-3 ${day.overfilled
                                                    ? "text-red-600 font-bold"
                                                    : day.under
                                                        ? "text-amber-700"
                                                        : "text-gray-600"
                                                }`}
                                        >
                                            <span>Tag {day.day}</span>

                                            <span>
                                                {day.count}/{day.max || "-"}
                                            </span>
                                        </div>
                                    ))
                                ) : (
                                    <div className="text-xs text-gray-400 pl-3">
                                        Keine Tagesdaten
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
