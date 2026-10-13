/*
 * Participants reach the server over the network from their phones, the admin
 * window runs on the organiser's own machine. Everything that reads private
 * data or changes/deletes data is therefore only allowed from this machine.
 */

const LOOPBACK = new Set(["127.0.0.1", "::1", "::ffff:127.0.0.1"]);

export function isLoopback(address) {
    return LOOPBACK.has(address);
}

export function localOnly(req, res, next) {
    if (isLoopback(req.socket?.remoteAddress)) {
        return next();
    }

    return res.status(403).json({
        message: "Diese Aktion ist nur am Rechner der Organisatoren möglich.",
    });
}
