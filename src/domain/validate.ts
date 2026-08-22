import {
  DEFAULT_BOTTLE_ML,
  NOTE_MAX_LENGTH,
  NUMERIC_FIELDS,
  NumericFieldName,
  clampToBounds,
  numericFieldError,
  outsideStoredBounds,
  roundToStep,
} from "./activitySchema";
import { Activity, ActivityType, Profile, ReminderSettings, StoredData } from "./types";

const activityTypes = new Set<ActivityType>([
  "bottle",
  "nursing",
  "diaper",
  "burp",
  "sleep",
  "growth",
  "health",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

function invalidStoredNumber(name: NumericFieldName, value: unknown) {
  return value !== undefined && (typeof value !== "number" || outsideStoredBounds(name, value));
}

export function isValidActivity(value: unknown): value is Activity {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || !value.id || !activityTypes.has(value.type as ActivityType)) {
    return false;
  }
  if (!isValidDate(value.startedAt) || (value.endedAt !== undefined && !isValidDate(value.endedAt))) {
    return false;
  }
  if (value.note !== undefined && (typeof value.note !== "string" || value.note.length > NOTE_MAX_LENGTH)) return false;
  if (invalidStoredNumber("amount", value.amount)) return false;
  if (invalidStoredNumber("weightGrams", value.weightGrams)) return false;
  if (invalidStoredNumber("lengthCm", value.lengthCm)) return false;
  if (invalidStoredNumber("headCm", value.headCm)) return false;
  if (invalidStoredNumber("temperatureC", value.temperatureC)) return false;
  if (value.side !== undefined && value.side !== "left" && value.side !== "right") return false;
  if (value.diaperKind !== undefined && !["wet", "dirty", "both"].includes(String(value.diaperKind))) return false;
  if (value.milkType !== undefined && value.milkType !== "formula" && value.milkType !== "expressed") return false;
  return true;
}

function isValidProfile(value: unknown): value is Profile & { isDemo?: boolean } {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    value.name.length <= 80 &&
    typeof value.birthDate === "string" &&
    ["mixed", "breast", "bottle"].includes(String(value.feedingMode)) &&
    (value.isDemo === undefined || typeof value.isDemo === "boolean")
  );
}

function isValidReminderSettings(value: unknown): value is ReminderSettings {
  return (
    isRecord(value) &&
    typeof value.feedEnabled === "boolean" &&
    [120, 180, 240].includes(Number(value.feedIntervalMinutes))
  );
}

export function parseStoredData(value: string): StoredData {
  const parsed: unknown = JSON.parse(value);
  // Only a wrong SHAPE is unrecoverable. A single corrupt row is filtered out and
  // reported — it must never cost a parent their entire history.
  if (!isRecord(parsed) || !isValidProfile(parsed.profile) || !Array.isArray(parsed.activities)) {
    throw new Error("Invalid Baby Tracker backup");
  }
  if (parsed.activities.length > 25_000) {
    throw new Error("Invalid Baby Tracker activities");
  }
  const activities = parsed.activities.filter(isValidActivity);
  const storedProfile = parsed.profile;
  const onboardingComplete = typeof parsed.onboardingComplete === "boolean" ? parsed.onboardingComplete : undefined;
  return {
    profile: {
      name: storedProfile.name,
      birthDate: storedProfile.birthDate,
      feedingMode: storedProfile.feedingMode,
      // Tolerant on purpose: an absent or unrecognised value simply means the
      // growth guide falls back to its combined girls-and-boys envelope.
      sex: storedProfile.sex === "girl" || storedProfile.sex === "boy" ? storedProfile.sex : undefined,
    },
    activities,
    nightMode: typeof parsed.nightMode === "boolean" ? parsed.nightMode : undefined,
    reminders: isValidReminderSettings(parsed.reminders) ? parsed.reminders : undefined,
    legacyDemo: storedProfile.isDemo === true,
    onboardingComplete: onboardingComplete ?? storedProfile.isDemo === false,
    droppedActivities: parsed.activities.length - activities.length,
  };
}

// Quick-log sheets have no error UI for their time field; an invalid or
// future-dated value silently falls back to "now" instead of poisoning the
// forecast maths with entries from the future.
function safeStartedAt(value: string) {
  const parsed = new Date(value || Date.now());
  const time = parsed.getTime();
  if (!Number.isFinite(time) || time > Date.now()) return new Date().toISOString();
  return parsed.toISOString();
}

function invalidStartMessage(start: Date) {
  return !Number.isFinite(start.getTime()) || start.getTime() > Date.now()
    ? "Choose a valid start time that is not in the future."
    : null;
}

function invalidEndMessage(start: Date, end: Date, { allowEqual = false } = {}) {
  const tooEarly = allowEqual ? end.getTime() < start.getTime() : end.getTime() <= start.getTime();
  return !Number.isFinite(end.getTime()) || tooEarly || end.getTime() > Date.now()
    ? "The end time must be after the start and not in the future."
    : null;
}

// One draft, straight from the form fields: times as raw datetime-local
// strings, measurements as the input's text, the bottle stepper as a number.
export type ActivityDraft = {
  type: ActivityType;
  start: string;
  end?: string;
  amount?: number;
  weightGrams?: string;
  lengthCm?: string;
  headCm?: string;
  temperatureC?: string;
  note: string;
};

export type ValidatedDraft = {
  startedAt: string;
  endedAt?: string;
  amount?: number;
  weightGrams?: number;
  lengthCm?: number;
  headCm?: number;
  temperatureC?: number;
  note?: string;
};

// Which form field a failed draft belongs to, so the sheet can paint and
// focus only the input that actually failed.
export type DraftErrorField = "start" | "end" | NumericFieldName;

export type DraftOutcome =
  | { ok: true; value: ValidatedDraft }
  | { ok: false; message: string; field: DraftErrorField };

type DraftOptions = {
  // Quick-log sheets bind no error UI to their time field: the start silently
  // falls back to "now" (safeStartedAt) instead of blocking the save.
  clampTime?: boolean;
  // The bottle create sheet edits its amount through a stepper with no error
  // UI: out-of-range values are clamped into bounds instead of rejected.
  clampAmount?: boolean;
  allowEqualEnd?: boolean;
  requireEnd?: boolean;
};

function fail(message: string, field: DraftErrorField): DraftOutcome {
  return { ok: false, message, field };
}

function draftNumberError(name: NumericFieldName, value: number) {
  const field = NUMERIC_FIELDS[name];
  return !Number.isFinite(value) || value < field.min || value > field.max
    ? numericFieldError(name)
    : null;
}

// Every save path funnels through here — create, quick-log detail and edit —
// so no path can persist a value that parseStoredData would later reject.
export function validateDraft(draft: ActivityDraft, options: DraftOptions = {}): DraftOutcome {
  const value: ValidatedDraft = { startedAt: "", note: draft.note.trim() || undefined };

  if (options.clampTime) {
    value.startedAt = safeStartedAt(draft.start);
  } else {
    const start = new Date(draft.start);
    const startError = invalidStartMessage(start);
    if (startError) return fail(startError, "start");
    value.startedAt = start.toISOString();
    if (options.requireEnd && !draft.end) {
      return fail("The end time must be after the start and not in the future.", "end");
    }
    if (draft.end) {
      const end = new Date(draft.end);
      const endError = invalidEndMessage(start, end, { allowEqual: options.allowEqualEnd });
      if (endError) return fail(endError, "end");
      value.endedAt = end.toISOString();
    }
  }

  if (draft.type === "bottle") {
    const amount = draft.amount;
    if (options.clampAmount) {
      value.amount = roundToStep(
        "amount",
        clampToBounds("amount", typeof amount === "number" && Number.isFinite(amount) ? amount : DEFAULT_BOTTLE_ML),
      );
    } else {
      if (typeof amount !== "number") return fail(numericFieldError("amount"), "amount");
      const amountError = draftNumberError("amount", amount);
      if (amountError) return fail(amountError, "amount");
      value.amount = roundToStep("amount", amount);
    }
  }

  if (draft.type === "growth") {
    const weight = Number(draft.weightGrams);
    const length = draft.lengthCm ? Number(draft.lengthCm) : undefined;
    const head = draft.headCm ? Number(draft.headCm) : undefined;
    const weightError = draftNumberError("weightGrams", weight);
    if (weightError) return fail(weightError, "weightGrams");
    if (length !== undefined) {
      const lengthError = draftNumberError("lengthCm", length);
      if (lengthError) return fail(lengthError, "lengthCm");
    }
    if (head !== undefined) {
      const headError = draftNumberError("headCm", head);
      if (headError) return fail(headError, "headCm");
    }
    value.weightGrams = roundToStep("weightGrams", weight);
    value.lengthCm = length === undefined ? undefined : roundToStep("lengthCm", length);
    value.headCm = head === undefined ? undefined : roundToStep("headCm", head);
  }

  if (draft.type === "health") {
    const temperature = draft.temperatureC ? Number(draft.temperatureC) : undefined;
    if (temperature === undefined && !value.note) {
      return fail("Add a temperature or a note.", "temperatureC");
    }
    if (temperature !== undefined) {
      const temperatureError = draftNumberError("temperatureC", temperature);
      if (temperatureError) return fail(temperatureError, "temperatureC");
      value.temperatureC = roundToStep("temperatureC", temperature);
    }
  }

  return { ok: true, value };
}
