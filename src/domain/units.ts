// Millilitres in, ounces out — when asked.
//
// "walang options to ounces, inches, kilos?" — the first substantive feature
// request under the post that brought most of this app's families here. The
// Philippines measures its babies the American way: bottles in ounces, birth
// weight announced in pounds. An app that only speaks millilitres is an app
// those parents translate in their heads at 3am.
//
// The rule that keeps this safe: STORAGE IS METRIC, FOREVER. Every entry is
// millilitres, grams and centimetres on disk and over sync, exactly as
// before — a family flipping the setting back and forth loses nothing and
// shifts nothing. The unit system converts at the very edge: what the screen
// shows, and what a field accepts. It is also a per-device preference, kept
// outside the synced blob on purpose: one parent thinking in ounces must not
// flip the other parent's phone.

import { useSyncExternalStore } from "react";

export type UnitSystem = "metric" | "us";

const KEY = "numalog-units-v1";
const OZ_IN_ML = 29.5735;
const LB_IN_G = 453.592;
const IN_IN_CM = 2.54;

let cached: UnitSystem | null = null;
const listeners = new Set<() => void>();

export function getUnits(): UnitSystem {
  if (cached === null) {
    try {
      cached = window.localStorage.getItem(KEY) === "us" ? "us" : "metric";
    } catch {
      cached = "metric";
    }
  }
  return cached;
}

export function setUnits(system: UnitSystem) {
  cached = system;
  try {
    window.localStorage.setItem(KEY, system);
  } catch {
    // The in-memory value still applies until the app closes.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** The current unit system, live: flipping the Settings toggle re-renders. */
export function useUnits(): UnitSystem {
  return useSyncExternalStore(subscribe, getUnits, () => "metric" as const);
}

// --- volume ---------------------------------------------------------------

export function mlToOz(ml: number): number {
  return ml / OZ_IN_ML;
}

export function ozToMl(oz: number): number {
  return Math.round(oz * OZ_IN_ML);
}

/** "120 ml" / "4 oz" — ounces to one decimal, whole numbers left whole. */
export function formatVolume(ml: number, units: UnitSystem): string {
  if (units === "metric") return `${ml} ml`;
  const oz = mlToOz(ml);
  return `${trimmed(oz)} oz`;
}

/** The number and its unit separately, for figure blocks. */
export function volumeParts(ml: number, units: UnitSystem): { value: string; unit: string } {
  if (units === "metric") return { value: String(ml), unit: "ml" };
  return { value: trimmed(mlToOz(ml)), unit: "oz" };
}

// --- weight ---------------------------------------------------------------

export function gramsToLb(grams: number): number {
  return grams / LB_IN_G;
}

export function lbToGrams(lb: number): number {
  return Math.round(lb * LB_IN_G);
}

/** "4.20 kg" / "9 lb 4 oz" — the way each audience actually says it. */
export function formatWeight(grams: number, units: UnitSystem): string {
  if (units === "metric") return `${(grams / 1_000).toFixed(2)} kg`;
  const totalOz = grams / (LB_IN_G / 16);
  const lb = Math.floor(totalOz / 16);
  const oz = Math.round(totalOz % 16);
  // 15.6 oz rounds to 16: carry it, or "7 lb 16 oz" walks out the door.
  if (oz === 16) return `${lb + 1} lb 0 oz`;
  return `${lb} lb ${oz} oz`;
}

/** Figure-block form: decimal, single unit. */
export function weightParts(grams: number, units: UnitSystem): { value: string; unit: string } {
  if (units === "metric") return { value: (grams / 1_000).toFixed(2), unit: "kg" };
  return { value: gramsToLb(grams).toFixed(2), unit: "lb" };
}

/** kg → display for reference tables that already hold kilograms. */
export function formatKg(kg: number, units: UnitSystem, decimals = 1): string {
  if (units === "metric") return `${kg.toFixed(decimals)} kg`;
  return `${gramsToLb(kg * 1_000).toFixed(decimals)} lb`;
}

// --- length ---------------------------------------------------------------

export function cmToIn(cm: number): number {
  return cm / IN_IN_CM;
}

export function inToCm(inches: number): number {
  return Math.round(inches * IN_IN_CM * 10) / 10;
}

export function formatLength(cm: number, units: UnitSystem): string {
  if (units === "metric") return `${cm} cm`;
  return `${cmToIn(cm).toFixed(1)} in`;
}

function trimmed(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

// --- the form boundary ----------------------------------------------------
//
// In US mode the DRAFT strings a sheet holds are in display units — what the
// person typed is what the field shows — and they cross to metric exactly
// once, on save, before validateDraft ever sees them. Storage stays metric.

export type MeasurementName = "weightGrams" | "lengthCm" | "headCm" | "temperatureC";

export function cToF(c: number): number {
  return c * 9 / 5 + 32;
}

export function fToC(f: number): number {
  return (f - 32) * 5 / 9;
}

/** A stored °C temperature, in the system's own degrees. */
export function formatTemperature(c: number, units: UnitSystem): string {
  if (units === "metric") return `${c.toFixed(1)} °C`;
  return `${cToF(c).toFixed(1)} °F`;
}

/** The bottle stepper's geometry per system: ±10 ml, or the half-ounce. */
export function bottleStepper(units: UnitSystem) {
  return units === "metric"
    ? { min: 10, max: 400, step: 10, unit: "ml" }
    : { min: 0.5, max: 13.5, step: 0.5, unit: "oz" };
}

export function bottlePresets(units: UnitSystem): number[] {
  return units === "metric" ? [60, 90, 120, 150] : [2, 3, 4, 5];
}

/** 90 ml or its 3 oz — the same default bottle either way. */
export function defaultBottleDraft(units: UnitSystem, defaultMl: number): string {
  return units === "metric" ? String(defaultMl) : trimmed(mlToOz(defaultMl));
}

export function bottleDraftToMl(value: string, units: UnitSystem): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return NaN;
  return units === "metric" ? parsed : ozToMl(parsed);
}

export function mlToBottleDraft(ml: number, units: UnitSystem): string {
  return units === "metric" ? String(ml) : trimmed(mlToOz(ml));
}

const US_MEASUREMENT = {
  // Bounds are the metric ones (activitySchema) through the same conversion
  // the values take, so nothing valid in one system is invalid in the other.
  weightGrams: { label: "Weight", unit: "lb", min: 1.11, max: 66.1, step: 0.01, noun: "a weight", errorUnit: "lb" },
  lengthCm: { label: "Length", unit: "in", min: 7.9, max: 51.2, step: 0.1, noun: "a length", errorUnit: "inches" },
  headCm: { label: "Head", unit: "in", min: 7.9, max: 31.5, step: 0.1, noun: "a head measurement", errorUnit: "inches" },
  // 30–45 °C through the same conversion the value takes. A parent with a
  // Fahrenheit thermometer typing 98.6 at 3am must not be told to enter
  // "between 30 and 45".
  temperatureC: { label: "Temperature", unit: "°F", min: 86, max: 113, step: 0.1, noun: "a temperature", errorUnit: "°F" },
} as const;

export function usMeasurementProps(name: MeasurementName) {
  const { label, unit, min, max, step } = US_MEASUREMENT[name];
  return { label, unit, min, max, step };
}

export function usMeasurementError(name: MeasurementName): string {
  const field = US_MEASUREMENT[name];
  return `Enter ${field.noun} between ${field.min} and ${field.max} ${field.errorUnit}.`;
}

export function measurementPlaceholder(name: MeasurementName, units: UnitSystem): string {
  if (units === "metric") return { weightGrams: "3500", lengthCm: "51.5", headCm: "35.1", temperatureC: "36.7" }[name];
  return { weightGrams: "7.7", lengthCm: "20.3", headCm: "13.8", temperatureC: "98.1" }[name];
}

/** A display-units draft string, converted to the metric string validate expects. */
export function measurementToMetric(name: MeasurementName, value: string, units: UnitSystem): string {
  if (units === "metric" || value.trim() === "") return value;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  if (name === "weightGrams") return String(lbToGrams(parsed));
  if (name === "temperatureC") return String(fToC(parsed));
  return String(inToCm(parsed));
}

/** A stored metric value, rendered as the draft string a US-mode field edits. */
export function metricToMeasurementDraft(name: MeasurementName, value: number, units: UnitSystem): string {
  if (units === "metric") return String(value);
  if (name === "weightGrams") return gramsToLb(value).toFixed(2);
  if (name === "temperatureC") return cToF(value).toFixed(1);
  return cmToIn(value).toFixed(1);
}
