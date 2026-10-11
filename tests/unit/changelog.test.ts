import { describe, expect, it } from "vitest";
import { LATEST_RELEASE_ID, RELEASES, unseenReleases } from "@/domain/changelog";
import { LATEST_RELEASE_ID as BOOT_LATEST_ID, RELEASE_IDS, unseenReleaseIds } from "@/domain/releaseIds";

describe("RELEASES", () => {
  it("is newest first with unique, sortable ids", () => {
    const ids = RELEASES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort().reverse()).toEqual(ids);
    // A date, or a date and ".2" for a second release that day.
    for (const id of ids) expect(id).toMatch(/^\d{4}-\d{2}-\d{2}(\.\d+)?$/);
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

describe("the boot path's release ids", () => {
  // App decides whether to show "New" before a single word of news is read,
  // so the words stay in the lazy chunks and only these dates ride the boot
  // bundle. Every entry added to RELEASES must be added here too.
  it("are the changelog's ids, newest first", () => {
    expect(RELEASE_IDS).toEqual(RELEASES.map((release) => release.id));
    expect(BOOT_LATEST_ID).toBe(RELEASES[0].id);
  });

  it("name what landed after the marker", () => {
    expect(unseenReleaseIds(RELEASE_IDS[0])).toEqual([]);
    expect(unseenReleaseIds(RELEASE_IDS[1])).toEqual([RELEASE_IDS[0]]);
    expect(unseenReleaseIds(null)).toEqual(RELEASE_IDS);
  });
});
