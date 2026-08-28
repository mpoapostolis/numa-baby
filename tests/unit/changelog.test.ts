import { describe, expect, it } from "vitest";
import { LATEST_RELEASE_ID, RELEASES, unseenReleases } from "@/domain/changelog";

describe("RELEASES", () => {
  it("is newest first with unique, sortable ids", () => {
    const ids = RELEASES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort().reverse()).toEqual(ids);
    for (const id of ids) expect(id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("every entry says something concrete", () => {
    for (const release of RELEASES) {
      expect(release.title.length).toBeGreaterThan(10);
      expect(release.items.length).toBeGreaterThan(0);
      for (const item of release.items) expect(item.length).toBeGreaterThan(25);
    }
  });
});

describe("unseenReleases", () => {
  it("returns only what landed after the marker", () => {
    const [newest, middle] = RELEASES;
    expect(unseenReleases(newest.id)).toEqual([]);
    expect(unseenReleases(middle.id)).toEqual([newest]);
  });

  it("returns everything when nothing has been seen", () => {
    // The caller decides whether to SHOW them — a fresh install stores the
    // latest id instead, so a new arrival is never greeted with a changelog.
    expect(unseenReleases(null)).toEqual(RELEASES);
  });

  it("names the newest release", () => {
    expect(LATEST_RELEASE_ID).toBe(RELEASES[0].id);
  });
});
