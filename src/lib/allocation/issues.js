/*
 * Structured messages produced during an allocation.
 *
 *   { code, severity: "warn" | "info", message, ...details }
 *
 * "warnings" in the result is the list of warn-level messages as plain
 * strings, which is what the UI and the reports already consume.
 */

export class AllocationInputError extends Error {
    constructor(message) {
        super(message);

        this.name = "AllocationInputError";
        this.status = 400;
    }
}

export function createIssueLog() {
    const issues = [];

    return {
        issues,

        add(code, message, details = {}) {
            issues.push({ severity: "warn", ...details, code, message });
        },
    };
}

export function toWarnings(issues) {
    return issues
        .filter((issue) => issue.severity === "warn")
        .map((issue) => issue.message);
}
