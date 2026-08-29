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
    id: "2026-09-01",
    title: "Twenty pairs of eyes went over this app",
    items: [
      "A running timer now stays in the tile that started it — no more hunting for the clock you just started.",
      "You can log a sleep or a nappy change that already happened. Before, you had to have pressed a button at the time.",
      "Forms tell you why when they refuse something. They used to just sit there.",
      "One nursing session can be both sides. It was one or the other, which made every both-sides feed look like two.",
      "Medicine has somewhere to live, so “did you already give it” has an answer.",
      "Ounces, pounds and inches — pick US units in Settings and every screen speaks them. Your entries stay exactly as they are.",
      "Solids can be logged once they start — what went in, and how it went.",
      "A packing checklist for going out lives in the Guide, and “Install on this phone” lives in Settings.",
      "White noise and lullabies are gone: they never played reliably on phones, and a soother that pretends is worse than none.",
    ],
  },
  {
    id: "2026-08-31",
    title: "What is probably next, in one place",
    items: [
      "Feed, sleep and nappy forecasts now sit together in one “Coming up” card, soonest first — they used to be two rows in two different places on the screen.",
      "Nappies are forecast too, learned from your own log. They stay quiet when your changes have no steady rhythm, because a confident wrong time is worse than none.",
      "The what’s-new card marks itself read as soon as you see it, so it never greets you twice.",
    ],
  },
  {
    id: "2026-08-30",
    title: "Sleep is back — thank you for telling me",
    items: [
      "Sleep tracking and the next-sleep prediction are back. Burping stays, so you have both. Every sleep you logged before is still there and counts again.",
      "The Diaper tile shows how long since the last change, and there is now a nappy reminder in Settings.",
      "Sleep is back in the daily recap, the 14-day chart and the Timeline filter.",
    ],
  },
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
