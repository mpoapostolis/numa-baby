// "What should I do today?" — the Guide's daily care card, matched to the
// baby's exact age. Same discipline as babyFacts.ts: every line traces to a
// real page that was fetched and read, the wording stays inside what that
// page actually says, and the pick is deterministic — never random.
//
// This is guidance, never diagnosis. Anything that could mean "call someone"
// lives in WATCH_FOR below and always ends at the paediatrician.

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
};

export type CareBracket = {
  /** Inclusive age bounds in days; the last bracket runs to Infinity. */
  fromDay: number;
  toDay: number;
  /** The stage in three or four words, for the card's eyebrow. */
  stage: string;
  cards: CareCard[];
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
const AAP_SPIT_UP: FactSource = {
  name: "AAP · Why Babies Spit Up",
  url: "https://www.healthychildren.org/English/ages-stages/baby/feeding-nutrition/Pages/Why-Babies-Spit-Up.aspx",
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
const NHS_ENOUGH_MILK: FactSource = {
  name: "NHS · Is my baby getting enough milk?",
  url: "https://www.nhs.uk/baby/breastfeeding-and-bottle-feeding/breastfeeding-problems/enough-milk/",
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
        source: NHS_ENOUGH_MILK,
      },
      {
        kind: "nappies",
        title: "Only 2 or 3 wet nappies is expected right now",
        body: "In the first 48 hours the count is genuinely low. It climbs sharply once the milk comes in.",
        action: "Note each nappy as it happens — the ramp over the next days is what matters, not today's number.",
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
        title: "From today, look for 6 or more heavy wet nappies a day",
        body: "The wee should be almost colourless or pale yellow. Alongside them, at least 2 soft yellow stools a day.",
        action: "If the wet count sits below 6 for a day, ring your midwife or health visitor.",
        source: NHS_ENOUGH_MILK,
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
        body: "Always awake and watched. After a nappy change or a nap is an easy moment to remember.",
        action: "Build toward 15–30 minutes a day by around 7 weeks.",
        source: AAP_TUMMY_TIME,
      },
      {
        kind: "feeding",
        title: "Cluster feeding is normal, and it is not a supply problem",
        body: "Feeds bunched close together — often in the evening — are common in the first months and often come with a growth spurt.",
        action: "Ride it out and keep offering. It passes.",
        source: NHS_CLUSTER,
      },
      {
        kind: "comfort",
        title: "Spit-up is not a problem to fix",
        body: "About half of babies spit up, usually with no crying or discomfort. Reflux settles on its own, usually by the first birthday.",
        action: "If it is frequent, smaller and more frequent feeds help more than bigger, spaced-out ones — and hold upright for about 20 minutes after.",
        source: AAP_SPIT_UP,
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
        title: "Long gaps between poos become normal now",
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
        title: "Formula climbs to roughly 90–120 ml a feed",
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
        title: "First foods start now — alongside milk, not instead of it",
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
export type WatchItem = {
  sign: string;
  source: FactSource;
};

const AAP_FEVER: FactSource = {
  name: "AAP · Fever and Your Baby",
  url: "https://www.healthychildren.org/English/health-issues/conditions/fever/Pages/Fever-and-Your-Baby.aspx",
};
const AAP_DEHYDRATION: FactSource = {
  name: "AAP · Signs of Dehydration in Infants & Children",
  url: "https://www.healthychildren.org/English/health-issues/injuries-emergencies/Pages/dehydration.aspx",
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

export const WATCH_FOR: WatchItem[] = [
  {
    sign: "Under 3 months: a rectal temperature of 38.0 °C (100.4 °F) or higher — call the same day, even with no other symptoms.",
    source: AAP_FEVER,
  },
  {
    sign: "Fewer wet nappies than usual, a dry mouth, no tears when crying, or unusual sleepiness.",
    source: AAP_DEHYDRATION,
  },
  {
    sign: "Yellowing of the skin or eyes that appears in the first 24 hours, deepens, or is still there after two weeks.",
    source: NHS_JAUNDICE,
  },
  {
    sign: "Green or bloody vomit, forceful projectile vomiting, or a baby who is hard to wake or unusually floppy.",
    source: NHS_URGENT_HELP,
  },
  {
    sign: "Not back to birthweight by three weeks, or losing weight after the first week.",
    source: AAP_FIRST_MONTH,
  },
];
