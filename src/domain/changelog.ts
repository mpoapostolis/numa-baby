// "What's new" — so a parent who opened this app yesterday finds out that the
// thing they wanted quietly appeared.
//
// Local-first like everything else: the list lives in the bundle, and the
// only stored state is which release this phone has already seen. Newest
// first; `id` is the sort key and the marker, so it must never be reused.
//
// One rule: a FRESH install shows nothing. Everything is new to someone who
// just arrived, and greeting them with a changelog is noise, not news.

/** A place a release note can take the parent to — the thing it is about,
    one tap away, instead of directions to it. */
export type ReleaseAction = { label: string; to: "months" | "vaccines" | "profile" | "pump" };

export type Release = {
  /** ISO date, and the marker stored once this entry has been read. A second
      release on the same day is "2026-10-11.2": it sorts after the first, so
      a phone that already saw the morning's entry still gets this one. */
  id: string;
  title: string;
  items: string[];
  actions?: ReleaseAction[];
};

export const RELEASES: Release[] = [
  {
    id: "2026-11-10.2",
    title: "Weight in kg, and Insights over a month or a year",
    items: [
      "“I prefer using kg.” The weight field now has kg | g beside it: pick kg and type 5.48 instead of 5480. Your phone remembers the choice, and nothing already saved changes.",
      "“Could Insights show 7 days, 1 month, a year?” Insights now has 7 days, 30 days, 3 months and Year at the top. The charts, Feeds / day and Nursing by side follow your choice; over 3 months each bar is a week, over a year each bar is a month, both as the average day.",
    ],
  },
  {
    id: "2026-11-10",
    title: "Which formula, on each bottle",
    items: [
      "“I use two brands of formula. Could I enter the brand for each bottle?” Now you can: under Formula, the bottle sheet has an optional Formula brand.",
      "Write a brand once and it becomes a button, so next time it is one tap. Each bottle starts with the brand of the last one; tap the other to switch.",
      "The brand shows on the Timeline and on the Bottle tile (“120 ml · your brand”), and the tile's repeat logs the same one again.",
    ],
  },
  {
    id: "2026-11-08.3",
    title: "Nursing by side, on Insights too",
    items: [
      "Insights now has the usual day as well: about how long on the left and on the right, averaged over this week's days with nursing, with a bar that shows the split at a glance.",
      "Each single day is still on the Timeline, under its date.",
    ],
  },
  {
    id: "2026-11-08.2",
    title: "Numalog in Greek",
    items: [
      "Η εφαρμογή μιλάει πλέον ελληνικά: Ρυθμίσεις → Γλώσσα → Ελληνικά.",
      "Settings → Language now has Ελληνικά. Every screen reads in Greek, and so do the reminders on your lock screen; this News list stays in English.",
      "Nothing changes unless you choose it: the app stays in English until you pick Greek, and you can switch back at any time.",
    ],
  },
  {
    id: "2026-11-08",
    title: "Nursing time, left and right, every day",
    items: [
      "“Could it show how long she nurses on the right and on the left each day?” Now each day on the Timeline says it, under the date: “Left 1h 5m · Right 50m”.",
      "Only the sides you used appear. A session logged as both sides keeps its own figure, because nobody timed how it split.",
    ],
  },
  {
    id: "2026-11-07",
    title: "Vitamin D, counted once",
    items: [
      "“We logged Vitamin D under Medicine, then the daily reminder asked for it again, and we ended up with two entries.” Now a dose logged under Medicine also ticks it off your daily list, so the list stops asking.",
      "The other way round too: Vitamin D ticked on the daily list now shows on the Medicine row, so the time since the last dose counts from it.",
      "They are matched by name: “Vitamin D drops” under Medicine counts for “Vitamin D” on the list.",
    ],
  },
  {
    id: "2026-11-03",
    title: "Wet diapers: light, medium or heavy",
    items: [
      "After you tap Wet on Today, the Diaper card offers Light, Medium and Heavy for the next 15 minutes. Tap one to note how wet it was, or tap it again to take it back. Wet is still one tap if you skip it.",
      "The same choice is in the diaper form and when you edit a change, under “How wet”. The timeline then reads “Light wet diaper”, “Medium wet diaper” or “Heavy wet diaper”.",
      "Update the app on both phones: until then, the other phone shows these as plain “Wet diaper”.",
    ],
  },
  {
    id: "2026-10-30",
    title: "Bottle and Nursing, always both",
    items: [
      "“Nursing button is still missing” — a parent who had picked Bottle on the first day could not find it, and the way back was buried in the baby’s profile. Now Bottle and Nursing are always on Today, whatever you chose at the start.",
      "The choice still counts: if you breastfeed, Nursing comes first; otherwise Bottle does. You can change it any time in your baby’s profile.",
    ],
  },
  {
    id: "2026-10-15.4",
    title: "Pumping, and how long since the last one",
    items: [
      "Asked for by a mum who pumps with most feeds, but not all of them: Pumping has its own row on Today, right under the big buttons. It shows how long it has been since the last one — “Pumped 2h 10m ago” — counted from when that one started, the same way as the time since the last feed.",
      "Tap it when you finish: when you finished, how long, which side, and how much if you measured. Last time’s length and side are already filled in, so most of the time it is one more tap to save.",
      "There is nothing to start or stop. Your pump keeps its own time, so the app doesn’t add another timer to keep an eye on. Pumping is never counted as a feed. Update the app on both phones: until it is updated, the other phone shows a pump as “Entry”, and changing one there loses how long it took.",
      "Only giving bottles? The row appears once you log a bottle of breast milk — or log your first pump with the button below.",
    ],
    actions: [{ label: "Log a pump", to: "pump" }],
  },
  {
    id: "2026-10-15.3",
    title: "Tummy time: what is left for today",
    items: [
      "The Tummy time row on Today now says how today is going against the usual daily amount for your baby’s age: “None yet today”, “12m of 30m today · 18m to go”, or that today’s is done.",
      "The amounts are the ones in the Guide: about 10 minutes a day in short goes at first, building to 15–30 minutes a day from around 7 weeks. From around 7 months, when most babies roll both ways, it just shows the total.",
    ],
  },
  {
    id: "2026-10-15.2",
    title: "Answers to your messages, in the app",
    items: [
      "You asked how you would know I had answered. Now you will: when you write with the speech bubble, my answer comes back to the app. The bubble gets a dot with a count, and tapping it shows the whole conversation — what you wrote and what I said. You can write back from there too.",
      "Leave an email with your first message only if you would also like the answers by email. Either way they show up in the app.",
      "Messages sent before this update can be answered only by email, if you left one, or here in News — the app could not keep track of them yet.",
    ],
  },
  {
    id: "2026-10-15",
    title: "Tummy time, and a medicine you can correct",
    items: [
      "Tummy time has its own timer now, on Today, with today’s total under it — it adds up the short goes, which is how the advice counts it. Asked for by a mum who was timing it with the burping timer.",
      "Logged the wrong amount of a medicine? Open it from Today or the Timeline and change how much — or the name. Until now only the time and the note could be changed.",
      "Reminders keep their schedule: one that was already due no longer cancels the next one, and a new reminder rings even when the last is still on your lock screen.",
      "White noise keeps playing when the app updates or a call interrupts it, and a timer you pick while it plays is the one it stops on.",
      "Insights averages count whole days only, and the summary for your paediatrician compares the latest weight with the right age.",
    ],
  },
  {
    id: "2026-10-14",
    title: "Monthly photos and vaccines",
    items: [
      "Three of you asked through the chat button, and all three are here — the buttons take you straight to each one.",
      "Monthly photos: a page for every month-birthday, with a photo and a note, kept as an album you can look back through. Tap Monthly photos under your baby’s age at the top of Today — it asks for this month’s photo until there is one.",
      "Vaccines has its own row on Today, under Growth: add the next appointment from the health center or clinic card, or record one already given. One that is due this week, or late, also shows at the top of Today until you mark it given.",
      "Your baby’s profile picture: tap your baby’s face at the top of Today, or the round picture at the top right.",
      "Photos on diapers: right after you tap Dirty or Both, tap Add photo on the Diaper card — or open any diaper in the Timeline. Photos in the Timeline shows them all.",
      "Photos are made small on your phone and lose their location data before they are kept. With Family Sync they are kept in your family’s private space in the cloud so your other phones can show them — never public. Without it, they stay on this phone. Backup files carry entries, not photos.",
    ],
    actions: [
      { label: "Monthly photos", to: "months" },
      { label: "Vaccines", to: "vaccines" },
      { label: "Profile picture", to: "profile" },
    ],
  },
  {
    id: "2026-10-11.2",
    title: "Tap a day on the chart to see its total",
    items: [
      "Asked for the day the chart arrived: tap any day on it to see that day’s total — how long your baby slept, how much milk, how many nappies. Tap it again to go back to the average. On a computer, just hover.",
      "The day stays chosen when you switch category, so you can check sleep, then feeds, for the same day.",
    ],
  },
  {
    id: "2026-10-11",
    title: "Choose what to follow on Insights — sleep included",
    items: [
      "Asked for through the feedback box: Insights now has the day-by-day chart, and you pick what it shows — milk, feeds, wet or dirty nappies, or sleep. Choose Sleep to see how much your baby slept each day over the last two weeks, against the average.",
      "The app remembers your pick. Choose Sleep once and the chart opens on Sleep next time, here and on Today.",
    ],
  },
  {
    id: "2026-10-04",
    title: "The white noise no longer pauses every few seconds",
    items: [
      "Thank you for writing back about the pause — you were right. Each noise was an eight-second recording on repeat, and a phone leaves a split-second gap every time it starts a sound over.",
      "Each noise now runs ten minutes before it repeats, so that gap comes once every ten minutes instead of every eight seconds. Rumble also lost a faint click it had at every repeat.",
    ],
  },
  {
    id: "2026-10-03",
    title: "Missed a tap? Fix the time. And sounds that keep going",
    items: [
      "Two of you asked for these through the feedback box — thank you, both are in.",
      "Forgot to tap Sleep, or Wake up? While a timer is running, tap “Started 21:40 · Edit” under the clock: move the start back to when it really began, or fill in when the baby actually woke.",
      "For a feed, nappy or sleep you never logged at all, tap “Earlier” in the corner of its card (it used to say “Past”) and set the times. A bottle’s time is under “Change”.",
      "The sounds no longer stop when you switch tabs. Checking the timeline for the last feed used to silence the white noise — now it plays on.",
      "The sounds panel remembers what you played last. Pick “Keep going” once and it stays picked; the volume still starts low every time.",
    ],
  },
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
