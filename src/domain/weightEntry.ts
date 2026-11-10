// Weighing in kilograms or in grams, in the metric system.
//
// "Switching between kg/g — I prefer using kg." Weights were always SHOWN in
// kilograms (3.52 kg), but the growth field took grams: 3520. Some parents
// read the scale in kilos and want to type 3.52. This is only how the field
// takes the number. Like the unit system (units.ts), storage stays grams,
// forever, and the choice is this phone's own, kept outside the synced blob:
// one parent typing kilos must not change the other parent's field.
//
// Its own module because only the log sheets, a lazy chunk, read it.

import { useSyncExternalStore } from "react";

export type WeightEntry = "g" | "kg";

const KEY = "numalog-weight-entry-v1";

let cached: WeightEntry | null = null;
const listeners = new Set<() => void>();

/** Grams unless this phone chose kilograms: the field as it always was. */
export function getWeightEntry(): WeightEntry {
  if (cached === null) {
    try {
      cached = window.localStorage.getItem(KEY) === "kg" ? "kg" : "g";
    } catch {
      cached = "g";
    }
  }
  return cached;
}

export function setWeightEntry(unit: WeightEntry) {
  cached = unit;
  try {
    window.localStorage.setItem(KEY, unit);
  } catch {
    // The in-memory choice still applies until the app closes.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useWeightEntry(): WeightEntry {
  return useSyncExternalStore(subscribe, getWeightEntry, () => "g" as const);
}

/** Kilograms as the field shows them: 3520 g is "3.52", 3500 g is "3.5". */
export function gramsToKgDraft(grams: number): string {
  return String(Math.round(grams) / 1_000);
}

/** What was typed in kilograms, as the grams string the validator checks.
    Empty stays empty, and anything not a number goes through untouched, so
    the validator's own refusal is the one shown. */
export function kgDraftToGrams(value: string): string {
  if (value.trim() === "") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(Math.round(parsed * 1_000)) : value;
}

/** A draft typed in one and shown in the other, when the toggle flips with a
    number already in the field: 3520 becomes 3.52, and back. */
export function convertWeightDraft(value: string, to: WeightEntry): string {
  if (value.trim() === "") return value;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  return to === "kg" ? gramsToKgDraft(parsed) : String(Math.round(parsed * 1_000));
}

/** The field's bounds in kilograms: the schema's 500–30,000 g. */
export const KG_FIELD = { label: "Weight", unit: "kg", min: 0.5, max: 30, step: 0.01 } as const;
