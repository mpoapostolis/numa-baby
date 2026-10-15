// The dates of every "What's new" release — all the boot path needs to know.
//
// App decides whether to show "New" (and the dot on the newspaper) before a
// single word of news is read, yet it used to import the changelog itself, so
// every paragraph ever announced rode the bundle a parent downloads at 3am:
// each new entry made the first load heavier. The words now live only in
// changelog.ts, which only the lazy news surfaces import.
//
// Newest first. Add the id here when adding a release to changelog.ts — the
// changelog test fails until the two lists agree.

export const RELEASE_IDS: readonly string[] = [
  "2026-10-15.4",
  "2026-10-15.3",
  "2026-10-15.2",
  "2026-10-15",
  "2026-10-14",
  "2026-10-11.2",
  "2026-10-11",
  "2026-10-04",
  "2026-10-03",
  "2026-09-06",
  "2026-09-04",
  "2026-09-03",
  "2026-09-02",
  "2026-09-01",
  "2026-08-31",
  "2026-08-30",
  "2026-08-28",
  "2026-08-26",
  "2026-08-24",
];

export const LATEST_RELEASE_ID = RELEASE_IDS[0];

/** Releases this phone has not seen yet, newest first. */
export function unseenReleaseIds(seenId: string | null): readonly string[] {
  if (!seenId) return RELEASE_IDS;
  return RELEASE_IDS.filter((id) => id > seenId);
}
