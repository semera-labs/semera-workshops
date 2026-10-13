/*
 * Errors that carry an HTTP status so routes can answer with 400/409 instead
 * of a generic 500.
 */
export function httpError(status, message) {
    const error = new Error(message);
    error.status = status;
    return error;
}

export const importError = (message) => httpError(400, message);
