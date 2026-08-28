// The content the app already holds, given doors.
//
// babyFacts.ts and careGuidance.ts contain about a thousand lines of real,
// sourced answers to the questions people type into a search box at three in
// the morning — and every one of them was invisible, because it lived inside a
// JavaScript bundle behind a single URL. No crawler and no assistant can read
// a fact that has no address.
//
// This module decides what pages exist. The HTML is in render.mjs; the data is
// imported from the app itself, so there is exactly one copy of every claim and
// it is the same one the app shows.

export const SITE = {
  origin: "https://numa-baby.mpoapostolis.workers.dev",
  name: "Baby Tracker",
  tagline: "Calm, private baby logging",
};

/**
 * The eight development stages, keyed to the brackets in babyFacts.ts by their
 * first day. Titles are phrased the way a person searches — "3 month old baby"
 * rather than "Stage 4" — because the heading is the query.
 */
export const STAGES = [
  {
    fromDay: 0,
    slug: "newborn",
    age: "Newborn",
    range: "0 to 2 weeks",
    title: "Newborn Baby: What to Expect in the First 2 Weeks",
    h1: "What a newborn baby does in the first two weeks",
    lead:
      "A newborn already sees, hears and smells. Vision is sharpest at about 20–30 cm — roughly the distance to your face during a feed — hearing is fully mature at birth, and your baby knows the scent of their own mother's milk from day one. Most of the first fortnight is feeding, sleeping and recovering birthweight.",
  },
  {
    fromDay: 14,
    slug: "2-weeks",
    age: "2 weeks",
    range: "2 to 6 weeks",
    title: "2-Week-Old Baby: What to Expect",
    h1: "What a 2-week-old baby does",
    lead:
      "Between two and six weeks a baby is building neck strength and waiting on the first real smile. Feeds are frequent and often clustered in the evening, tummy time starts in short bursts, and weight gain has usually restarted after the normal early dip.",
  },
  {
    fromDay: 42,
    slug: "6-weeks",
    age: "6 weeks",
    range: "6 weeks to 3 months",
    title: "6-Week-Old Baby: What to Expect",
    h1: "What a 6-week-old baby does",
    lead:
      "Around six weeks the first true social smile usually arrives — a smile aimed at you, in response to you. Babies at this stage hold their head up longer during tummy time, and gaps between dirty nappies often stretch out, which is expected rather than a problem.",
  },
  {
    fromDay: 90,
    slug: "3-months",
    age: "3 months",
    range: "3 to 5 months",
    title: "3-Month-Old Baby: What to Expect",
    h1: "What a 3-month-old baby does",
    lead:
      "At three months a baby pushes up on their forearms, follows moving things with their eyes, and begins reaching for what they can see. Milk is still the whole meal — solid food does not belong here yet — and floor time is what earns the first rolls.",
  },
  {
    fromDay: 150,
    slug: "5-months",
    age: "5 months",
    range: "5 to 7 months",
    title: "5-Month-Old Baby: What to Expect",
    h1: "What a 5-month-old baby does",
    lead:
      "Around five months babies roll, sit with support, and bring almost everything to their mouth. This is the run-up to first foods rather than the start of them: solids usually begin at about six months, alongside milk rather than instead of it.",
  },
  {
    fromDay: 210,
    slug: "7-months",
    age: "7 months",
    range: "7 to 9 months",
    title: "7-Month-Old Baby: What to Expect",
    h1: "What a 7-month-old baby does",
    lead:
      "By seven months most babies sit without help and have started first foods alongside their milk. Stools change colour and smell once food arrives, which is expected. Games like peekaboo are doing real cognitive work, not just passing time.",
  },
  {
    fromDay: 270,
    slug: "9-months",
    age: "9 months",
    range: "9 to 12 months",
    title: "9-Month-Old Baby: What to Expect",
    h1: "What a 9-month-old baby does",
    lead:
      "Between nine and twelve months babies crawl, pull to stand and cruise along furniture. They understand that a hidden thing still exists, which is why hiding games become favourites — and why they now object when you leave the room.",
  },
  {
    fromDay: 366,
    slug: "1-year",
    age: "1 year",
    range: "12 months and beyond",
    title: "1-Year-Old Baby: What to Expect",
    h1: "What a 1-year-old does",
    lead:
      "At a year most children are eating family foods, with milk still welcome, and are somewhere between confident cruising and first steps. The range here is wide and normal: walking any time between about nine and eighteen months is ordinary.",
  },
];

export const DOCTOR_PAGE = {
  slug: "when-to-call-a-doctor",
  title: "When to Call a Doctor About Your Baby",
  h1: "When to call a doctor about your baby",
  lead:
    "Call the same day for a rectal temperature of 38.0 °C (100.4 °F) or higher in a baby under three months, for fewer wet nappies with a dry mouth or no tears, or for a baby who is unusually hard to wake. Seek urgent help for laboured breathing, a rash that does not fade under pressure, or a baby who will not feed at all.",
  description:
    "The signs in a baby that mean call a doctor today, with exact thresholds — fever under 3 months, dehydration, breathing, jaundice. Every line sourced to the AAP or NHS.",
};

export const MILK_PAGE = {
  slug: "how-much-milk-does-my-baby-need",
  title: "How Much Milk Does My Baby Need?",
  h1: "How much milk does my baby need?",
  description:
    "A formula-fed baby needs roughly 165 ml per kg of body weight per day, up to about 960 ml. Why the number is a guide, not a target, and why it does not apply to breastfeeding.",
};

export const SOURCES_PAGE = {
  slug: "sources",
  title: "Sources",
  h1: "Where every claim here comes from",
  lead:
    "Every fact in this app and on these pages points at one named page from the American Academy of Pediatrics, the World Health Organization or the NHS. Nothing is published without a source behind it, and each was fetched and read rather than assumed.",
  description:
    "Every source behind the facts and guidance in Baby Tracker — AAP, WHO and NHS pages, listed and linked.",
};

export const INDEX_PAGE = {
  slug: "guides",
  title: "Baby Development Guides by Age",
  h1: "What babies do, stage by stage",
  lead:
    "Eight short pages covering what a baby is doing and needs at each stage from newborn to one year, plus the signs that mean call a doctor and how much milk a formula-fed baby needs. Every claim cites the AAP, WHO or NHS page it came from.",
  description:
    "Baby development by age, from newborn to one year — what they do, what they need, and what to watch for. Every claim sourced to the AAP, WHO or NHS.",
};

/** The day every cited page was last fetched and read. A hand-maintained
    constant on purpose: `new Date()` here would have every build claim the
    sources were checked today, which would be a lie told automatically. */
export const SOURCES_CHECKED = "2026-08-22";

/** Shown on every page, close to the content rather than buried in a footer. */
export const DISCLAIMER =
  "This is general information, not a substitute for your own doctor, midwife or health visitor — they know your baby, and this page does not.";
