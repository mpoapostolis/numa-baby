// "What's new" — so a parent who opened this app yesterday finds out that the
// thing they wanted quietly appeared.
//
// Local-first like everything else: the list lives in the bundle, and the
// only stored state is which release this phone has already seen. Newest
// first; `id` is the sort key and the marker, so it must never be reused.
//
// One rule: a FRESH install shows nothing. Everything is new to someone who
// just arrived, and greeting them with a changelog is noise, not news.

export type Release = {
  /** ISO date, and the marker stored once this entry has been read. */
  id: string;
  title: string;
  items: string[];
};

export const RELEASES: Release[] = [
  {
    id: "2026-08-28",
    title: "Milk against weight, and losing a phone safely",
    items: [
      "Insights now shows the usual daily milk range for your baby’s own weight, with your typical day marked in it.",
      "You can sign a lost phone out of Family Sync — before, leaving only ever stopped the phone doing the leaving.",
      "A message button on the main screen: tell me what’s broken or missing.",
    ],
  },
  {
    id: "2026-08-26",
    title: "The log started answering back",
    items: [
      "Insights turns your own entries into a few plain suggestions, each with the page it came from.",
      "The Guide opens with what to do today for your baby’s exact age, and a standing “when to call someone” list.",
      "A 14-day line for milk, feeds, wet and dirty — the question a single day can’t answer.",
    ],
  },
  {
    id: "2026-08-24",
    title: "Both phones, one log",
    items: [
      "Family Sync: show a QR, the other phone scans it with its plain camera, and you share one log.",
      "A daily recap with arrows to walk back through past days.",
      "Burping is now a stopwatch for the stretch after a feed. Sleep tracking was retired — old sleep entries are still in your Timeline.",
    ],
  },
];

/** Releases this phone has not seen yet, newest first. */
export function unseenReleases(seenId: string | null): Release[] {
  if (!seenId) return RELEASES;
  return RELEASES.filter((release) => release.id > seenId);
}

export const LATEST_RELEASE_ID = RELEASES[0].id;
