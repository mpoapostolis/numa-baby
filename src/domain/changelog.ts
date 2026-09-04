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
    id: "2026-09-06",
    title: "Faster at 3am, and the theme follows your phone",
    items: [
      "The things that have to happen every day — vitamin drops, a medicine — now wait on Today until each one is ticked, and then the card is gone until tomorrow. Add yours under Settings → Every day. A tick reaches the other parent, so nobody has to ask whether it was already given, or guess.",
      "Share a picture: the month-birthday card has a share button and now says everything since day one — every feed and nappy you logged. Any day's recap can go out as a picture, Insights can send the whole week, and the paediatrician summary can go ahead to the clinic the same way.",
      "Family Sync: when the other parent is not in the room, send the invite as a link instead of holding up a QR code.",
      "The forecasts now keep score. The card is your baby’s rhythm, and under it the app says how often it has actually been right — “right 11 of the last 12 times, within 9 minutes”. A guess nobody can check is a horoscope.",
      "Last night, waiting for you in the morning: hours asleep, the longest stretch, wakings, night feeds, first feed — and one tap to send it to whoever asks how the night went.",
      "Reminders now arrive with the app closed. Until today a reminder was a timer inside the open page: close it and nothing ever rang, which for a 3am app is close to having no reminders at all. The alarm clock moved to the server — and all it is ever told is a time. Not your baby’s name, not the feed, not how long it has been.",
      "Is this normal? Under the day’s numbers, yesterday’s feeds, nappies and sleep are set against the published ranges, with the AAP or NHS page they came from. A range, never a target.",
      "Logging something that happened earlier is one tap now: Now, 15m ago, 30m ago, 1h ago sit under the time on every quick form, and “Past” on Sleep opens with both times already filled in.",
      "Every form has a way out at the bottom, next to Save, where your thumb already is — and deleting an entry no longer asks twice, because Undo was always the real safety net.",
      "The setup screen puts the form first on a phone, the date of birth looks like the date picker it is, and the first thing you log no longer summons this very card.",
      "Press and hold the app icon on your home screen for one-tap shortcuts: Nappy, Bottle, Nursing, Sleep.",
      "Appearance has a new choice, Phone: the app turns to night mode when your phone does, and back in the morning. It used to stay on whichever look it was set up in.",
      "Undo is bigger and stays on screen twice as long, and stopping a timer can be undone too — a bounce on Wake up no longer writes a zero-minute sleep.",
      "Your phone’s back gesture now closes the sounds panel, the news and the feedback form, and brings you back to Today from any tab, instead of closing the app.",
      "The app opens with a quarter less to download, the screen no longer redraws itself every minute, and a family sharing one log sends and receives less in the background.",
      "Backups always open again, however long you have been logging; an undone entry disappears from your partner’s phone too; and a phone with the wrong time can no longer plant an entry nobody can delete.",
    ],
  },
  {
    id: "2026-09-04",
    title: "Play ideas for every age",
    items: [
      "A parent asked for development activities — they're in now. Open the Guide tab and you'll find Play & development: activities matched to your baby's exact age, from tummy time and watch-and-follow in the first months to crawling games and first books near the birthday.",
      "Each card tells you why it helps, how to do it in three or four steps, and how long — with a little 2- or 5-minute timer, and a link to the AAP, CDC or NHS page it came from. Nothing here grades your baby.",
      "The cards change as your baby grows — check back after each monthly birthday for the next set.",
    ],
  },
  {
    id: "2026-09-03",
    title: "A dot when there is news",
    items: [
      "The little newspaper up top now shows a dot when something new has landed since your last look. Open it and the dot goes out — no nagging, no unread counters, just one quiet dot.",
      "Sending feedback now tells you where the answer will appear: right here, in the news. Most messages arrive without a reply address, so the update IS the reply — like this one.",
    ],
  },
  {
    id: "2026-09-02",
    title: "The sounds are back — and this time they play",
    items: [
      "White noise and lullabies returned to the Today screen. Someone wrote in missing them, so they were rebuilt properly: real audio files instead of on-the-fly synthesis, which is why they now start reliably and keep playing with the screen off.",
      "Lock-screen controls, so you can stop the sound without lighting up a dark room.",
      "Log a medicine and it becomes a button — next time you tap the name instead of typing it, and the dose comes pre-filled exactly as you last wrote it. Asked for by a parent, built the same week.",
      "A Sync now button in Family Sync: tap it and the app does a full send-and-receive right away, then tells you it finished.",
      "Temperatures can be typed in °F when your phone is set to US units.",
      "Tell another parent: a share button on the front page, Today and Settings, because the person most likely to pass this app on is you.",
    ],
  },
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
