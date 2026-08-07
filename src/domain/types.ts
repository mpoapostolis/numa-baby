// Shared domain and UI-state types. Everything the storage blob or a save path
// touches is defined here so the validators, the fixtures and the app agree on
// one shape.

export type ActivityType = "bottle" | "nursing" | "diaper" | "sleep" | "growth" | "health";
export type DiaperKind = "wet" | "dirty" | "both";
export type FeedingMode = "mixed" | "breast" | "bottle";
export type Tab = "today" | "timeline" | "insights" | "more";

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
};

export type Sheet = null | "bottle" | "nursing" | "diaper" | "growth" | "health" | "profile" | "edit";

export type StoredData = {
  activities: Activity[];
  profile: Profile;
  nightMode?: boolean;
  reminders?: ReminderSettings;
  legacyDemo?: boolean;
  onboardingComplete: boolean;
  droppedActivities: number;
};
