// "Is she getting enough?" — the question every bottle-feeding parent asks,
// answered against the baby's own weight instead of a stranger's average.
//
// AAP: "your baby should take in about 2½ ounces (75 mL) of infant formula a
// day for every pound (453 g) of body weight", and "no more than an average
// of about 32 ounces (960 mL) of formula in 24 hours".
// https://www.healthychildren.org/English/ages-stages/baby/formula-feeding/Pages/Amount-and-Schedule-of-Formula-Feedings.aspx
//
// TWO THINGS THIS MUST NEVER DO, and both are enforced by the caller contract
// below rather than left to the UI:
//
//   1. Never target a breastfed baby. NHS is explicit that breastfeeding is
//      not volume-led — a mother reading "you are 200 ml short" would be
//      given a number that means nothing and a worry that is entirely
//      manufactured. guidanceFor returns null unless bottles are the story.
//   2. Never grade. It reports where the day sits against a published
//      reference, and stops. No "too little", no target to hit, no streak.

/** Millilitres of formula per kilogram of body weight per day (AAP: 75 ml / 453 g). */
export const ML_PER_KG_PER_DAY = 75 / 0.453;

/** AAP's stated ceiling for a day's formula, whatever the weight suggests. */
export const DAILY_ML_CEILING = 960;

export type IntakeGuidance = {
  weightKg: number;
  /** The reference band, already capped at the daily ceiling. */
  lowMl: number;
  highMl: number;
  /** Whether the weight-derived figure was clipped by the 960 ml ceiling. */
  cappedByCeiling: boolean;
  /** Where the family's typical day sits: "below" | "within" | "above". */
  position: "below" | "within" | "above";
  typicalMl: number;
};

/**
 * The reference band for a weight, and where a typical day sits in it.
 *
 * @param weightGrams the most recent logged weight
 * @param typicalMl the family's median bottle day over the recent window
 * @param bottleDays how many recent days actually carried a bottle — the band
 *        is meaningless on one stray day, so thin data returns null
 * @param feedingMode breastfed families are never volume-targeted
 */
export function guidanceFor(
  weightGrams: number | undefined,
  typicalMl: number,
  bottleDays: number,
  feedingMode: "mixed" | "breast" | "bottle",
): IntakeGuidance | null {
  if (feedingMode === "breast") return null;
  if (!weightGrams || weightGrams <= 0) return null;
  // Three days is the floor: fewer and a single unusual day sets the median.
  if (bottleDays < 3 || typicalMl <= 0) return null;

  const weightKg = weightGrams / 1_000;
  const centre = weightKg * ML_PER_KG_PER_DAY;
  // A band rather than a point: "about" in the source means about.
  const rawLow = centre * 0.9;
  const rawHigh = centre * 1.1;
  const lowMl = Math.round(Math.min(rawLow, DAILY_ML_CEILING));
  const highMl = Math.round(Math.min(rawHigh, DAILY_ML_CEILING));

  return {
    weightKg,
    lowMl,
    highMl,
    cappedByCeiling: rawHigh > DAILY_ML_CEILING,
    position: typicalMl < lowMl ? "below" : typicalMl > highMl ? "above" : "within",
    typicalMl: Math.round(typicalMl),
  };
}
