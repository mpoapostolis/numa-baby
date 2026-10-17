// One address per page, decided before anything else runs.
//
// Three ways a page could be reached at an address that is not its own:
//
//   http://        Plain HTTP on any of our hosts goes to https, in one hop.
//                  Only on our hosts, so never on localhost: `wrangler dev`
//                  listens on plain HTTP, and a redirect there would send the
//                  developer to production. (When it hands the Worker the
//                  first route's address instead, it does so over https — the
//                  default dev.upstream_protocol — so that does not trigger
//                  it either.)
//   www.           Registered only to catch typing; everything lives at the
//                  apex.
//   *.workers.dev  The old address. It keeps serving THE APP — every family
//                  who installed it before numalog.app existed has their log
//                  in that origin's storage, and a redirect moves the page but
//                  not localStorage (README, "Moving to a new domain"). So
//                  "/", /handoff, /admin, /api, the assets and any address the
//                  app itself might be opened at (a notification can open
//                  /insights) all stay. What moves is only the prerendered
//                  content pages, which hold no one's data: two copies of each
//                  were two addresses competing for one search result.
//
// The content list is the prerender's own (CONTENT_SLUGS), so a page added
// there is redirected here with no second list to forget.

import { CONTENT_SLUGS } from "../scripts/prerender/pages.mjs";

const APEX = "numalog.app";

/** "/guides", "/guides.html" and "/guides/" → "guides"; anything else → null. */
function contentSlug(pathname: string): string | null {
  const match = /^\/([a-z0-9-]+)(?:\.html)?\/?$/.exec(pathname);
  return match && CONTENT_SLUGS.includes(match[1]) ? match[1] : null;
}

/** Where a request should be sent instead, or null to serve it here. */
export function canonicalRedirect(url: URL): string | null {
  const host = url.hostname;
  const workersDev = host.endsWith(".workers.dev");
  const ours = host === APEX || host === `www.${APEX}` || workersDev;
  if (!ours) return null;

  // A content page on the old address goes straight to its canonical form on
  // the apex — https, no .html, no trailing slash — in the same single hop.
  const slug = workersDev ? contentSlug(url.pathname) : null;
  if (slug) return `https://${APEX}/${slug}${url.search}`;

  if (url.protocol === "http:" || host === `www.${APEX}`) {
    const next = new URL(url);
    next.protocol = "https:";
    if (host === `www.${APEX}`) next.hostname = APEX;
    return next.toString();
  }
  return null;
}
