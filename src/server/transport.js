import express from "express";
import compression from "compression";

/*
 * What goes over the (slow, shared) Wi-Fi to the phones.
 *
 *  - gzip for everything compressible (JS, CSS, HTML, JSON)
 *  - the hashed files in /assets never change, so browsers may keep them
 *    for good; index.html is re-checked every time (a tiny 304 answer)
 *  - API answers are never cached, a phone must not see an old list
 */

const IMMUTABLE = "public, max-age=31536000, immutable";
const REVALIDATE = "no-cache";

export const NO_CACHE_HEADERS = { "Cache-Control": REVALIDATE };

export function applyTransport(app) {
    app.use(compression());

    app.use("/api", (_req, res, next) => {
        res.setHeader("Cache-Control", "no-store");
        next();
    });
}

export function rendererStatic(rendererPath) {
    return express.static(rendererPath, {
        setHeaders(res, filePath) {
            const isAsset = /[\\/]assets[\\/]/.test(filePath);

            res.setHeader("Cache-Control", isAsset ? IMMUTABLE : REVALIDATE);
        },
    });
}
