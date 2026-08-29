// Shared domain and UI-state types. Everything the storage blob or a save path
// touches is defined here so the validators, the fixtures and the app agree on
// one shape.

export type ActivityType = "bottle" | "nursing" | "diaper" | "burp" | "sleep" | "growth" | "health";
export type DiaperKind = "wet" | "dirty" | "both";
export type FeedingMode = "mixed" | "breast" | "bottle";
export type Tab = "today" | "timeline" | "insights" | "guide" | "more";

export type Activity = {
  id: string;
  type: ActivityType;
  startedAt: string;
  endedAt?: string;
  amount?: number;
  side?: "left" | "right";
  diaperKind?: DiaperKind;
  milkType?: "formula" | "expressed";
  weightGrams?: number;
  lengthCm?: number;
  headCm?: number;
  temperatureC?: number;
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
