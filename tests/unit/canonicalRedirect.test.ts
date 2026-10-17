import { describe, expect, it } from "vitest";
import { CONTENT_SLUGS } from "../../scripts/prerender/pages.mjs";
import { canonicalRedirect } from "../../worker/canonical";

// The old workers.dev address is where every early family's log lives, in
// that origin's storage. Only pages that hold no one's data may leave it.
const OLD = "https://numa-baby.mpoapostolis.workers.dev";
const at = (href: string) => canonicalRedirect(new URL(href));

describe("canonicalRedirect", () => {
  it("sends every content page on workers.dev to the same page on the apex, in one hop", () => {
    for (const slug of CONTENT_SLUGS) {
      expect(at(`${OLD}/${slug}`)).toBe(`https://numalog.app/${slug}`);
      expect(at(`${OLD}/${slug}.html`)).toBe(`https://numalog.app/${slug}`);
      expect(at(`http://numa-baby.mpoapostolis.workers.dev/${slug}`)).toBe(`https://numalog.app/${slug}`);
    }
    expect(at(`${OLD}/newborn?via=share`)).toBe("https://numalog.app/newborn?via=share");
  });

  it("leaves the app on workers.dev exactly where its families' data is", () => {
    for (const path of [
      "/", "/?log=diaper", "/handoff", "/handoff#to=https://numalog.app", "/admin", "/api/sync/pull",
      "/api/family/join", "/insights", "/timeline", "/sw.js", "/assets/index-abc.js",
      "/manifest.webmanifest", "/sitemap.xml", "/guidesx", "/guides/extra", "/404",
    ]) {
      expect(at(`${OLD}${path}`), path).toBeNull();
    }
  });

  it("upgrades plain HTTP on our hosts, and folds www into the apex", () => {
    expect(at("http://numalog.app/guides")).toBe("https://numalog.app/guides");
    expect(at("http://numalog.app/?via=x")).toBe("https://numalog.app/?via=x");
    expect(at("http://www.numalog.app/newborn")).toBe("https://numalog.app/newborn");
    expect(at("https://www.numalog.app/")).toBe("https://numalog.app/");
    expect(at(`http://numa-baby.mpoapostolis.workers.dev/`)).toBe(`${OLD}/`);
  });

  it("serves the canonical address itself, and never touches a development host", () => {
    expect(at("https://numalog.app/")).toBeNull();
    expect(at("https://numalog.app/guides")).toBeNull();
    expect(at("https://numalog.app/api/sync/pull")).toBeNull();
    for (const href of ["http://localhost:8787/", "http://localhost:8787/guides", "http://127.0.0.1:8787/newborn", "http://[::1]:8787/"]) {
      expect(at(href), href).toBeNull();
    }
  });
});
