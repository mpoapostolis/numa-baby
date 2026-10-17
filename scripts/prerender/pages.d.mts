// Types for the part of pages.mjs that TypeScript code reads. pages.mjs stays
// plain JavaScript because node runs the prerender and the build test straight
// from it; the service worker config (vite.config.ts) and the Worker
// (worker/canonical.ts) need only the list of addresses, so only that is
// declared. Import anything else from TypeScript and this file must grow first.

/** Every content page the prerender emits, as a bare slug: "guides", "newborn". */
export declare const CONTENT_SLUGS: readonly string[];
