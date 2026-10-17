// "What should I do today?" — the Guide's daily care card, matched to the
// baby's exact age. Same discipline as babyFacts.ts: every line traces to a
// real page that was fetched and read, the wording stays inside what that
// page actually says, and the pick is deterministic — never random.
//
// This is guidance, never diagnosis. Anything that could mean "call someone"
// lives in WATCH_FOR below, at the urgency its own source gives it.

import { FactSource } from "./babyFacts";

export type CareKind = "feeding" | "nappies" | "activity" | "comfort";

export type CareCard = {
  kind: CareKind;
  /** The heading a tired parent scans. */
  title: string;
  /** What is expected at this age, in one sentence. */
  body: string;
  /** What to actually do about it. */
  action: string;
  source: FactSource;
  /** A second page, cited only when the action takes its urgency from it —
      where two sources name the same sign at different urgencies, the card
      says the stricter one and links the page that says it. */
  alsoSource?: FactSource;
};

export type CareBracket = {
  /** Inclusive age bounds in days; the last bracket runs to Infinity. */
  fromDay: number;
  toDay: number;
  /** The stage in three or four words, for the card's eyebrow. */
  stage: string;
  cards: CareCard[];
};

// Fetched and read 29 Aug 2026: "your baby should feed at least 8 to 12 times,
// or more, every 24 hours during the first few weeks" — verbatim. The page the
// card cited before is about knowing a baby is getting enough, and never
// carried this figure.
const NHS_FIRST_DAYS: FactSource = {
  name: "NHS · Breastfeeding: the first few days",
  url: "https://www.nhs.uk/baby/breastfeeding-and-bottle-feeding/breastfeeding/the-first-few-days/",
};
// "have yellow-green or green vomit (children)" and "vomit blood or have vomit
// that looks like ground coffee" — verbatim, 29 Aug 2026, and both under the
// page's "Call 999 or go to A&E" heading (re-read 16 Oct 2026), which is why
// the sign sits in the "now" tier. The urgent-help page says neither; it
// covers "difficult to wake" and "floppy", which is why that half of the
// warning stays there.
const NHS_VOMITING: FactSource = {
  name: "NHS · Diarrhoea and vomiting",
  url: "https://www.nhs.uk/symptoms/diarrhoea-and-vomiting/",
};

const AAP_HOW_OFTEN: FactSource = {
  name: "AAP · How Often and How Much Should Your Baby Eat?",
  url: "https://www.healthychildren.org/English/ages-stages/baby/feeding-nutrition/Pages/How-Often-and-How-Much-Should-Your-Baby-Eat.aspx",
};
const AAP_FORMULA_AMOUNT: FactSource = {
  name: "AAP · Amount and Schedule of Baby Formula Feedings",
  url: "https://www.healthychildren.org/English/ages-stages/baby/formula-feeding/Pages/Amount-and-Schedule-of-Formula-Feedings.aspx",
};
const AAP_BURPING: FactSource = {
  name: "AAP · Baby Burping, Hiccups & Spit-Up",
  url: "https://www.healthychildren.org/English/ages-stages/baby/feeding-nutrition/Pages/baby-burping-hiccups-and-spit-up.aspx",
};
const AAP_FIRST_DAYS: FactSource = {
  name: "AAP · Baby's First Days: Bowel Movements & Urination",
  url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/Babys-First-Days-Bowel-Movements-and-Urination.aspx",
};
const AAP_TUMMY_TIME: FactSource = {
  name: "AAP · Back to Sleep, Tummy to Play",
  url: "https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/back-to-sleep-tummy-to-play.aspx",
};
const AAP_FIRST_MONTH: FactSource = {
  name: "AAP · Your Baby's First Month",
  url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/First-Month-Physical-Appearance-and-Growth.aspx",
};
const AAP_MOVEMENT_4_7: FactSource = {
  name: "AAP · Movement: 4 to 7 Months",
  url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/Movement-4-to-7-Months.aspx",
};
const AAP_MIND_8_12: FactSource = {
  name: "AAP · Cognitive Development: 8 to 12 Months",
  url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/Cognitive-Development-8-to-12-Months.aspx",
};
// "From day 5 onwards … at least 6 heavy, wet nappies every 24 hours", and
// for concerns "Speak to your midwife, health visitor or a breastfeeding
// specialist" — no urgency beyond "ask for help early" (re-read 17 Oct 2026).
const NHS_ENOUGH_MILK: FactSource = {
  name: "NHS · Is my baby getting enough milk?",
  url: "https://www.nhs.uk/baby/breastfeeding-and-bottle-feeding/breastfeeding-problems/enough-milk/",
};
// The same count is stricter here: "for infants, fewer than six wet diapers
// per day" is on its list, under "notify the pediatrician immediately if any
// of them develop" (re-read 17 Oct 2026). Defined up here because the day-5
// card below cites it as well as WATCH_FOR.
const AAP_DEHYDRATION: FactSource = {
  name: "AAP · Signs of Dehydration in Infants & Children",
  url: "https://www.healthychildren.org/English/health-issues/injuries-emergencies/Pages/dehydration.aspx",
};
const NHS_NAPPY: FactSource = {
  name: "NHS · How to change your baby's nappy",
  url: "https://www.nhs.uk/baby/caring-for-a-newborn/how-to-change-your-babys-nappy/",
};
const NHS_CLUSTER: FactSource = {
  name: "NHS · Cluster feeding",
  url: "https://www.nhs.uk/best-start-in-life/baby/feeding-your-baby/bottle-feeding/bottle-feeding-your-baby/cluster-feeding/",
};
const NHS_BOTTLE: FactSource = {
  name: "NHS · Bottle feeding advice",
  url: "https://www.nhs.uk/baby/breastfeeding-and-bottle-feeding/bottle-feeding/advice/",
};
// "Reflux usually starts before a baby is 8 weeks old and gets better by the
// time they're 1" — verbatim, 29 Aug 2026. The AAP spit-up page carries the
// reassurance but no timeline, which is why the timeline is cited here.
const NHS_REFLUX: FactSource = {
  name: "NHS · Reflux in babies",
  url: "https://www.nhs.uk/conditions/reflux-in-babies/",
};
const WHO_FEEDING: FactSource = {
  name: "WHO · Infant and young child feeding",
  url: "https://www.who.int/news-room/fact-sheets/detail/infant-and-young-child-feeding",
};

// Shared cards — the guidance that does not change with the week.
const CUES: CareCard = {
  kind: "feeding",
  title: "Follow the cues, not the clock",
  body: "Rooting, hands to the mouth and lip smacking are the early signs. Crying is a late one.",
  action: "Offer a feed at the first cue rather than waiting for the cry.",
  source: AAP_HOW_OFTEN,
};

const BURP_BASICS: CareCard = {
  kind: "comfort",
  title: "Burp through the feed, not just at the end",
  body: "With a bottle, pausing about every 60–90 ml works better than one burp at the end; when nursing, switching sides is the natural moment.",
  action: "Rotate the three holds: on your shoulder, sitting on your lap, or face-down across your lap with the head above the chest.",
  source: AAP_BURPING,
};

export const CARE_BRACKETS: CareBracket[] = [
  {
    fromDay: 0,
    toDay: 4,
    stage: "The first days",
    cards: [
      {
        kind: "feeding",
        title: "Feed often — at least 8 to 12 times in 24 hours",
        body: "In the first days it can be as often as every hour. That is the milk supply being built, not a problem.",
        action: "Offer the breast or bottle whenever the cues appear, day and night.",
        source: NHS_FIRST_DAYS,
      },
      {
        kind: "nappies",
        title: "Only 2 or 3 wet diapers is expected right now",
        body: "In the first 48 hours the count is genuinely low. It climbs sharply once the milk comes in.",
        action: "Note each diaper as it happens — the ramp over the next days is what matters, not today's number.",
        source: NHS_ENOUGH_MILK,
      },
      CUES,
      BURP_BASICS,
    ],
  },
  {
    fromDay: 5,
    toDay: 13,
    stage: "Milk in, weight climbing",
    cards: [
      {
        kind: "nappies",
        title: "From today, look for 6 or more heavy wet diapers a day",
        body: "The pee should be almost colourless or pale yellow. Alongside them, at least 2 soft yellow stools a day.",
        // The NHS page sends this to the midwife or health visitor with no
        // hurry named; the AAP counts it as dehydration and says
        // "immediately". The Growth guide shows both this card and the
        // dehydration line in WATCH_FOR, so the card says the AAP's "now"
        // rather than contradict the list under it.
        action: "If the wet count sits below 6 for a day, call your midwife, health visitor or doctor now — the AAP counts fewer than six a day as a sign of dehydration.",
        source: NHS_ENOUGH_MILK,
        alsoSource: AAP_DEHYDRATION,
      },
      {
        kind: "feeding",
        title: "Weight gain restarts around day 5",
        body: "Birthweight is usually back by about 2 weeks, and almost all babies have regained it by 3 weeks.",
        action: "Log a weight when you have one — the trend across weeks is the useful part.",
        source: AAP_FIRST_MONTH,
      },
      CUES,
      BURP_BASICS,
    ],
  },
  {
    fromDay: 14,
    toDay: 41,
    stage: "Finding the rhythm",
    cards: [
      {
        kind: "activity",
        title: "Tummy time: 3 to 5 minutes, 2 or 3 times a day",
        body: "Always awake and watched. After a diaper change or a nap is an easy moment to remember.",
        action: "Build toward 15–30 minutes a day by around 7 weeks.",
        source: AAP_TUMMY_TIME,
      },
      {
        kind: "feeding",
        title: "Cluster feeding is normal, and it is not a supply problem",
        body: "Feeds bunched close together are common in the first three to four months, and often come with a growth spurt.",
        action: "Ride it out and keep offering. It passes.",
        source: NHS_CLUSTER,
      },
      {
        kind: "comfort",
        title: "Spit-up is not a problem to fix",
        body: "All babies spit up, and it usually comes with no crying or discomfort. It settles on its own as the muscles mature — generally by their first birthday.",
        action: "If it is frequent, smaller and more frequent feeds help more than bigger, spaced-out ones — and hold upright for about 20 minutes after.",
        source: NHS_REFLUX,
      },
      CUES,
    ],
  },
  {
    fromDay: 42,
    toDay: 89,
    stage: "Six weeks to three months",
    cards: [
      {
        kind: "nappies",
        title: "Long gaps between poops become normal now",
        body: "After about 6 weeks a breastfed baby can go several days without one. That alone is not constipation.",
        action: "Watch how your baby is feeding and growing rather than counting the days.",
        source: NHS_NAPPY,
      },
      {
        kind: "activity",
        title: "Tummy time is now 15 to 30 minutes a day",
        body: "Spread over short sessions, always awake and watched.",
        action: "Get down at their eye level — your face is still the favourite thing to look at.",
        source: AAP_TUMMY_TIME,
      },
      {
        kind: "feeding",
        title: "Formula climbs to roughly 90–120 ml (3–4 oz) a feed",
        body: "About every 3 to 4 hours by the end of the first month. Most babies stay under about 960 ml in 24 hours.",
        action: "Follow fullness cues and never push the last of a bottle.",
        source: AAP_FORMULA_AMOUNT,
      },
      BURP_BASICS,
    ],
  },
  {
    fromDay: 90,
    toDay: 179,
    stage: "Three to six months",
    cards: [
      {
        kind: "feeding",
        title: "Milk is still the whole meal until about 6 months",
        body: "WHO recommends exclusive breastfeeding for the first 6 months — no other food or drink, not even water.",
        action: "Keep feeding responsively, as often as your baby wants.",
        source: WHO_FEEDING,
      },
      {
        kind: "activity",
        title: "Floor time earns the rolls",
        body: "By around 7 months most babies roll both ways, and sitting without leaning on their arms follows.",
        action: "Clear a safe patch of floor and let them work — supervised, on a firm flat surface.",
        source: AAP_MOVEMENT_4_7,
      },
      {
        kind: "comfort",
        title: "Reflux fades from here",
        body: "It usually starts before 8 weeks and settles on its own by the first birthday.",
        action: "Keep feeds smaller and more frequent if spit-up is heavy, and keep sleep flat on the back.",
        source: NHS_REFLUX,
      },
      CUES,
    ],
  },
  {
    fromDay: 180,
    toDay: 365,
    stage: "Six to twelve months",
    cards: [
      {
        kind: "feeding",
        title: "First foods: alongside milk, not instead of it",
        body: "From 6 months, safe and adequate complementary foods begin while breastfeeding continues.",
        action: "Introduce foods one at a time and keep the milk feeds going.",
        source: WHO_FEEDING,
      },
      {
        kind: "activity",
        title: "Play peekaboo — it is doing real work",
        body: "Your baby is learning that things still exist when they cannot see them.",
        action: "Vary the game: hide behind a cloth, behind furniture, or take turns covering your heads.",
        source: AAP_MIND_8_12,
      },
      {
        kind: "nappies",
        title: "Stools change with food, and that is expected",
        body: "Colour and consistency shift once solids begin.",
        action: "Keep an eye on comfort rather than counting — and ask your paediatrician about anything painful.",
        source: AAP_FIRST_DAYS,
      },
      CUES,
    ],
  },
  {
    fromDay: 366,
    toDay: Infinity,
    stage: "After the first year",
    cards: [
      {
        kind: "feeding",
        title: "Family foods, with milk still welcome",
        body: "WHO supports continued breastfeeding up to 2 years or beyond alongside family meals.",
        action: "Offer variety and let your child decide how much.",
        source: WHO_FEEDING,
      },
      {
        kind: "activity",
        title: "Hiding games stay favourites",
        body: "Object permanence games keep their pull well past the first birthday.",
        action: "Hide a toy under a cloth and let them find it.",
        source: AAP_MIND_8_12,
      },
      {
        kind: "feeding",
        title: "Follow fullness, always",
        body: "Pushing more food or milk than a child wants teaches them to ignore their own signals.",
        action: "Serve, then let them stop when they stop.",
        source: NHS_BOTTLE,
      },
      CUES,
    ],
  },
];

/** The care bracket covering a given age in whole days; null for unusable ages. */
export function careForAge(ageDays: number): CareBracket | null {
  if (!Number.isFinite(ageDays) || ageDays < 0) return null;
  const days = Math.floor(ageDays);
  return CARE_BRACKETS.find((b) => days >= b.fromDay && days <= b.toDay) ?? null;
}

// The "when to call someone" list. Deliberately separate from the daily cards:
// it is always visible, never triggered by a number this app computed, and it
// never tries to decide anything on the parent's behalf.
//
// Two tiers, because the sources draw the line in two places. This used to
// be one list under "call today", which told the parent of a feverish
// six-week-old to "call the same day" — where the AAP says "call your
// pediatrician immediately" and the NHS says "Call 999 or go to A&E" — and
// set a baby who is hard to wake beside a slow return to birthweight. A
// sign's tier is never lower than the urgency its own source states, and
// never higher either: the "now" heading says to call an emergency number,
// so a line whose source says something else says that instead. Every
// placement below was checked against the cited page on 16 Oct 2026, and
// the per-line instructions again on 17 Oct 2026.
//
//   now    what the NHS lists under "Call 999 or go to A&E" (the heading's
//          emergency number), what the AAP says to tell the doctor about
//          immediately, and the NHS signs of serious illness that "need
//          urgent medical help" — those two say so on their own line.
//   today  what the NHS sends to an urgent GP or midwife appointment, and the
//          slower signs a doctor should hear about without waiting for a visit.
export type WatchTier = "now" | "today";

export type WatchItem = {
  /** Finishes its tier's heading — "…if your baby" + sign — so it starts in
      lower case, the way the NHS writes its own lists. */
  sign: string;
  tier: WatchTier;
  source: FactSource;
  /** As on a care card: a second page, only when the line takes its
      urgency from it rather than from `source`. */
  alsoSource?: FactSource;
};

const AAP_FEVER: FactSource = {
  name: "AAP · Fever and Your Baby",
  url: "https://www.healthychildren.org/English/health-issues/conditions/fever/Pages/Fever-and-Your-Baby.aspx",
};
const NHS_JAUNDICE: FactSource = {
  name: "NHS · Jaundice in babies",
  url: "https://www.nhs.uk/conditions/jaundice-in-babies/",
};
// The NHS rewrote and renamed this page; the old URL now redirects here and
// the old title matches nothing. Linked canonically, checked 22 Aug 2026.
const NHS_URGENT_HELP: FactSource = {
  name: "NHS · When to get urgent medical help",
  url: "https://www.nhs.uk/baby/health/when-to-get-urgent-medical-help-for-babies-and-children-under-5/",
};

/** The tiers in reading order, with the words both the app and the web page
    put above each list — one copy, so the two can never disagree. */
export const WATCH_TIERS: { tier: WatchTier; heading: string; how?: string }[] = [
  {
    tier: "now",
    heading: "Get help now if your baby…",
    how: "Call an emergency number — 911 (US and Philippines), 999 (UK), 112 (EU and Greece) — unless the line itself says what to do.",
  },
  { tier: "today", heading: "Call your doctor today if your baby…" },
];

/** The NHS's own closing rule, kept beside the list because no list is
    complete: "Get immediate medical help if your child is unwell and you
    think there's something seriously wrong." */
export const WATCH_INSTINCT = {
  text: "Trust your instincts: if your baby is unwell and you think something is seriously wrong, get help now, whether or not it is on this list.",
  source: NHS_URGENT_HELP,
};

export const WATCH_FOR: WatchItem[] = [
  {
    // AAP, verbatim: "If your baby is 3 months of age or younger and has a
    // rectal temperature of 100.4 degrees Fahrenheit (38 degrees Celsius) or
    // higher, call your pediatrician immediately. This is very important,
    // even if your baby shows no other signs or symptoms of being ill."
    // The NHS puts the same sign on its "Call 999 or go to A&E" list: "38C
    // or higher in babies under 3 months old". The line once ended "call
    // your doctor immediately", which kept the emergency number from a UK
    // parent whose own source says 999 — so it takes the heading's number,
    // the stricter of the two, and cites the page that says it.
    sign: "is 3 months or younger and has a rectal temperature of 38.0 °C (100.4 °F) or higher, even with no other symptoms.",
    tier: "now",
    source: AAP_FEVER,
    alsoSource: NHS_URGENT_HELP,
  },
  // The next seven are from that same NHS "Call 999 or go to A&E" list, in
  // its own words. The 3-to-6-month line is theirs too; °F is only the
  // arithmetic.
  {
    sign: "is 3 to 6 months old and has a temperature of 39 °C (102.2 °F) or higher.",
    tier: "now",
    source: NHS_URGENT_HELP,
  },
  {
    sign: "is breathing very fast or has difficulty breathing — they may make grunting noises or suck in their tummy when they breathe.",
    tier: "now",
    source: NHS_URGENT_HELP,
  },
  {
    sign: "has blue, grey, pale or blotchy (mottled) skin, lips or tongue.",
    tier: "now",
    source: NHS_URGENT_HELP,
  },
  {
    sign: "has a rash that does not fade when you press it.",
    tier: "now",
    source: NHS_URGENT_HELP,
  },
  {
    sign: "is difficult to wake, or cannot be woken.",
    tier: "now",
    source: NHS_URGENT_HELP,
  },
  {
    sign: "is having a seizure (fit).",
    tier: "now",
    source: NHS_URGENT_HELP,
  },
  {
    sign: "has not had a pee in the past 12 hours.",
    tier: "now",
    source: NHS_URGENT_HELP,
  },
  {
    sign: "has yellow-green or green vomit, vomits blood, or has vomit that looks like ground coffee.",
    tier: "now",
    source: NHS_VOMITING,
  },
  {
    // Both under the jaundice page's "Call 999 or go to A&E": "Your baby has
    // jaundice and: … is not feeding … is less than 24 hours old".
    sign: "has yellow skin or eyes (jaundice) and is less than 24 hours old, or has jaundice and is not feeding.",
    tier: "now",
    source: NHS_JAUNDICE,
  },
  {
    // AAP: "notify the pediatrician immediately if any of them develop" —
    // the doctor, not an emergency number, so the line says so itself.
    // "Fewer than usual" rather than the page's "fewer than six": in the
    // first days two or three wet diapers is expected (the cards above), and
    // a number here would read as an alarm to a two-day-old's parent. The
    // day-5 card and the Growth guide's check-in list give the "six" with
    // its age, and the same "now".
    sign: "shows signs of dehydration — fewer wet diapers than usual, a dry mouth, fewer tears when crying, a sunken soft spot on the head, or unusual sleepiness — call your doctor immediately.",
    tier: "now",
    source: AAP_DEHYDRATION,
  },
  {
    // Not on the NHS 999 list, but among its "signs of serious illness" in a
    // child with "an infection or condition that needs urgent medical help"
    // — which is "now", never "today". That section names no number to
    // call, so the line says its words rather than take the heading's 999.
    sign: "has gone floppy, or does not respond like they usually would — get urgent medical help.",
    tier: "now",
    source: NHS_URGENT_HELP,
  },
  {
    // The same NHS section, under eating and drinking: "is a baby and is not
    // feeding", "has not had a drink in the past 8 hours when they've been
    // awake". The doctor page's summary said "will not feed" with no source.
    sign: "is not feeding, or has not had a drink in the past 8 hours while awake — get urgent medical help.",
    tier: "now",
    source: NHS_URGENT_HELP,
  },
  {
    // The NHS's "Ask for an urgent GP or midwife appointment or call NHS 111"
    // list, for a baby over 24 hours old.
    sign: "has yellow skin or eyes (jaundice) after the first day, jaundice that is not getting better or is getting worse, or dark yellow or brown pee or pale, creamy poop.",
    tier: "today",
    source: NHS_JAUNDICE,
  },
  {
    sign: "is not back to birthweight by 3 weeks, or is losing weight after the first week.",
    tier: "today",
    source: AAP_FIRST_MONTH,
  },
];
