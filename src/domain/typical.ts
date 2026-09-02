// "Is this normal?" — the question a parent actually types into a phone at
// 3am, answered from their own log against published ranges.
//
// Three rules hold this file together:
//
// 1. A RANGE, never a target. A baby at the bottom of the range is not
//    behind, and one above it is not ahead. The copy says "usual", never
//    "should".
// 2. Every band carries the page it came from. A reassurance nobody can
//    check is worth nothing to a frightened parent at 3am.
// 3. It NEVER says a day is fine. The alarming cases belong to
//    insightRules.ts, which is far more careful; this side only ever says
//    "ordinary" or "worth a look, here is the page", and stays silent about
//    the day still being lived, because a morning is not a day.

import { DaySummary } from "./daySummary";
// AAP_TUMMY_TIME is the safe-sleep page, the citable home for the hours.
import { AAP_FIRST_DAYS, AAP_HOW_OFTEN, AAP_POOPING, AAP_TUMMY_TIME as AAP_SLEEP, FactSource, NHS_NAPPY } from "./sources";

export type TypicalBand = {
  label: string;
  /** Inclusive. A null high end means "no usual ceiling" — babies feed to
      appetite and a busy day is not a finding. */
  low: number;
  high: number | null;
  source: FactSource;
  /** Said when the day sits inside the band. */
  ordinary: string;
  /** Said when it does not — never an instruction, always the range. */
  outside: string;
};

export type TypicalCheck = {
  id: "feeds" | "wet" | "dirty" | "sleep";
  label: string;
  /** What today (or yesterday) actually holds. */
  value: number;
  /** "8" or "6+" or "14–17h". */
  range: string;
  within: boolean;
  note: string;
  source: FactSource;
};

export type TypicalVerdict = {
  /** Every check that could be made. Empty when the log has too little. */
  checks: TypicalCheck[];
  /** True only when every check that could be made came back inside. */
  ordinary: boolean;
};

const hours = (minutes: number) => `${Math.round(minutes / 60)}h`;

/** Feeds in 24 hours. AAP: 8–12 for a newborn, easing as they grow. */
function feedBand(ageDays: number): TypicalBand {
  if (ageDays <= 41) {
    return {
      label: "Feeds",
      low: 8,
      high: 12,
      source: AAP_HOW_OFTEN,
      ordinary: "AAP puts 8 to 12 feeds in 24 hours as usual in the first weeks.",
      outside: "AAP puts 8 to 12 feeds in 24 hours as usual in the first weeks — babies feed to appetite, and a busy day or a quiet one is not a verdict.",
    };
  }
  if (ageDays <= 180) {
    return {
      label: "Feeds",
      low: 5,
      high: 10,
      source: AAP_HOW_OFTEN,
      ordinary: "Feeds usually space out to five to ten a day by this age.",
      outside: "Feeds usually space out to five to ten a day by this age — every baby settles somewhere of their own.",
    };
  }
  return {
    label: "Feeds",
    low: 4,
    high: 8,
    source: AAP_HOW_OFTEN,
    ordinary: "Four to eight milk feeds a day is usual once solids have started.",
    outside: "Four to eight milk feeds a day is usual once solids have started, alongside meals.",
  };
}

/** Wet nappies. The one number with a real floor after the first week. */
function wetBand(ageDays: number): TypicalBand {
  if (ageDays <= 1) {
    return {
      label: "Wet nappies",
      low: 1,
      high: 3,
      source: AAP_FIRST_DAYS,
      ordinary: "In the first 48 hours two or three wet nappies is the whole of it.",
      outside: "In the first 48 hours two or three wet nappies is what to expect.",
    };
  }
  if (ageDays <= 4) {
    return {
      label: "Wet nappies",
      low: 3,
      high: null,
      source: AAP_FIRST_DAYS,
      ordinary: "The count climbs with your milk over the first days.",
      outside: "The count climbs with your milk over the first days, reaching six or more by day five.",
    };
  }
  return {
    label: "Wet nappies",
    low: 6,
    high: null,
    source: NHS_NAPPY,
    ordinary: "AAP and NHS both put six or more heavy wet nappies a day as the mark of a baby getting enough.",
    outside: "AAP and NHS both put six or more heavy wet nappies a day as the mark of a baby getting enough.",
  };
}

/** Dirty nappies. Frequent early; long gaps become ordinary after six weeks,
    which is exactly the thing parents panic about at 3am. */
function dirtyBand(ageDays: number): TypicalBand | null {
  if (ageDays <= 3) return null;
  if (ageDays <= 41) {
    return {
      label: "Dirty nappies",
      low: 2,
      high: null,
      source: AAP_POOPING,
      ordinary: "From about day four, at least two soft yellow poos a day is usual for the first weeks.",
      outside: "From about day four, at least two soft yellow poos a day is usual for the first weeks.",
    };
  }
  return {
    label: "Dirty nappies",
    low: 0,
    high: null,
    source: AAP_POOPING,
    ordinary: "After about six weeks a gap of days between poos is ordinary, as long as feeding and weight are fine.",
    outside: "After about six weeks a gap of days between poos is ordinary, as long as feeding and weight are fine.",
  };
}

/** Total sleep in 24 hours, per the AASM/NSF consensus ranges. */
function sleepBand(ageDays: number): TypicalBand {
  if (ageDays <= 90) {
    return {
      label: "Sleep",
      low: 14 * 60,
      high: 17 * 60,
      source: AAP_SLEEP,
      ordinary: "Fourteen to seventeen hours a day, in stretches of every length, is usual under three months.",
      outside: "Fourteen to seventeen hours a day is the usual span under three months — and a day logged in pieces rarely adds up to all of it.",
    };
  }
  return {
    label: "Sleep",
    low: 12 * 60,
    high: 16 * 60,
    source: AAP_SLEEP,
    ordinary: "Twelve to sixteen hours a day, naps included, is usual at this age.",
    outside: "Twelve to sixteen hours a day, naps included, is the usual span at this age.",
  };
}

const inside = (value: number, band: TypicalBand) => value >= band.low && (band.high === null || value <= band.high);

const rangeLabel = (band: TypicalBand, asHours: boolean) => {
  // "0+" is not a range, it is a shrug. After six weeks there genuinely is
  // no expected number of poos, and saying so is the reassurance.
  if (band.low === 0 && band.high === null) return "any";
  const low = asHours ? hours(band.low) : String(band.low);
  if (band.high === null) return `${low}+`;
  return `${asHours ? Math.round(band.low / 60) : band.low}–${asHours ? hours(band.high) : band.high}`;
};

/**
 * Read one whole day against the published ranges.
 *
 * `day` must be a day that is OVER — a morning holds two feeds and no
 * verdict. Returns no checks at all when the age is unknown or the day was
 * never logged, because a blank day is not a low one.
 */
export function typicalVerdict(day: DaySummary | undefined, ageDays: number | null): TypicalVerdict {
  const checks: TypicalCheck[] = [];
  if (!day || ageDays === null || day.isEmpty) return { checks, ordinary: false };

  const add = (id: TypicalCheck["id"], band: TypicalBand | null, value: number, asHours = false) => {
    if (!band) return;
    const within = inside(value, band);
    checks.push({
      id,
      label: band.label,
      value,
      range: rangeLabel(band, asHours),
      within,
      note: within ? band.ordinary : band.outside,
      source: band.source,
    });
  };

  if (day.feeds > 0) add("feeds", feedBand(ageDays), day.feeds);
  if (day.diapers > 0) {
    add("wet", wetBand(ageDays), day.wet);
    add("dirty", dirtyBand(ageDays), day.dirty);
  }
  // Sleep is only worth reading when the family logs it at all; a household
  // that tracks feeds only would otherwise be told every day that its baby
  // sleeps four hours.
  if (day.sleepMinutes >= 6 * 60) add("sleep", sleepBand(ageDays), day.sleepMinutes, true);

  return { checks, ordinary: checks.length > 0 && checks.every((check) => check.within) };
}

/** The headline over the verdict — the answer, before the evidence. */
export function verdictHeadline(verdict: TypicalVerdict, name: string): string {
  const who = name.trim() || "your baby";
  if (verdict.ordinary) return `Yesterday looks ordinary for ${who}`;
  const outside = verdict.checks.filter((check) => !check.within);
  if (outside.length === 1) return `Yesterday: ${outside[0].label.toLowerCase()} sat outside the usual range`;
  return `Yesterday: ${outside.length} figures sat outside the usual range`;
}
