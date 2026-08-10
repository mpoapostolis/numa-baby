// Age-appropriate facts for the Today welcome hero. Every claim below was
// checked against its named source page (all fetched live on 10 Aug 2026) —
// nothing ships here without a real page behind it, and the wording stays
// inside what the source actually says. Brackets are contiguous over the
// whole age range and the daily pick is ageDays % facts.length: the fact of
// the day is deterministic — never random, never age-inappropriate.

export type FactSource = {
  name: string;
  url: string;
};

export type BabyFact = {
  /** One calm sentence, phrased for a tired parent — no jargon, no guilt. */
  text: string;
  source: FactSource;
};

export type FactBracket = {
  /** Inclusive age bounds in days; the last bracket runs to Infinity. */
  fromDay: number;
  toDay: number;
  facts: BabyFact[];
};

// Named sources — each fact points at exactly one of these.
const AAP_VISION: FactSource = {
  name: "AAP · Infant Vision Development",
  url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/Babys-Vision-Development.aspx",
};
const AAP_ONE_MONTH: FactSource = {
  name: "AAP · Milestones at 1 Month",
  url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/Developmental-Milestones-1-Month.aspx",
};
const AAP_TUMMY_TIME: FactSource = {
  name: "AAP · Back to Sleep, Tummy to Play",
  url: "https://www.healthychildren.org/English/ages-stages/baby/sleep/Pages/back-to-sleep-tummy-to-play.aspx",
};
const AAP_FIRST_SMILE: FactSource = {
  name: "AAP · When Do Babies First Smile?",
  url: "https://www.healthychildren.org/English/tips-tools/ask-the-pediatrician/Pages/When-do-babies-first-smile.aspx",
};
const AAP_MOVEMENT_4_7: FactSource = {
  name: "AAP · Movement: 4 to 7 Months",
  url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/Movement-4-to-7-Months.aspx",
};
const AAP_MOVEMENT_8_12: FactSource = {
  name: "AAP · Movement: 8 to 12 Months",
  url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/Movement-8-to-12-Months.aspx",
};
const AAP_MIND_8_12: FactSource = {
  name: "AAP · Cognitive Development: 8 to 12 Months",
  url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/Cognitive-Development-8-to-12-Months.aspx",
};
const AAP_SLEEP_HOURS: FactSource = {
  name: "AAP · How Many Hours of Sleep?",
  url: "https://www.healthychildren.org/English/healthy-living/sleep/Pages/healthy-sleep-habits-how-many-hours-does-your-child-need.aspx",
};
const AAO_FIRST_YEAR: FactSource = {
  name: "American Academy of Ophthalmology",
  url: "https://www.aao.org/eye-health/tips-prevention/baby-vision-development-first-year",
};
const WHO_FEEDING: FactSource = {
  name: "World Health Organization",
  url: "https://www.who.int/health-topics/breastfeeding",
};
const NHS_WEIGHT: FactSource = {
  name: "NHS · Baby height and weight",
  url: "https://www.nhs.uk/baby/babys-development/height-weight-and-reviews/baby-height-and-weight/",
};
const AAP_SEVEN_MONTHS: FactSource = {
  name: "AAP · Milestones: 4 to 7 Months",
  url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/Developmental-Milestones-7-Months.aspx",
};
const AAP_LANGUAGE_8_12: FactSource = {
  name: "AAP · Language: 8 to 12 Months",
  url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/Language-Development-8-to-12-Months.aspx",
};
const AAP_SOCIAL_0_3: FactSource = {
  name: "AAP · Social Development: Birth to 3 Months",
  url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/Emotional-and-Social-Development-Birth-to-3-Months.aspx",
};

export const FACT_BRACKETS: FactBracket[] = [
  {
    // The first two weeks: senses that are already switched on.
    fromDay: 0,
    toDay: 13,
    facts: [
      {
        text: "Your baby sees you best from 20–30 cm away — almost exactly the distance to your face during a feed.",
        source: AAP_VISION,
      },
      {
        text: "Hearing is fully mature at birth — your baby may already turn toward familiar voices.",
        source: AAP_ONE_MONTH,
      },
      {
        text: "Your baby can recognise the scent of their own mother's milk — smell is working from day one.",
        source: AAP_ONE_MONTH,
      },
      {
        text: "Losing a little weight in the first days is normal — most babies are back at birthweight by 3 weeks.",
        source: NHS_WEIGHT,
      },
      {
        text: "Faces are your baby's favourite thing to look at — preferred over any other pattern.",
        source: AAP_ONE_MONTH,
      },
      {
        text: "Those fleeting newborn smiles are practice runs — the real social smile arrives by the end of month two.",
        source: AAP_FIRST_SMILE,
      },
      {
        text: "Your baby prefers sweet smells and turns away from bitter ones — taste and smell arrived ready.",
        source: AAP_ONE_MONTH,
      },
      {
        text: "Talk softly and watch the tiny lip movements — that's your baby holding their side of the conversation.",
        source: AAP_SOCIAL_0_3,
      },
    ],
  },
  {
    // Weeks 2–5: building strength, waiting on the first real smile.
    fromDay: 14,
    toDay: 41,
    facts: [
      {
        text: "Tummy time can start small: 3–5 supervised minutes, 2–3 times a day, while your baby is awake.",
        source: AAP_TUMMY_TIME,
      },
      {
        text: "A real social smile is on its way — it usually appears by the end of the second month.",
        source: AAP_FIRST_SMILE,
      },
      {
        text: "High-contrast patterns fascinate your baby right now — bold shapes are easiest for new eyes.",
        source: AAP_ONE_MONTH,
      },
      {
        text: "Your baby still sees best at 20–30 cm — keep your face close and chat away.",
        source: AAP_VISION,
      },
      {
        text: "Newborn eyes sometimes wander or cross — completely normal now, and it settles by 2–3 months.",
        source: AAP_VISION,
      },
      {
        text: "Keep narrating your day — by around 3 months your chat starts getting answered with smiles.",
        source: AAP_SOCIAL_0_3,
      },
    ],
  },
  {
    // Weeks 6–12: the smile lands, the eyes team up.
    fromDay: 42,
    toDay: 89,
    facts: [
      {
        text: "That smile is real: a baby's first social smile usually appears by the end of the second month.",
        source: AAP_FIRST_SMILE,
      },
      {
        text: "Around 2–3 months the newborn eye-wander settles — your baby's eyes are learning to work as a team.",
        source: AAP_VISION,
      },
      {
        text: "By 3 months your baby can follow a moving object with their eyes — try a slow toy sweep.",
        source: AAP_VISION,
      },
      {
        text: "Tummy time can build toward 15–30 minutes a day around 7 weeks — short sessions still count.",
        source: AAP_TUMMY_TIME,
      },
      {
        text: "Your voice alone can now raise a smile — babies this age smile when you talk to them.",
        source: AAP_SOCIAL_0_3,
      },
      {
        text: "A few calm minutes of solo play builds self-soothing — the skill that later helps with settling to sleep.",
        source: AAP_SOCIAL_0_3,
      },
    ],
  },
  {
    // Months 3–5: colour arrives, hands get organised.
    fromDay: 90,
    toDay: 149,
    facts: [
      {
        text: "By 4 months your baby is much better at seeing colours — and the shades between them.",
        source: AAP_VISION,
      },
      {
        text: "Babies of 4–12 months do best on 12–16 hours of sleep in 24, naps included.",
        source: AAP_SLEEP_HOURS,
      },
      {
        text: "Grabbing starts whole-hand, like a mitten — the neat finger-and-thumb grip arrives around 9 months.",
        source: AAP_MOVEMENT_4_7,
      },
      {
        text: "Rolling practice is underway — by around 7 months most babies can roll both directions.",
        source: AAP_MOVEMENT_4_7,
      },
      {
        text: "Between 4 and 7 months some of the most important changes happen quietly — senses and movement start working as a team.",
        source: AAP_SEVEN_MONTHS,
      },
      {
        text: "Babbled chains — ba-ba-ba, ma-ma-ma — are real language practice. Answer back!",
        source: AAP_SEVEN_MONTHS,
      },
      {
        text: "Your baby is learning their own name — watch for the head turn when you say it.",
        source: AAP_SEVEN_MONTHS,
      },
      {
        text: "Your tone speaks before your words — babies this age tell emotions apart by how you sound.",
        source: AAP_SEVEN_MONTHS,
      },
      {
        text: "Following moving things keeps sharpening — a slowly rolling ball is prime entertainment.",
        source: AAP_SEVEN_MONTHS,
      },
    ],
  },
  {
    // Months 5–7: depth perception, first foods, sitting up.
    fromDay: 150,
    toDay: 209,
    facts: [
      {
        text: "Around 5 months depth perception arrives — your baby can now spot you across the room.",
        source: AAO_FIRST_YEAR,
      },
      {
        text: "Around 6 months babies are ready to start exploring first foods alongside their milk.",
        source: WHO_FEEDING,
      },
      {
        text: "Between 6 and 8 months most babies learn to sit upright without leaning on their arms.",
        source: AAP_MOVEMENT_4_7,
      },
      {
        text: "By around 7 months most babies roll both ways — clear floor, big adventures.",
        source: AAP_MOVEMENT_4_7,
      },
      {
        text: "Hide a toy half under a blanket — finding partly hidden things is a brand-new skill this season.",
        source: AAP_SEVEN_MONTHS,
      },
      {
        text: "Your baby reads the room now — responding to other people's emotions, and often simply joyful.",
        source: AAP_SEVEN_MONTHS,
      },
      {
        text: "From 6 to 12 months, breastmilk can still provide half or more of a baby's nutritional needs.",
        source: WHO_FEEDING,
      },
    ],
  },
  {
    // Months 7–9: object permanence, the famous pincer grasp.
    fromDay: 210,
    toDay: 269,
    facts: [
      {
        text: "Peekaboo is brain-building: your baby is learning that things still exist when out of sight.",
        source: AAP_MIND_8_12,
      },
      {
        text: "The pincer grasp — finger and thumb — usually clicks in around 9 months. Tiny objects, big skill.",
        source: AAP_MOVEMENT_4_7,
      },
      {
        text: "By around 9 months babies judge distance well — handy for the crawling adventures ahead.",
        source: AAO_FIRST_YEAR,
      },
      {
        text: "Sitting steadily without support usually lands in this stretch — hands finally free for toys.",
        source: AAP_MOVEMENT_8_12,
      },
      {
        text: "Your baby understands far more words than they can say — name a favourite toy and watch their eyes find it.",
        source: AAP_LANGUAGE_8_12,
      },
      {
        text: "Pointing and gesturing counts as talking — it's the bridge your baby crosses on the way to words.",
        source: AAP_LANGUAGE_8_12,
      },
    ],
  },
  {
    // Months 9–12: the pre-walking curriculum.
    fromDay: 270,
    toDay: 365,
    facts: [
      {
        text: "Pulling up to stand, then cruising along the furniture — the pre-walking curriculum is in session.",
        source: AAP_MOVEMENT_8_12,
      },
      {
        text: "Many first steps arrive around the first birthday — earlier or later is completely normal.",
        source: AAP_MOVEMENT_8_12,
      },
      {
        text: "Keep switching up peekaboo — the game teaches your baby that hidden things still exist.",
        source: AAP_MIND_8_12,
      },
      {
        text: "That thumb-and-finger pickup of every crumb is the pincer grasp — right on schedule from about 9 months.",
        source: AAP_MOVEMENT_4_7,
      },
      {
        text: "'Mama' often first slips out by accident — then your baby notices the attention it wins and says it on purpose.",
        source: AAP_LANGUAGE_8_12,
      },
      {
        text: "Your baby is copying the gestures you make while you talk — you are the curriculum.",
        source: AAP_LANGUAGE_8_12,
      },
      {
        text: "Understanding runs ahead of speech — your baby comprehends more than you suspect.",
        source: AAP_LANGUAGE_8_12,
      },
    ],
  },
  {
    // One year and beyond: walking, still growing on milk and meals.
    fromDay: 366,
    toDay: Infinity,
    facts: [
      {
        text: "From first steps to confident walking often takes just days — and starting later is normal too.",
        source: AAP_MOVEMENT_8_12,
      },
      {
        text: "New walkers go wide-legged and wobbly on purpose — feet apart is how they balance.",
        source: AAP_MOVEMENT_8_12,
      },
      {
        text: "WHO supports continued breastfeeding up to 2 years or beyond, alongside family foods.",
        source: WHO_FEEDING,
      },
      {
        text: "Peekaboo, hide-the-toy, where-did-it-go — object permanence games stay favourites well past the first year.",
        source: AAP_MIND_8_12,
      },
      {
        text: "Toddlers of 1–2 years do best on 11–14 hours of sleep in 24, naps included.",
        source: AAP_SLEEP_HOURS,
      },
      {
        text: "In the second year, breastmilk can still provide up to a third of a child's nutritional needs.",
        source: WHO_FEEDING,
      },
    ],
  },
];

/**
 * The fact for a given age in whole days. Deterministic: the same day always
 * shows the same fact, tomorrow rotates to the next one in the bracket.
 * Null for unknown or impossible ages (no birth date, future birth date).
 */
export function factOfTheDay(ageDays: number): BabyFact | null {
  if (!Number.isFinite(ageDays) || ageDays < 0) return null;
  const days = Math.floor(ageDays);
  const bracket = FACT_BRACKETS.find((b) => days >= b.fromDay && days <= b.toDay);
  if (!bracket) return null;
  return bracket.facts[days % bracket.facts.length];
}
