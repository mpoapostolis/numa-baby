// Shared domain and UI-state types. Everything the storage blob or a save path
// touches is defined here so the validators, the fixtures and the app agree on
// one shape.

export type ActivityType = "bottle" | "nursing" | "diaper" | "burp" | "sleep" | "growth" | "health" | "medicine";
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
  | "diaper"
  | "sleep"
  | "medicine"
  | "growth"
  | "health"
  | "profile"
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
