// "What is the log telling me?" — the rules that turn this family's own
// entries into at most three cards, ranked so a call-your-doctor card always
// outranks a reassurance.
//
// Three invariants make this safe enough to ship to a frightened parent:
//
//   1. NEVER TODAY. Count rules read only COMPLETE days. Today is half-lived;
//      "2 wet nappies" at 9am is not a finding, it is a morning.
//   2. GATED ON LOGGING. Every count rule first checks that the category was
//      actually being logged over the window. A missed tap must look like a
//      missed tap, never like a missed feed.
//   3. NEVER A DIAGNOSIS. A seek-care card says what the source says, says
//      what to do, and names the page. It never concludes anything about the
//      baby, and it always allows that the log may simply be incomplete.
//
// Pure: no React, no clock of its own — `now` is always passed in.

import { DaySummary } from "./daySummary";
import { median } from "./time";
import { typicalWeeklyGain } from "./growthReference";
import {
  AAP_DEHYDRATION,
  AAP_ENOUGH_MILK,
  AAP_FEVER,
  AAP_FIRST_MONTH,
  AAP_FORMULA_AMOUNT,
  AAP_HOW_OFTEN,
  AAP_POOPING,
  AAP_BURPING,
  FactSource,
  NHS_CLUSTER,
  NHS_ENOUGH_MILK,
  NHS_NAPPY,
  NHS_URGENT_HELP,
  NHS_WEIGHT,
} from "./sources";
import { Activity, FeedingMode } from "./types";

export type InsightTone = "seek-care" | "suggest" | "reassure";

export type Insight = {
  id: string;
  tone: InsightTone;
  priority: number;
  /** The heading a parent scans. */
  title: string;
  /** What the log shows and what the source says about it. */
  body: string;
  /** What to actually do. Never absent — sometimes it is "nothing". */
  advice: string;
  sources: FactSource[];
};

export type InsightInput = {
  /** Age in whole days, or null when there is no usable birth date. */
  ageDays: number | null;
  ageMonths: number | null;
  feedingMode: FeedingMode;
  /** Complete days only, oldest first. Today is deliberately excluded. */
  days: DaySummary[];
  /** Growth entries carrying a weight, oldest first. */
  weights: Activity[];
  latestTemperatureC?: number;
  latestTemperatureAt?: string;
  lastFeedAt?: string;
  lastDirtyAt?: string;
  /** Millilitres of every bottle logged with an amount in the window. */
  recentBottleMl: number[];
  recentBurps: number;
  now: number;
};

export const MAX_INSIGHTS = 3;

// AAP's call-the-doctor thresholds, which step down as the baby gets older.
// An unknown age fails safe: it uses the strictest (newborn) threshold.
export function feverThresholdC(ageDays: number | null): number {
  if (ageDays === null || ageDays < 90) return 38.0;
  if (ageDays < 180) return 38.3;
  return 39.4;
}

const HOUR = 3_600_000;
const DAY = 86_400_000;

function hoursSince(iso: string | undefined, now: number): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  if (Number.isNaN(ms)) return null;
  return (now - ms) / HOUR;
}

function daysBetween(a: Activity, b: Activity): number {
  return Math.abs(new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()) / DAY;
}

function gramsPerWeek(a: Activity, b: Activity): number | null {
  const span = daysBetween(a, b);
  if (!a.weightGrams || !b.weightGrams || span < 1) return null;
  return ((b.weightGrams - a.weightGrams) / span) * 7;
}

/** How many of the last `n` complete days carry at least one entry of a kind. */
function loggedDays(days: DaySummary[], n: number, has: (day: DaySummary) => boolean): number {
  return days.slice(-n).filter(has).length;
}

const hasDiaper = (day: DaySummary) => day.diapers > 0;
const hasFeed = (day: DaySummary) => day.feeds > 0;

function round(value: number): number {
  return Math.round(value);
}

type Rule = {
  id: string;
  tone: InsightTone;
  priority: number;
  sources: FactSource[];
  evaluate: (input: InsightInput) => { title: string; body: string; advice: string } | null;
};

const RULES: Rule[] = [
  // ——— seek care ————————————————————————————————————————————————
  {
    id: "fever-for-age",
    tone: "seek-care",
    priority: 190,
    sources: [AAP_FEVER, NHS_URGENT_HELP],
    evaluate: ({ latestTemperatureC, latestTemperatureAt, ageDays, now }) => {
      const hours = hoursSince(latestTemperatureAt, now);
      if (latestTemperatureC === undefined || hours === null || hours > 24) return null;
      // The upper guard rejects a mistyped value rather than shouting about it.
      if (latestTemperatureC < feverThresholdC(ageDays) || latestTemperatureC >= 43) return null;
      const threshold = feverThresholdC(ageDays).toFixed(1);
      return {
        title: "That temperature is worth a phone call",
        body: `You logged ${latestTemperatureC.toFixed(1)} °C. AAP's call-the-doctor threshold changes with age and is ${threshold} °C for yours.`,
        advice:
          ageDays !== null && ageDays < 90
            ? "Call your paediatrician now, even if your baby otherwise seems fine. NHS lists 38 °C or more in a baby under 3 months as a reason to seek urgent help."
            : "Call your paediatrician today and describe how your baby is behaving, not just the number.",
      };
    },
  },
  {
    id: "low-temperature-newborn",
    tone: "seek-care",
    priority: 186,
    sources: [NHS_URGENT_HELP],
    evaluate: ({ latestTemperatureC, latestTemperatureAt, ageDays, now }) => {
      const hours = hoursSince(latestTemperatureAt, now);
      if (latestTemperatureC === undefined || hours === null || hours > 24) return null;
      // Above 30 rejects a mistyped 3.6; unknown age fails safe and fires.
      if (latestTemperatureC > 36.0 || latestTemperatureC <= 30) return null;
      if (ageDays !== null && ageDays > 90) return null;
      return {
        title: "A low temperature matters as much as a fever",
        body: `You logged ${latestTemperatureC.toFixed(1)} °C. NHS lists a temperature of 36 °C or below in a young baby alongside 38 °C or above as a reason to get urgent help.`,
        advice:
          "Get urgent advice now — especially if your baby also feels cold to the touch, is sleepier than usual, or is not feeding.",
      };
    },
  },
  {
    id: "wet-nappies-very-low",
    tone: "seek-care",
    priority: 174,
    sources: [AAP_DEHYDRATION, NHS_ENOUGH_MILK],
    evaluate: ({ ageDays, days }) => {
      const yesterday = days.at(-1);
      if (ageDays === null || ageDays < 7 || !yesterday || yesterday.diapers === 0) return null;
      if (loggedDays(days, 7, hasDiaper) < 5 || yesterday.wet > 2) return null;
      return {
        title: `Only ${yesterday.wet} wet ${yesterday.wet === 1 ? "nappy" : "nappies"} logged yesterday`,
        body:
          "AAP lists weeing only once or twice a day among the signs of serious dehydration. This counts what was logged — if changes went unrecorded, the real number is higher.",
        advice:
          "Look at your baby rather than at this screen: dry mouth, no tears when crying, a sunken soft spot, unusual sleepiness. Then call your paediatrician today.",
      };
    },
  },
  {
    id: "wet-nappies-below-six",
    tone: "seek-care",
    priority: 168,
    sources: [AAP_ENOUGH_MILK, NHS_ENOUGH_MILK],
    evaluate: ({ ageDays, days }) => {
      const yesterday = days.at(-1);
      if (ageDays === null || ageDays < 7 || !yesterday || yesterday.diapers === 0) return null;
      if (loggedDays(days, 7, hasDiaper) < 5) return null;
      if (yesterday.wet < 3 || yesterday.wet >= 6) return null;
      return {
        title: `${yesterday.wet} wet nappies logged yesterday, against a floor of 6`,
        body:
          "After the first week, both AAP and NHS put at least 6 heavy wet nappies a day as the mark of a baby getting enough milk.",
        advice:
          "Watch today's nappies as they come. If the count is still under 6, ring your midwife, health visitor or paediatrician today.",
      };
    },
  },
  {
    id: "under-birthweight-at-three-weeks",
    tone: "seek-care",
    priority: 164,
    sources: [NHS_WEIGHT],
    evaluate: ({ ageDays, weights, now }) => {
      if (ageDays === null || ageDays < 21 || weights.length < 2) return null;
      const first = weights[0];
      const last = weights.at(-1)!;
      const hours = hoursSince(last.startedAt, now);
      if (!first.weightGrams || !last.weightGrams || hours === null || hours > 10 * 24) return null;
      if (last.weightGrams >= first.weightGrams) return null;
      return {
        title: "Still under the first weight you logged",
        body: `You logged ${first.weightGrams} g first and ${last.weightGrams} g most recently. NHS: most babies are at, or above, their birthweight by 3 weeks.`,
        advice:
          "Home scales drift. Ask your midwife, health visitor or paediatrician to weigh your baby on theirs — do not change how you feed on the strength of this alone.",
      };
    },
  },
  {
    id: "weekly-gain-low",
    tone: "seek-care",
    priority: 158,
    sources: [AAP_ENOUGH_MILK, NHS_WEIGHT],
    evaluate: ({ ageDays, weights, now }) => {
      if (ageDays === null || ageDays < 21 || weights.length < 2) return null;
      const previous = weights.at(-2)!;
      const last = weights.at(-1)!;
      const span = daysBetween(previous, last);
      const hours = hoursSince(last.startedAt, now);
      if (span < 7 || span > 35 || hours === null || hours > 14 * 24) return null;
      const gain = gramsPerWeek(previous, last);
      if (gain === null || gain >= 100) return null;
      return {
        title: "Weight gain looks slower than the usual range",
        body: `About ${round(gain)} g a week between your last two weights, ${round(span)} days apart. AAP treats a baby not gaining steadily as a reason to get weighed properly.`,
        advice:
          "Ask your health visitor or paediatrician for a weigh-in on their scales before you change anything.",
      };
    },
  },
  {
    id: "no-stool-three-days-early",
    tone: "seek-care",
    priority: 152,
    sources: [NHS_ENOUGH_MILK],
    evaluate: ({ ageDays, days }) => {
      if (ageDays === null || ageDays < 7 || ageDays > 42) return null;
      const last3 = days.slice(-3);
      if (last3.length < 3 || last3.some((day) => day.diapers === 0)) return null;
      if (last3.some((day) => day.dirty > 0) || last3.some((day) => day.wet === 0)) return null;
      return {
        title: "Three logged days with no poo",
        body:
          "NHS: from about the fourth day expect at least 2 soft yellow poos a day for the first few weeks. Long gaps become normal after about 6 weeks — your baby is not there yet.",
        advice: "Ring your midwife, health visitor or GP today and mention the gap, and how feeds are going.",
      };
    },
  },

  // ——— suggestions ——————————————————————————————————————————————
  {
    id: "long-gap-since-feed-newborn",
    tone: "suggest",
    priority: 90,
    sources: [AAP_HOW_OFTEN],
    evaluate: ({ ageDays, lastFeedAt, days, now }) => {
      const hours = hoursSince(lastFeedAt, now);
      if (ageDays === null || ageDays > 28 || hours === null || hours < 5) return null;
      if (loggedDays(days, 3, hasFeed) < 3) return null;
      return {
        title: `${Math.floor(hours)} hours since the last logged feed`,
        body:
          "AAP: if a newborn sleeps longer than 4 to 5 hours in the first weeks and starts missing feeds, wake them and offer one.",
        advice: "If you fed and did not log it, add it and this card goes away.",
      };
    },
  },
  {
    id: "poo-gap-worth-mentioning",
    tone: "suggest",
    priority: 82,
    sources: [AAP_POOPING],
    evaluate: ({ ageDays, feedingMode, lastDirtyAt, days, now }) => {
      const hours = hoursSince(lastDirtyAt, now);
      if (ageDays === null || hours === null || loggedDays(days, 3, hasDiaper) < 3) return null;
      const overdue =
        feedingMode === "bottle" ? hours > 72 : ageDays >= 21 && hours > 7 * 24;
      if (!overdue) return null;
      return {
        title: `${Math.floor(hours / 24)} days since the last logged poo`,
        body:
          "AAP: 5 to 7 days between poos is not necessarily a problem in a baby who has been pooing normally and is feeding and growing well. Past that is worth a mention.",
        advice:
          "Mention it at your next check, or ring sooner if your baby seems in pain, or the poo when it comes is hard or bloody.",
      };
    },
  },
  {
    id: "formula-above-daily-guide",
    tone: "suggest",
    priority: 76,
    sources: [AAP_FORMULA_AMOUNT],
    evaluate: ({ feedingMode, ageDays, days }) => {
      if (feedingMode === "breast" || ageDays === null || ageDays >= 365) return null;
      const bottleDays = days.filter((day) => day.ml > 0);
      if (bottleDays.length < 3) return null;
      const typical = median(bottleDays.map((day) => day.ml));
      if (typical <= 960) return null;
      return {
        title: "Bottle totals are running above the usual daily guide",
        body: `Your median bottle day is about ${typical} ml. AAP: babies generally do not need more than about 960 ml of formula in 24 hours.`,
        advice:
          "Mention the daily total at your next appointment. Keep following fullness cues — never push the last of a bottle to hit or avoid a number.",
      };
    },
  },
  {
    id: "burp-pause-on-big-bottles",
    tone: "suggest",
    priority: 68,
    sources: [AAP_BURPING],
    evaluate: ({ recentBottleMl, recentBurps, days }) => {
      if (recentBottleMl.length < 6 || recentBurps > 0) return null;
      if (days.filter((day) => day.bottles > 0).length < 3) return null;
      const typical = median(recentBottleMl);
      if (typical < 90) return null;
      return {
        title: "Worth a pause halfway through the bottle",
        body: `Your typical bottle is about ${typical} ml. AAP suggests burping about every 60 to 90 ml rather than once at the end.`,
        advice:
          "Try one pause halfway through the next bottle, and rotate the holds: on your shoulder, sitting on your lap, or face-down across your lap.",
      };
    },
  },

  // ——— reassurance ——————————————————————————————————————————————
  {
    id: "newborn-nappy-ramp",
    tone: "reassure",
    priority: 46,
    sources: [NHS_ENOUGH_MILK],
    evaluate: ({ ageDays, days }) => {
      if (ageDays === null || ageDays > 6) return null;
      if (!days.some(hasDiaper)) return null;
      return ageDays <= 1
        ? {
            title: "Two or three wet nappies is what today should look like",
            body: "NHS: in the first 48 hours your baby is likely to have only 2 or 3 wet nappies.",
            advice: "Keep logging each one. From day 5 the count climbs sharply, and that ramp is what matters.",
          }
        : {
            title: "The nappy count climbs from about day 5",
            body:
              "NHS: from day 5 onwards expect at least 6 heavy wet nappies every 24 hours, with the wee almost colourless or pale yellow.",
            advice: "Nothing to change. Keep logging every nappy so the ramp is visible when your midwife asks.",
          };
    },
  },
  {
    id: "cluster-feeding-day",
    tone: "reassure",
    priority: 42,
    sources: [NHS_CLUSTER],
    evaluate: ({ ageDays, days }) => {
      const yesterday = days.at(-1);
      if (ageDays === null || ageDays > 120 || !yesterday) return null;
      if (loggedDays(days, 7, hasFeed) < 5) return null;
      const earlier = days.slice(0, -1).filter(hasFeed).map((day) => day.feeds);
      if (earlier.length < 3) return null;
      const usual = median(earlier);
      if (yesterday.feeds < 12 || yesterday.feeds < usual + 4) return null;
      return {
        title: "Yesterday looks like a cluster-feeding day",
        body: `${yesterday.feeds} feeds, against your usual ${usual}. NHS: cluster feeding is very normal in the first 3 to 4 months and often comes with a growth spurt.`,
        advice: "Nothing to fix. Eat, drink, get comfortable and let the feeds come — it passes.",
      };
    },
  },
  {
    id: "poo-gap-normal-after-six-weeks",
    tone: "reassure",
    priority: 40,
    sources: [NHS_NAPPY, AAP_POOPING],
    evaluate: ({ ageDays, feedingMode, lastDirtyAt, days, now }) => {
      const hours = hoursSince(lastDirtyAt, now);
      const yesterday = days.at(-1);
      if (ageDays === null || ageDays < 42 || feedingMode === "bottle") return null;
      if (hours === null || hours < 48 || hours > 7 * 24) return null;
      if (loggedDays(days, 3, hasDiaper) < 3 || !yesterday || yesterday.wet < 5) return null;
      return {
        title: `${Math.floor(hours / 24)} days without a poo — normal at this age`,
        body:
          "NHS: after about 6 weeks a breastfed baby can go several days without one, and AAP agrees 5 to 7 days is not necessarily a problem when feeding and growing are fine.",
        advice:
          "Nothing to do. Ring your GP or health visitor if your baby seems in pain, the poo when it comes is very hard or bloody, or the wet nappies drop off.",
      };
    },
  },
  {
    id: "growth-steady",
    tone: "reassure",
    priority: 34,
    sources: [AAP_FIRST_MONTH],
    evaluate: ({ ageMonths, weights, now }) => {
      if (ageMonths === null || weights.length < 2) return null;
      const previous = weights.at(-2)!;
      const last = weights.at(-1)!;
      const span = daysBetween(previous, last);
      const hours = hoursSince(last.startedAt, now);
      if (span < 7 || hours === null || hours > 45 * 24) return null;
      const gain = gramsPerWeek(previous, last);
      const band = typicalWeeklyGain(ageMonths);
      if (gain === null || band === null || gain < band.minGramsPerWeek * 0.8) return null;
      return {
        title: "Weight is climbing at the usual rate",
        body: `About ${round(gain)} g a week between your last two weights. The typical band at this age is ${band.minGramsPerWeek}–${band.maxGramsPerWeek} g a week.`,
        advice: "Nothing to do. Under 6 months, one weight a month is enough for this to stay meaningful.",
      };
    },
  },
  {
    id: "feeds-in-normal-range",
    tone: "reassure",
    priority: 32,
    sources: [AAP_HOW_OFTEN],
    evaluate: ({ ageDays, days }) => {
      if (ageDays === null || ageDays > 120 || loggedDays(days, 7, hasFeed) < 5) return null;
      const typical = median(days.filter(hasFeed).map((day) => day.feeds));
      if (typical < 8 || typical > 14) return null;
      return {
        title: "That is a lot of feeds. It is also the normal number.",
        body: `Your median is ${typical} feeds a day. AAP: breastfed newborns usually nurse about every 2 hours, so 10 to 12 in 24 hours is the norm and 8 is the minimum.`,
        advice:
          "Nothing to change. Keep following the early cues — rooting, hands to the mouth, lip smacking. Crying is the late one.",
      };
    },
  },
];

/**
 * The cards to show, most urgent first, at most MAX_INSIGHTS of them.
 * A rule that cannot answer honestly returns null and simply does not appear.
 */
export function insightsFor(input: InsightInput): Insight[] {
  const found: Insight[] = [];
  for (const rule of RULES) {
    const result = rule.evaluate(input);
    if (!result) continue;
    found.push({
      id: rule.id,
      tone: rule.tone,
      priority: rule.priority,
      sources: rule.sources,
      ...result,
    });
  }
  return found.sort((a, b) => b.priority - a.priority).slice(0, MAX_INSIGHTS);
}

/**
 * Gather everything the rules read, from the raw activity list plus the
 * per-day summaries the app already computes. Kept here so the rules and
 * their inputs stay testable together, and so no screen has to know which
 * window a rule cares about.
 *
 * `recentDays` must END with today — today is stripped here, because no count
 * rule may ever read a half-lived day.
 */
export function buildInsightInput(options: {
  activities: Activity[];
  recentDays: DaySummary[];
  ageDays: number | null;
  ageMonths: number | null;
  feedingMode: FeedingMode;
  now: number;
}): InsightInput {
  const { activities, recentDays, ageDays, ageMonths, feedingMode, now } = options;
  const weekAgo = now - 7 * DAY;

  let latestTemperature: Activity | undefined;
  let lastFeed: Activity | undefined;
  let lastDirty: Activity | undefined;
  const weights: Activity[] = [];
  const recentBottleMl: number[] = [];
  let recentBurps = 0;

  for (const activity of activities) {
    const at = new Date(activity.startedAt).getTime();
    const isFeed = activity.type === "bottle" || activity.type === "nursing";
    if (isFeed && (!lastFeed || at > new Date(lastFeed.startedAt).getTime())) lastFeed = activity;
    if (
      activity.type === "diaper" &&
      (activity.diaperKind === "dirty" || activity.diaperKind === "both") &&
      (!lastDirty || at > new Date(lastDirty.startedAt).getTime())
    ) {
      lastDirty = activity;
    }
    if (activity.type === "health" && activity.temperatureC !== undefined) {
      if (!latestTemperature || at > new Date(latestTemperature.startedAt).getTime()) {
        latestTemperature = activity;
      }
    }
    if (activity.type === "growth" && activity.weightGrams) weights.push(activity);
    if (at >= weekAgo) {
      if (activity.type === "bottle" && activity.amount) recentBottleMl.push(activity.amount);
      if (activity.type === "burp") recentBurps += 1;
    }
  }

  weights.sort((a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime());

  return {
    ageDays,
    ageMonths,
    feedingMode,
    // Today is half-lived; only complete days may be counted.
    days: recentDays.slice(0, -1),
    weights,
    latestTemperatureC: latestTemperature?.temperatureC,
    latestTemperatureAt: latestTemperature?.startedAt,
    lastFeedAt: lastFeed?.startedAt,
    lastDirtyAt: lastDirty?.startedAt,
    recentBottleMl,
    recentBurps,
    now,
  };
}
