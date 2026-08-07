// The single source of truth for every numeric activity field. The UnitFields
// read their input props from here and the validators read the same bounds, so
// a limit can never drift between a form and the storage guard.

export type NumericFieldName = "amount" | "weightGrams" | "lengthCm" | "headCm" | "temperatureC";

type NumericFieldSpec = {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  // Bound applied to already-stored rows where it is looser than the form's:
  // old quick logs could persist a 0 ml bottle and must stay readable.
  storedMin?: number;
  // Noun and unit phrases for the "Enter … between …" validation copy.
  errorNoun: string;
  errorUnit: string;
};

export const NUMERIC_FIELDS: Record<NumericFieldName, NumericFieldSpec> = {
  amount: { label: "Amount", unit: "ml", min: 1, max: 1_000, step: 1, storedMin: 0, errorNoun: "a bottle amount", errorUnit: "ml" },
  weightGrams: { label: "Weight", unit: "g", min: 500, max: 30_000, step: 1, errorNoun: "a weight", errorUnit: "grams" },
  lengthCm: { label: "Length", unit: "cm", min: 20, max: 130, step: 0.1, errorNoun: "a length", errorUnit: "centimetres" },
  headCm: { label: "Head", unit: "cm", min: 20, max: 80, step: 0.1, errorNoun: "a head measurement", errorUnit: "centimetres" },
  temperatureC: { label: "Temperature", unit: "°C", min: 30, max: 45, step: 0.1, errorNoun: "a temperature", errorUnit: "°C" },
};

export const NOTE_MAX_LENGTH = 240;
export const DEFAULT_BOTTLE_ML = 90;

const boundFormat = new Intl.NumberFormat("en-US");

// Props for a numeric <UnitField>: the form input and the validator always
// describe the same range because both read it from NUMERIC_FIELDS.
export function numericFieldProps(name: NumericFieldName) {
  const { label, unit, min, max, step } = NUMERIC_FIELDS[name];
  return { label, unit, min, max, step };
}

export function numericFieldError(name: NumericFieldName) {
  const field = NUMERIC_FIELDS[name];
  return `Enter ${field.errorNoun} between ${boundFormat.format(field.min)} and ${boundFormat.format(field.max)} ${field.errorUnit}.`;
}

// Stored rows keep the historical comparison semantics (a NaN smuggled past
// JSON would compare false on both sides); drafts are checked separately with
// the stricter form bounds in validate.ts.
export function outsideStoredBounds(name: NumericFieldName, value: number) {
  const field = NUMERIC_FIELDS[name];
  return value < (field.storedMin ?? field.min) || value > field.max;
}

export function clampToBounds(name: NumericFieldName, value: number) {
  const field = NUMERIC_FIELDS[name];
  return Math.min(field.max, Math.max(field.min, value));
}

export function roundToStep(name: NumericFieldName, value: number) {
  const scale = Math.round(1 / NUMERIC_FIELDS[name].step);
  return Math.round(value * scale) / scale;
}
