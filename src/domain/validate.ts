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
import { sanitizeRoutines } from "./routines";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

/* Two days, not zero. Every entry arriving over sync or in a backup comes
   from somebody's phone clock, and phone clocks drift — a partner's device a
   few minutes fast must never have its feeds silently discarded, because
   rejection here IS data loss. What this fences out is the other thing
   entirely: a corrupt or fabricated stamp years in the future, which would
   sit at the top of the timeline forever and poison every forecast median.
   The local quick-log path stays stricter (safeStartedAt clamps to now). */
const FUTURE_TOLERANCE_MS = 48 * 60 * 60 * 1000;

function tooFarInFuture(value: string, now = Date.now()) {
  return new Date(value).getTime() > now + FUTURE_TOLERANCE_MS;
}

/* The write stamp gets the same fence, but CLAMPED rather than rejected.
   updatedAt decides every last-write-wins conflict, on the server and on
   every phone. A partner's phone a day ahead (a battery reset, a clock set by
   hand) stamps rows nobody else can ever delete or correct: the tombstone or
   edit is written, the next poll pulls the future-stamped live copy back, and
   the deletion quietly undoes itself. Rejecting such a row would throw away a
   real feed for a bad clock; taking it as "written just now" keeps the entry
   and takes away its immortality. */
export function clampFutureUpdatedAt(activity: Activity, now = Date.now()): Activity {
  if (activity.updatedAt === undefined || !tooFarInFuture(activity.updatedAt, now)) return activity;
  return { ...activity, updatedAt: new Date(now).toISOString() };
}

function invalidStoredNumber(name: NumericFieldName, value: unknown) {
  return value !== undefined && (typeof value !== "number" || outsideStoredBounds(name, value));
}

export function isValidActivity(value: unknown): value is Activity {
  if (!isRecord(value)) return false;
  // The type check is deliberately tolerant of UNKNOWN type strings. When a
  // new activity type ships (solids did tonight), a partner phone still on
  // the previous build pulls those rows over sync — and a strict membership
  // test made it drop them silently while its cursor advanced past them, a
  // hole in the family's shared history with no error anywhere. An unknown
  // but bounded type string is far more likely to be the future than an
  // attack; every field this build DOES know stays strictly checked, and the
  // UI renders unknown types as a plain note-bearing entry.
  if (typeof value.id !== "string" || !value.id) return false;
  if (typeof value.type !== "string" || value.type.length === 0 || value.type.length > 32) {
    return false;
  }
  if (!isValidDate(value.startedAt) || (value.endedAt !== undefined && !isValidDate(value.endedAt))) {
    return false;
  }
  if (tooFarInFuture(value.startedAt) || (value.endedAt !== undefined && tooFarInFuture(value.endedAt))) {
    return false;
  }
  if (value.note !== undefined && (typeof value.note !== "string" || value.note.length > NOTE_MAX_LENGTH)) return false;
  // Bounded like the note: a medicine name and a dose are things a person
  // types, and a stored blob is something a sync could hand us.
  if (value.medicine !== undefined && (typeof value.medicine !== "string" || value.medicine.length > NOTE_MAX_LENGTH)) return false;
  if (value.dose !== undefined && (typeof value.dose !== "string" || value.dose.length > NOTE_MAX_LENGTH)) return false;
  if (value.food !== undefined && (typeof value.food !== "string" || value.food.length > NOTE_MAX_LENGTH)) return false;
  // Which daily routine a tick belongs to. Bounded like every other string
  // that arrives from storage or from another phone.
  if (value.routineId !== undefined && (typeof value.routineId !== "string" || value.routineId.length > 64)) return false;
  if (invalidStoredNumber("amount", value.amount)) return false;
  if (invalidStoredNumber("weightGrams", value.weightGrams)) return false;
  if (invalidStoredNumber("lengthCm", value.lengthCm)) return false;
  if (invalidStoredNumber("headCm", value.headCm)) return false;
  if (invalidStoredNumber("temperatureC", value.temperatureC)) return false;
  if (value.side !== undefined && value.side !== "left" && value.side !== "right" && value.side !== "both") return false;
  if (value.diaperKind !== undefined && !["wet", "dirty", "both"].includes(String(value.diaperKind))) return false;
  if (value.milkType !== undefined && value.milkType !== "formula" && value.milkType !== "expressed") return false;
  if (value.updatedAt !== undefined && !isValidDate(value.updatedAt)) return false;
  if (value.deleted !== undefined && value.deleted !== true) return false;
  return true;
}

// The live (non-tombstoned) view of a stored activity list. Tombstones stay in
// storage so a future sync can merge deletions, but no UI surface reads them.
export function liveActivities(list: Activity[]): Activity[] {
  return list.filter((activity) => !activity.deleted);
}

// Migration rule for legacy rows: a missing updatedAt counts as "last written
// at startedAt". Stored data is never rewritten on load — the rule is applied
// wherever a comparison needs it.
export function activityUpdatedAt(activity: Activity): string {
  return activity.updatedAt ?? activity.startedAt;
}

function isValidProfile(value: unknown): value is Profile & { isDemo?: boolean; routines?: unknown } {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    value.name.length <= 80 &&
    typeof value.birthDate === "string" &&
    ["mixed", "breast", "bottle"].includes(String(value.feedingMode)) &&
    (value.isDemo === undefined || typeof value.isDemo === "boolean")
  );
}

// A profile arriving over sync is unauthenticated JSON from another device:
// same tolerance as parseStoredData — reject the wrong shape outright, quietly
// drop an unrecognised sex, never adopt extra keys.
export function sanitizeProfile(value: unknown): Profile | null {
  if (!isValidProfile(value)) return null;
  return {
    name: value.name,
    birthDate: value.birthDate,
    feedingMode: value.feedingMode,
    sex: value.sex === "girl" || value.sex === "boy" ? value.sex : undefined,
    // A partner's phone can send anything; sanitizeRoutines drops whatever
    // is not a list of short labelled ids, and never throws the profile away
    // over it — a bad routine list must not cost a family their baby's name.
    routines: sanitizeRoutines(value.routines),
  };
}

function isValidReminderSettings(value: unknown): value is ReminderSettings {
  if (!isRecord(value)) return false;
  if (typeof value.feedEnabled !== "boolean") return false;
  if (![120, 180, 240].includes(Number(value.feedIntervalMinutes))) return false;
  // Nappy reminders arrived later: absent is valid and means off. A present
  // but wrong value is rejected rather than coerced, same as everything else.
  if (value.diaperEnabled !== undefined && typeof value.diaperEnabled !== "boolean") return false;
  if (
    value.diaperIntervalMinutes !== undefined &&
    ![90, 120, 180].includes(Number(value.diaperIntervalMinutes))
  ) return false;
  return true;
}

export function parseStoredData(value: string): StoredData {
  const parsed: unknown = JSON.parse(value);
  // Only a wrong SHAPE is unrecoverable. A single corrupt row is filtered out and
  // reported — it must never cost a parent their entire history.
  if (!isRecord(parsed) || !isValidProfile(parsed.profile) || !Array.isArray(parsed.activities)) {
    throw new Error("Invalid Numalog backup");
  }
  // No row-count ceiling here any more. One used to throw at 25,000 rows,
  // which sent a perfectly healthy log — reachable by an ordinary family in
  // a couple of years, sooner with twins or a partner's phone feeding the
  // same list — to the recovery screen one morning with "could not be read".
  // The byte caps on the import and handoff paths bound the work; the blob
  // in storage is bounded by the browser's quota, which persistSnapshot
  // watches and warns about long before it is reached.
  const now = Date.now();
  const activities = parsed.activities
    .filter(isValidActivity)
    .map((activity) => clampFutureUpdatedAt(activity, now));
  const storedProfile = parsed.profile;
  const onboardingComplete = typeof parsed.onboardingComplete === "boolean" ? parsed.onboardingComplete : undefined;
  return {
    // Optional and backward compatible: blobs written before profile stamping
    // simply have no stamp, and the sync profile rule treats that as "older".
    profileUpdatedAt: isValidDate(parsed.profileUpdatedAt) ? parsed.profileUpdatedAt : undefined,
    profile: {
      name: storedProfile.name,
      birthDate: storedProfile.birthDate,
      feedingMode: storedProfile.feedingMode,
      // Tolerant on purpose: an absent or unrecognised value simply means the
      // growth guide falls back to its combined girls-and-boys envelope.
      sex: storedProfile.sex === "girl" || storedProfile.sex === "boy" ? storedProfile.sex : undefined,
      routines: sanitizeRoutines(storedProfile.routines),
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
