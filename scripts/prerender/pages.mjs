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
//
// It is also the one list of those pages' addresses: CONTENT_SLUGS, at the
// bottom, is what the service worker keeps its hands off (vite.config.ts) and
// what the old workers.dev address sends on to the apex (worker/canonical.ts).
// Plain data, no imports, so all three can read it — see pages.d.mts.
//
// Every page carries:
//   title        what the tab and the search result say. Phrased the way a
//                person searches — "3 month old baby", not "Stage 4" — and
//                only given the " · Numalog" suffix when that still fits in 60
//                characters (render.mjs), because a cut title loses its end.
//   description  hand-written, one or two whole sentences, 155 characters at
//                most, saying only what the page itself says. A generated one
//                was cut mid-word by .slice() and promised what pages lacked.
//   updated      the day the page last changed in substance: the sitemap's
//                lastmod and the markup's dateModified. Hand-kept on purpose,
//                like SOURCES_CHECKED below — `new Date()` would have every
//                build claim every page changed today.
//   cta          optional {text, sub, via}: the button at the foot of the page,
//                worded for what the page was about. It opens the app's setup,
//                not a ?log= sheet — a first-time visitor has no baby set up
//                to log against — and ?via= says which page brought them
//                (App.tsx reads it, then strips it from the address).

export const SITE = {
  origin: "https://numalog.app",
  name: "Numalog",
  tagline: "Calm, private baby logging",
};

/**
 * The eight development stages, keyed to the brackets in babyFacts.ts by their
 * first day. `ageNoun` names the baby in a heading — "What can a newborn do?" —
 * where `age` once produced "What is my baby doing at newborn?".
 */
export const STAGES = [
  {
    fromDay: 0,
    slug: "newborn",
    age: "Newborn",
    ageNoun: "a newborn",
    range: "0 to 2 weeks",
    title: "Newborn Baby (0–2 Weeks): Feeding, Diapers & What's Normal",
    h1: "Your newborn baby: the first two weeks",
    lead:
      "A newborn already sees, hears and smells. Vision is sharpest at about 20–30 cm — roughly the distance to your face during a feed — hearing is fully mature at birth, and your baby knows the scent of their own mother's milk from day one. Most of the first fortnight is feeding, sleeping and recovering birthweight.",
    description:
      "A newborn feeds at least 8 to 12 times a day. This guide to the first two weeks covers wet diapers, when weight gain restarts and when to call a doctor.",
    cta: { text: "Count today's feeds and wet diapers against these ranges" },
    updated: "2026-10-16",
  },
  {
    fromDay: 14,
    slug: "2-weeks",
    age: "2 weeks",
    ageNoun: "a 2- to 6-week-old",
    range: "2 to 6 weeks",
    title: "2–6 Week Old Baby (1 Month Old): Milestones & Feeding",
    h1: "Your 2- to 6-week-old baby",
    lead:
      "Between two and six weeks a baby is building neck strength and waiting on the first real smile. Feeds are frequent and often clustered in the evening, tummy time starts in short bursts, and weight gain has usually restarted after the normal early dip.",
    description:
      "A 2- to 6-week-old often cluster feeds, starts tummy time at 3–5 minutes 2 or 3 times a day, spits up, and is working toward the first real smile.",
    cta: { text: "Count today's feeds and wet diapers against these ranges" },
    updated: "2026-10-16",
  },
  {
    fromDay: 42,
    slug: "6-weeks",
    age: "6 weeks",
    ageNoun: "a baby of 6 weeks to 3 months",
    range: "6 weeks to 3 months",
    title: "2 Month Old Baby (6 Weeks to 3 Months): Milestones & Feeding",
    h1: "Your baby from 6 weeks to 3 months",
    lead:
      "Around six weeks the first true social smile usually arrives — a smile aimed at you, in response to you. Babies at this stage hold their head up longer during tummy time, and gaps between dirty diapers often stretch out, which is expected rather than a problem.",
    description:
      "From 6 weeks to 3 months comes the first social smile, 15–30 minutes of tummy time a day, 90–120 ml (3–4 oz) formula feeds and longer gaps between poops.",
    cta: { text: "Time tummy time against today's goal" },
    updated: "2026-10-16",
  },
  {
    fromDay: 90,
    slug: "3-months",
    age: "3 months",
    ageNoun: "a 3- to 4-month-old",
    range: "3 to 5 months",
    title: "3–4 Month Old Baby: Milestones & Feeding",
    h1: "Your 3- to 4-month-old baby",
    lead:
      "At three months a baby pushes up on their forearms, follows moving things with their eyes, and begins reaching for what they can see. Milk is still the whole meal — solid food does not belong here yet — and floor time is what earns the first rolls.",
    description:
      "A 3- to 4-month-old pushes up, reaches and tracks moving things with their eyes. Milk is still the whole meal, and reflux usually fades from here.",
    cta: { text: "Time tummy time against today's goal" },
    updated: "2026-10-16",
  },
  {
    fromDay: 150,
    slug: "5-months",
    age: "5 months",
    ageNoun: "a 5- to 6-month-old",
    range: "5 to 7 months",
    title: "5–6 Month Old Baby: Milestones & Starting Solids",
    h1: "Your 5- to 6-month-old baby",
    lead:
      "Around five months babies roll, sit with support, and bring almost everything to their mouth. This is the run-up to first foods rather than the start of them: solids usually begin at about six months, alongside milk rather than instead of it.",
    description:
      "A 5- to 6-month-old rolls, sits with support and is nearly ready for solids, which start at about six months alongside milk rather than instead of it.",
    updated: "2026-10-16",
  },
  {
    fromDay: 210,
    slug: "7-months",
    age: "7 months",
    ageNoun: "a 7- to 8-month-old",
    range: "7 to 9 months",
    title: "7–8 Month Old Baby: Milestones & First Foods",
    h1: "Your 7- to 8-month-old baby",
    lead:
      "By seven months most babies sit without help and have started first foods alongside their milk. Stools change colour and smell once food arrives, which is expected. Games like peekaboo are doing real cognitive work, not just passing time.",
    description:
      "A 7- to 8-month-old sits without help and eats first foods alongside milk. Poops change once food arrives, and peekaboo is doing real work.",
    updated: "2026-10-16",
  },
  {
    fromDay: 270,
    slug: "9-months",
    age: "9 months",
    ageNoun: "a 9- to 11-month-old",
    range: "9 to 12 months",
    title: "9–11 Month Old Baby: Milestones & Feeding",
    h1: "Your 9- to 11-month-old baby",
    lead:
      "Between nine and twelve months babies crawl, pull to stand and cruise along furniture. They understand that a hidden thing still exists, which is why hiding games become favourites — and why they now object when you leave the room.",
    description:
      "A 9- to 11-month-old crawls, pulls to stand and cruises along the furniture, and now protests when you leave the room. Here is what is normal.",
    updated: "2026-10-16",
  },
  {
    fromDay: 366,
    slug: "1-year",
    age: "1 year",
    ageNoun: "a 1-year-old",
    range: "12 months and beyond",
    title: "1 Year Old Baby (12 Months): Milestones & Feeding",
    h1: "Your 1-year-old",
    lead:
      "At a year most children are eating family foods, with milk still welcome, and are somewhere between confident cruising and first steps. The range here is wide and normal: walking any time between about nine and eighteen months is ordinary.",
    description:
      "At one year most children eat family foods, with milk still welcome. First steps come anywhere from about 9 to 18 months, and that whole range is normal.",
    updated: "2026-10-16",
  },
];

export const DOCTOR_PAGE = {
  slug: "when-to-call-a-doctor",
  title: "When to Call a Doctor for Your Newborn or Baby",
  h1: "When to call a doctor for your newborn or baby",
  // Two tiers, in the words of the list below (careGuidance.ts WATCH_FOR):
  // every sign named here is on it, at the same urgency — and with the same
  // instruction, since not every "now" line is an emergency number.
  lead:
    "Call an emergency number now if a baby 3 months or younger has a rectal temperature of 38.0 °C (100.4 °F) or higher, or if your baby is difficult to wake, has difficulty breathing, has a rash that does not fade when you press it or has green vomit. Get urgent medical help if your baby is not feeding, and call your doctor immediately about signs of dehydration. Call your doctor today about jaundice that appears after the first day, or a baby not back to birthweight by three weeks.",
  description:
    "Under 3 months with a temperature of 38 °C (100.4 °F) or more? Get help now. Here are the signs that need an emergency number, and those for a call today.",
  cta: { text: "Keep a log you can show the pediatrician, one-tap PDF" },
  updated: "2026-10-16",
};

// No description here: it is written in prerender.mjs from the same figure
// the page prints (ML_PER_KG_PER_DAY), so the snippet and the page can never
// again say 165 and 166.
export const MILK_PAGE = {
  slug: "how-much-milk-does-my-baby-need",
  title: "How Much Milk Does My Baby Need? (ml & oz by Weight)",
  h1: "How much milk does my baby need?",
  cta: { text: "Log bottles and see today's total" },
  updated: "2026-10-16",
};

export const BAG_PAGE = {
  slug: "baby-bag-checklist",
  title: "Diaper Bag Checklist: What to Pack for a Baby Outing",
  h1: "Diaper bag checklist: what to pack for a baby outing",
  lead:
    "The working rule for a short outing: one diaper per hour you plan to be out plus one spare, a full change of clothes, and one more feed than you think you need. Everything else on this list exists because a parent somewhere got caught without it.",
  description:
    "This diaper bag checklist covers newborns and babies: one diaper per hour out plus one, feeding, a full change of clothes and the things everyone forgets.",
  cta: { text: "Keep this checklist on your phone" },
  updated: "2026-10-16",
};

export const SOURCES_PAGE = {
  slug: "sources",
  title: "Sources",
  h1: "Where every claim here comes from",
  lead:
    "Every fact in this app and on these pages points at one named page from the American Academy of Pediatrics, the World Health Organization, the NHS or, for eyesight, the American Academy of Ophthalmology. Nothing is published without a source behind it, and each was fetched and read rather than assumed.",
  description:
    "These are the pages behind every fact and piece of guidance in Numalog, from the AAP, WHO, NHS and AAO, each fetched and read before it was cited.",
  updated: "2026-10-16",
};

export const INDEX_PAGE = {
  slug: "guides",
  title: "Baby Development Month by Month: Newborn to 1 Year",
  h1: "Baby development month by month, newborn to 1 year",
  lead:
    "Eight short pages covering what a baby is doing and needs at each stage from newborn to one year, plus the signs that mean call a doctor and how much milk a formula-fed baby needs. Every claim links to the page it came from.",
  description:
    "Follow baby development from newborn to 12 months: milestones, feeding and diapers at each stage, and when to call a doctor, with every claim sourced.",
  updated: "2026-10-16",
};

/** Every page the prerender emits, by address. The prerender writes exactly
    these; the service worker's denylist and the workers.dev redirect are built
    from this list, and a build test fails if the three ever disagree. */
export const CONTENT_SLUGS = [INDEX_PAGE, ...STAGES, DOCTOR_PAGE, MILK_PAGE, BAG_PAGE, SOURCES_PAGE]
  .map((page) => page.slug);

/** The day every cited page was last fetched and read. A hand-maintained
    constant on purpose: `new Date()` here would have every build claim the
    sources were checked today, which would be a lie told automatically. */
export const SOURCES_CHECKED = "2026-08-29";

/** Shown on every page, close to the content rather than buried in a footer. */
export const DISCLAIMER =
  "This is general information, not a substitute for your own doctor, midwife or health visitor — they know your baby, and this page does not.";
