// WHO weight-for-age reference (0–24 months) and the parent-facing gain
// guidance the Growth guide screen reads from.
//
// Percentile table: WHO Child Growth Standards, weight-for-age percentiles,
// https://www.who.int/tools/child-growth-standards/standards/weight-for-age
// (boys/girls XLSX tables; corroborated by the CDC republication at
// https://www.cdc.gov/growthcharts/who-data-files.htm). Retrieved 2026-08-07.
// Values in kilograms, rounded to 0.1 kg.
//
// Weekly-gain bands: AAP / HealthyChildren.org "Physical Appearance and
// Growth" pages for the first month, 1–3 months and 4–7 months. Retrieved
// 2026-08-07. These are population averages, never targets — a baby's own
// centile curve is what matters, and that reading belongs to their clinician.

export type Sex = "girl" | "boy";

export type WeightPercentiles = {
  p3: number;
  p15: number;
  p50: number;
  p85: number;
  p97: number;
};

export type ReferenceRow = WeightPercentiles & { month: number };

export const WHO_WEIGHT_FOR_AGE: Record<"boys" | "girls", readonly ReferenceRow[]> = {
  boys: [
    { month: 0, p3: 2.5, p15: 2.9, p50: 3.3, p85: 3.9, p97: 4.3 },
    { month: 1, p3: 3.4, p15: 3.9, p50: 4.5, p85: 5.1, p97: 5.7 },
    { month: 2, p3: 4.4, p15: 4.9, p50: 5.6, p85: 6.3, p97: 7 },
    { month: 3, p3: 5.1, p15: 5.6, p50: 6.4, p85: 7.2, p97: 7.9 },
    { month: 4, p3: 5.6, p15: 6.2, p50: 7, p85: 7.9, p97: 8.6 },
    { month: 5, p3: 6.1, p15: 6.7, p50: 7.5, p85: 8.4, p97: 9.2 },
    { month: 6, p3: 6.4, p15: 7.1, p50: 7.9, p85: 8.9, p97: 9.7 },
    { month: 8, p3: 7, p15: 7.7, p50: 8.6, p85: 9.6, p97: 10.5 },
    { month: 10, p3: 7.5, p15: 8.2, p50: 9.2, p85: 10.3, p97: 11.2 },
    { month: 12, p3: 7.8, p15: 8.6, p50: 9.6, p85: 10.8, p97: 11.8 },
    { month: 15, p3: 8.4, p15: 9.2, p50: 10.3, p85: 11.6, p97: 12.7 },
    { month: 18, p3: 8.9, p15: 9.7, p50: 10.9, p85: 12.3, p97: 13.5 },
    { month: 21, p3: 9.3, p15: 10.3, p50: 11.5, p85: 13, p97: 14.3 },
    { month: 24, p3: 9.8, p15: 10.8, p50: 12.2, p85: 13.7, p97: 15.1 },
  ],
  girls: [
    { month: 0, p3: 2.4, p15: 2.8, p50: 3.2, p85: 3.7, p97: 4.2 },
    { month: 1, p3: 3.2, p15: 3.6, p50: 4.2, p85: 4.8, p97: 5.4 },
    { month: 2, p3: 4, p15: 4.5, p50: 5.1, p85: 5.9, p97: 6.5 },
    { month: 3, p3: 4.6, p15: 5.1, p50: 5.8, p85: 6.7, p97: 7.4 },
    { month: 4, p3: 5.1, p15: 5.6, p50: 6.4, p85: 7.3, p97: 8.1 },
    { month: 5, p3: 5.5, p15: 6.1, p50: 6.9, p85: 7.8, p97: 8.7 },
    { month: 6, p3: 5.8, p15: 6.4, p50: 7.3, p85: 8.3, p97: 9.2 },
    { month: 8, p3: 6.3, p15: 7, p50: 7.9, p85: 9, p97: 10 },
    { month: 10, p3: 6.8, p15: 7.5, p50: 8.5, p85: 9.6, p97: 10.7 },
    { month: 12, p3: 7.1, p15: 7.9, p50: 8.9, p85: 10.2, p97: 11.3 },
    { month: 15, p3: 7.7, p15: 8.5, p50: 9.6, p85: 10.9, p97: 12.2 },
    { month: 18, p3: 8.2, p15: 9, p50: 10.2, p85: 11.6, p97: 13 },
    { month: 21, p3: 8.7, p15: 9.6, p50: 10.9, p85: 12.4, p97: 13.8 },
    { month: 24, p3: 9.2, p15: 10.1, p50: 11.5, p85: 13.1, p97: 14.6 },
  ],
};

export const MAX_REFERENCE_MONTHS = 24;

const PERCENTILE_KEYS = ["p3", "p15", "p50", "p85", "p97"] as const;

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

// Linear interpolation over one sex's table. Ages are clamped to the table's
// 0–24 month span; between listed rows each percentile interpolates linearly.
function interpolateRow(rows: readonly ReferenceRow[], ageMonths: number): WeightPercentiles {
  const age = Math.min(MAX_REFERENCE_MONTHS, Math.max(0, ageMonths));
  let lower = rows[0];
  let upper = rows[rows.length - 1];
  for (const row of rows) {
    if (row.month <= age) lower = row;
    if (row.month >= age) {
      upper = row;
      break;
    }
  }
  if (lower.month === upper.month) {
    const { p3, p15, p50, p85, p97 } = lower;
    return { p3, p15, p50, p85, p97 };
  }
  const t = (age - lower.month) / (upper.month - lower.month);
  const result = {} as Record<(typeof PERCENTILE_KEYS)[number], number>;
  for (const key of PERCENTILE_KEYS) {
    result[key] = round1(lower[key] + (upper[key] - lower[key]) * t);
  }
  return result;
}

// The reference band for one age. With a known sex this is that sex's WHO
// percentile row. Without one it is the COMBINED ENVELOPE — each lower
// percentile takes the lower of the two sexes and each upper percentile the
// higher (girls' p3 … boys' p97 in practice), with p50 the midpoint of the
// two medians. The envelope is deliberately wider than either single-sex
// band; callers must label it "girls and boys".
export function expectedWeightRange(ageMonths: number, sex: Sex | undefined): WeightPercentiles {
  if (sex === "boy") return interpolateRow(WHO_WEIGHT_FOR_AGE.boys, ageMonths);
  if (sex === "girl") return interpolateRow(WHO_WEIGHT_FOR_AGE.girls, ageMonths);
  const boys = interpolateRow(WHO_WEIGHT_FOR_AGE.boys, ageMonths);
  const girls = interpolateRow(WHO_WEIGHT_FOR_AGE.girls, ageMonths);
  return {
    p3: Math.min(girls.p3, boys.p3),
    p15: Math.min(girls.p15, boys.p15),
    p50: round1((girls.p50 + boys.p50) / 2),
    p85: Math.max(girls.p85, boys.p85),
    p97: Math.max(girls.p97, boys.p97),
  };
}

export type WeeklyGainBand = {
  fromMonth: number;
  // Exclusive upper edge of the band.
  toMonth: number;
  minGramsPerWeek: number;
  maxGramsPerWeek: number;
  // The authority the figure traces to, named so the UI can cite it.
  source: string;
};

// AAP per-age gain figures converted to grams per week. Beyond 8 months the
// AAP publishes no defensible per-week range (growth slows and the advice
// shifts to "follow the curve"), so the helper returns null there.
export const WEEKLY_GAIN_BANDS: readonly WeeklyGainBand[] = [
  { fromMonth: 0, toMonth: 1, minGramsPerWeek: 150, maxGramsPerWeek: 200, source: "AAP" },
  { fromMonth: 1, toMonth: 4, minGramsPerWeek: 160, maxGramsPerWeek: 210, source: "AAP" },
  { fromMonth: 4, toMonth: 8, minGramsPerWeek: 105, maxGramsPerWeek: 130, source: "AAP" },
];

export function typicalWeeklyGain(ageMonths: number): WeeklyGainBand | null {
  const age = Math.max(0, ageMonths);
  return WEEKLY_GAIN_BANDS.find((band) => age >= band.fromMonth && age < band.toMonth) ?? null;
}
