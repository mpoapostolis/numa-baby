// Shared domain and UI-state types. Everything the storage blob or a save path
// touches is defined here so the validators, the fixtures and the app agree on
// one shape.

import type { Routine } from "./routines";

/** "pump" is a pumping session, and it is logged after it ends: this build
    always sets endedAt (a pump is never open — see timers.ts) and side, and
    amount is the total in ml, absent when it was not measured. A build from
    before pumping drops the end when it edits one, so nothing may rely on
    it being there. It is never a feed: nothing that counts or forecasts
    feeds lists it. */
export type ActivityType = "bottle" | "nursing" | "diaper" | "burp" | "sleep" | "growth" | "health" | "medicine" | "solid" | "routine" | "month" | "vaccine" | "tummy" | "pump";
export type DiaperKind = "wet" | "dirty" | "both";
export type FeedingMode = "mixed" | "breast" | "bottle";
export type Tab = "today" | "timeline" | "insights" | "guide" | "more";

export type Activity = {
  id: string;
  type: ActivityType;
  startedAt: string;
  endedAt?: string;
  amount?: number;
  /** "both" is one session that used both sides, which is how most feeds
      actually go — it is not two sessions and should not be logged as two. */
  side?: "left" | "right" | "both";
  diaperKind?: DiaperKind;
  milkType?: "formula" | "expressed";
  weightGrams?: number;
  lengthCm?: number;
  headCm?: number;
  temperatureC?: number;
  /** What was given. Free text on purpose: this app records what a parent says
      they gave and when. It does not know doses, must not check them, and must
      never imply it has. The value is entirely "has this already been given,
      and when" — the question two tired people in one house get wrong. */
  medicine?: string;
  /** How much, as the parent would say it: "2.5 ml", "one drop", "half a
      sachet". Deliberately not a number with units. */
  dose?: string;
  /** What was eaten, for a solid-food entry. Free text like medicine: "banana",
      "carrot purée, two spoons". The app records, it does not nutritionise. */
  food?: string;
  /** Which daily routine this ticks off (see domain/routines.ts). A tick is an
      ordinary activity so that it syncs, undoes and appears in the timeline
      like anything else — the point being that the OTHER parent can see the
      vitamin was already given. */
  routineId?: string;
  /** A photo on the entry (domain/photoRef.ts): the nappy worth showing the
      doctor, a month's picture. Only the id is in the log. */
  photo?: string;
  /** Which month-birthday a "month" entry is about, 1-24. Stored, not worked
      out from startedAt, so editing the birth date cannot move a note. */
  month?: number;
  /** A "vaccine" entry: what was (or will be) given. Free text, like a
      medicine — the app records, it does not check schedules. */
  vaccine?: string;
  /** Where: a public health centre or a private clinic. Kept open-ended in
      validation, so a later build's third place is not a dropped row. */
  place?: "public" | "private";
  /** A vaccine that is PLANNED rather than given, with its appointment as
      `due` (YYYY-MM-DD). The entry itself is stamped when it was planned:
      anything dated two days ahead is thrown away on load. Never inferred
      from the date — a missed appointment must not turn into a given dose. */
  planned?: true;
  due?: string;
  note?: string;
  // Sync-ready metadata. Absent on legacy rows: a missing updatedAt is treated
  // as equal to startedAt (activityUpdatedAt in validate.ts) and stored data is
  // never rewritten on load. `deleted: true` marks a tombstone — kept in
  // storage so a future sync can merge the deletion, hidden from the UI.
  updatedAt?: string;
  deleted?: true;
};

export type Profile = {
  name: string;
  birthDate: string;
  feedingMode: FeedingMode;
  // Optional, only read by the growth guide's reference ranges. Absent means
  // "not set" and the guide shows the combined girls-and-boys envelope.
  sex?: "girl" | "boy";
  /** The things that have to happen every day — vitamin drops, a medicine.
      On the PROFILE rather than in device settings because it describes how
      this family's day is run, not how one phone is configured, and so it
      reaches the other parent by the path the baby's name already travels. */
  routines?: Routine[];
  /** The baby's profile picture: a photo id (domain/photoRef.ts), "" once
      removed. Only the id rides the profile — the profile goes out with
      every pull and is capped at 8 KB; the picture itself does not. */
  photo?: string;
};

export type BootState = "loading" | "onboarding" | "ready" | "recovery";

export type ReminderSettings = {
  feedEnabled: boolean;
  feedIntervalMinutes: number;
  // Added later, so both are optional in storage and default to off — a blob
  // written before nappy reminders existed must not start firing them.
  diaperEnabled?: boolean;
  diaperIntervalMinutes?: number;
};

export type Sheet =
  | null
  | "bottle"
  | "nursing"
  | "pump"
  | "diaper"
  | "sleep"
  | "medicine"
  | "solid"
  | "growth"
  | "health"
  | "profile"
  | "months"
  | "vaccines"
  | "edit";

export type StoredData = {
  activities: Activity[];
  profile: Profile;
  // When the profile was last saved on a device. Optional and backward
  // compatible — the sync engine uses it to decide whose profile is fresher.
  profileUpdatedAt?: string;
  nightMode?: boolean;
  reminders?: ReminderSettings;
  legacyDemo?: boolean;
  onboardingComplete: boolean;
  droppedActivities: number;
};
