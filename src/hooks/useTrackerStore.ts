import { ChangeEvent, useEffect, useRef, useState } from "react";
import { parseStoredData } from "../domain/validate";
import { Activity, BootState, Profile, ReminderSettings } from "../domain/types";

// The entire persistence core in one hook: the five persisted state slices,
// the persist-first write path (nothing reaches React state unless the write
// succeeded), inverse-operation undo, boot, cross-tab sync and backup flows.
// The UI layer only ever sees state plus actions.

export const STORAGE_KEY = "numa-baby-v1";
export const RECOVERY_KEY = "numa-baby-v1-recovery";
const EMPTY_PROFILE: Profile = { name: "", birthDate: "", feedingMode: "mixed" };
const DEFAULT_REMINDERS: ReminderSettings = { feedEnabled: false, feedIntervalMinutes: 180 };

type TrackerStoreOptions = {
  debugMode: boolean;
  showToast: (message: string, undo?: () => void) => void;
  onNotificationPermission: (permission: NotificationPermission | "unsupported") => void;
};

export function useTrackerStore({ debugMode, showToast, onNotificationPermission }: TrackerStoreOptions) {
  const [bootState, setBootState] = useState<BootState>("loading");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  // Adopt whatever theme-init.js (a blocking script in <head>) already applied,
  // so the first React render never strips the .dark class and flashes white.
  const [nightMode, setNightMode] = useState(() => document.documentElement.classList.contains("dark"));
  const [reminders, setReminders] = useState<ReminderSettings>(DEFAULT_REMINDERS);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [recoveredNotice, setRecoveredNotice] = useState<string | null>(null);
  // Always-current mirror of every persisted slice. Undo callbacks and post-await
  // code read from here so they never write a stale render's snapshot to storage.
  // Synced inside persistSnapshot and the load paths — never from render.
  const persistedStateRef = useRef({ activities, profile, nightMode, reminders, bootState });

  // Single entry point for loading state from storage (boot, cross-tab, reset):
  // keeps the persisted-state ref and React state in lockstep.
  function applyLoadedState(next: {
    activities: Activity[];
    profile: Profile;
    nightMode?: boolean;
    reminders?: ReminderSettings;
    bootState: BootState;
  }) {
    const merged = {
      activities: next.activities,
      profile: next.profile,
      nightMode: next.nightMode ?? persistedStateRef.current.nightMode,
      reminders: next.reminders ?? persistedStateRef.current.reminders,
      bootState: next.bootState,
    };
    persistedStateRef.current = merged;
    setActivities(merged.activities);
    setProfile(merged.profile);
    setNightMode(merged.nightMode);
    setReminders(merged.reminders);
    setBootState(merged.bootState);
  }

  useEffect(() => {
    // Boot must not depend on the tab being visible: requestAnimationFrame
    // never fires in an occluded tab (background PWA launch, hidden preview),
    // which would pin the app on the splash screen. A timeout fallback races
    // it; whichever runs first wins.
    let booted = false;
    const boot = () => {
      if (booted) return;
      booted = true;
      if (debugMode) {
        // The fixture lives in its own lazy chunk: a preview session downloads
        // it on demand, a real session never ships it at all.
        void import("../domain/debugPreview").then(({ debugPreviewData }) => {
          const preview = debugPreviewData();
          applyLoadedState({
            activities: preview.activities,
            profile: preview.profile,
            reminders: DEFAULT_REMINDERS,
            bootState: "ready",
          });
          setStorageWarning(null);
        });
        return;
      }
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          try {
            const parsed = parseStoredData(saved);
            if (parsed.legacyDemo || !parsed.onboardingComplete) {
              applyLoadedState({
                activities: [],
                profile: EMPTY_PROFILE,
                nightMode: Boolean(parsed.nightMode),
                reminders: parsed.reminders ?? DEFAULT_REMINDERS,
                bootState: "onboarding",
              });
            } else {
              applyLoadedState({
                activities: parsed.activities,
                profile: parsed.profile,
                nightMode: Boolean(parsed.nightMode),
                reminders: parsed.reminders ?? DEFAULT_REMINDERS,
                bootState: "ready",
              });
              if (parsed.droppedActivities > 0) {
                try {
                  window.localStorage.setItem(RECOVERY_KEY, saved);
                } catch {
                  // The filtered rows survive only in memory; the notice still reports them.
                }
                setRecoveredNotice(
                  `${parsed.droppedActivities} saved ${parsed.droppedActivities === 1 ? "entry" : "entries"} could not be read and ${parsed.droppedActivities === 1 ? "was" : "were"} skipped. Everything else loaded normally.`,
                );
              }
            }
          } catch {
            try {
              window.localStorage.setItem(RECOVERY_KEY, saved);
            } catch {
              // The original value remains untouched when recovery storage is unavailable.
            }
            setStorageWarning("Your saved data could not be read. It was not overwritten.");
            applyLoadedState({ activities: [], profile: EMPTY_PROFILE, bootState: "recovery" });
          }
        } else {
          applyLoadedState({ activities: [], profile: EMPTY_PROFILE, bootState: "onboarding" });
        }
      } catch {
        setStorageWarning("This browser is blocking local storage. New entries may not persist.");
        applyLoadedState({ activities: [], profile: EMPTY_PROFILE, bootState: "onboarding" });
      }
      navigator.storage?.persist?.().catch(() => undefined);
    };
    const frame = window.requestAnimationFrame(boot);
    const fallback = window.setTimeout(boot, 120);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(fallback);
    };
  }, [debugMode]);

  useEffect(() => {
    if (debugMode) return;
    const syncFromAnotherTab = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      if (!event.newValue) {
        applyLoadedState({ activities: [], profile: EMPTY_PROFILE, bootState: "onboarding" });
        return;
      }
      try {
        const parsed = parseStoredData(event.newValue);
        if (parsed.legacyDemo || !parsed.onboardingComplete) {
          applyLoadedState({
            activities: [],
            profile: EMPTY_PROFILE,
            nightMode: Boolean(parsed.nightMode),
            reminders: parsed.reminders ?? DEFAULT_REMINDERS,
            bootState: "onboarding",
          });
        } else {
          applyLoadedState({
            activities: parsed.activities,
            profile: parsed.profile,
            nightMode: Boolean(parsed.nightMode),
            reminders: parsed.reminders ?? DEFAULT_REMINDERS,
            bootState: "ready",
          });
        }
      } catch {
        setStorageWarning("A change from another tab could not be read. This tab kept its current data.");
      }
    };
    window.addEventListener("storage", syncFromAnotherTab);
    return () => window.removeEventListener("storage", syncFromAnotherTab);
  }, [debugMode]);

  function persistSnapshot(
    nextActivities: Activity[],
    nextProfile: Profile = persistedStateRef.current.profile,
    nextNightMode: boolean = persistedStateRef.current.nightMode,
    nextReminders: ReminderSettings = persistedStateRef.current.reminders,
    nextOnboardingComplete: boolean = persistedStateRef.current.bootState === "ready",
  ) {
    const nextPersisted = {
      activities: nextActivities,
      profile: nextProfile,
      nightMode: nextNightMode,
      reminders: nextReminders,
      bootState: nextOnboardingComplete ? ("ready" as const) : persistedStateRef.current.bootState,
    };
    if (debugMode) {
      persistedStateRef.current = nextPersisted;
      setStorageWarning(null);
      return true;
    }
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ activities: nextActivities, profile: nextProfile, nightMode: nextNightMode, reminders: nextReminders, onboardingComplete: nextOnboardingComplete }),
      );
      persistedStateRef.current = nextPersisted;
      setStorageWarning(null);
      return true;
    } catch {
      setStorageWarning("This browser could not save the latest change. Your previous data is still intact.");
      showToast("Could not save on this device. Nothing was changed.");
      return false;
    }
  }

  function addActivity(activity: Activity, message: string) {
    const next = [activity, ...persistedStateRef.current.activities];
    if (!persistSnapshot(next)) return false;
    setActivities(next);
    showToast(message, () => {
      // Remove exactly this entry — never restore a whole stale array, which
      // would silently delete anything logged after it.
      const undone = persistedStateRef.current.activities.filter((item) => item.id !== activity.id);
      if (!persistSnapshot(undone)) return;
      setActivities(undone);
      showToast("Last change undone");
    });
    return true;
  }

  function updateActivity(next: Activity) {
    const nextActivities = persistedStateRef.current.activities.map((activity) => activity.id === next.id ? next : activity);
    if (!persistSnapshot(nextActivities)) return false;
    setActivities(nextActivities);
    return true;
  }

  function removeActivity(activity: Activity) {
    const next = persistedStateRef.current.activities.filter((item) => item.id !== activity.id);
    if (!persistSnapshot(next)) return false;
    setActivities(next);
    showToast("Entry removed", () => {
      // Re-insert exactly this entry; sortedActivities re-orders on render.
      const restored = [activity, ...persistedStateRef.current.activities];
      if (!persistSnapshot(restored)) return;
      setActivities(restored);
      showToast("Entry restored");
    });
    return true;
  }

  function stopTimer(id: string) {
    const current = persistedStateRef.current.activities;
    const target = current.find((activity) => activity.id === id);
    if (!target || target.endedAt) return;
    const nextActivities = current.map((activity) =>
        activity.id === id
          ? { ...activity, endedAt: new Date().toISOString() }
          : activity,
    );
    if (!persistSnapshot(nextActivities)) return;
    setActivities(nextActivities);
    showToast(target.type === "sleep" ? "Sleep session saved" : "Nursing session saved");
  }

  function changeNightMode(enabled: boolean) {
    if (bootState === "recovery") {
      // Never persist from the recovery screen — it would overwrite the unreadable
      // original that the recovery card promises to leave untouched.
      setNightMode(enabled);
      return;
    }
    if (!persistSnapshot(activities, profile, enabled)) return;
    setNightMode(enabled);
  }

  function saveProfile(nextProfile: Profile) {
    if (!persistSnapshot(activities, nextProfile)) return false;
    setProfile(nextProfile);
    return true;
  }

  function completeOnboarding(nextProfile: Profile) {
    if (!persistSnapshot([], nextProfile, nightMode, reminders, true)) return false;
    setActivities([]);
    setProfile(nextProfile);
    setStorageWarning(null);
    setBootState("ready");
    return true;
  }

  async function changeFeedReminders(enabled: boolean) {
    if (!enabled) {
      const next = { ...reminders, feedEnabled: false };
      if (!persistSnapshot(activities, profile, nightMode, next)) return;
      setReminders(next);
      showToast("Feed reminders off");
      return;
    }

    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      onNotificationPermission("unsupported");
      showToast("Notifications are not supported in this browser");
      return;
    }

    const permission = Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
    onNotificationPermission(permission);
    if (permission !== "granted") {
      showToast("Notifications were not enabled. You can allow them in browser settings.");
      return;
    }

    // Read through the ref: `activities` in this closure was captured before the
    // permission prompt, and the user may have logged entries while it was open.
    const next = { ...persistedStateRef.current.reminders, feedEnabled: true };
    if (!persistSnapshot(persistedStateRef.current.activities, undefined, undefined, next)) return;
    setReminders(next);
    showToast("Feed reminders on");
  }

  function changeFeedReminderInterval(minutes: number) {
    if (![120, 180, 240].includes(minutes)) return;
    const next = { ...reminders, feedIntervalMinutes: minutes };
    if (!persistSnapshot(activities, profile, nightMode, next)) return;
    setReminders(next);
  }

  function exportData() {
    // A debug-preview export is marked so the import guard rejects it — fake
    // entries must never be restorable over a real log.
    const exportProfile = debugMode ? { ...profile, isDemo: true } : profile;
    const payload = JSON.stringify({ profile: exportProfile, activities, nightMode, reminders, onboardingComplete: true, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = debugMode
      ? `baby-tracker-DEBUG-${new Date().toISOString().slice(0, 10)}.json`
      : `baby-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast(debugMode ? "Debug file saved — this is not your real log" : "Backup saved to your device");
  }

  function downloadRecovery() {
    try {
      const raw = window.localStorage.getItem(RECOVERY_KEY) ?? window.localStorage.getItem(STORAGE_KEY);
      if (!raw) throw new Error("No recovery data");
      const blob = new Blob([raw], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `baby-tracker-recovery-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast("Recovery data is unavailable in this browser");
    }
  }

  function resetUnreadableData() {
    if (!window.confirm("Reset the unreadable local copy? Download recovery first if you may need it.")) return;
    try {
      const doomed = window.localStorage.getItem(STORAGE_KEY);
      window.localStorage.removeItem(STORAGE_KEY);
      if (doomed) {
        // Preserve the unreadable blob after freeing its slot — the reverse order
        // momentarily doubles the payload and throws in the quota scenario that
        // usually caused the unreadable copy in the first place.
        try {
          window.localStorage.setItem(RECOVERY_KEY, doomed);
        } catch {
          // The removal above already unblocked the tracker.
        }
      }
      applyLoadedState({ activities: [], profile: EMPTY_PROFILE, bootState: "onboarding" });
      setStorageWarning(null);
      showToast("Local copy reset. Start with a clean tracker.");
    } catch {
      showToast("This browser is still blocking local storage");
    }
  }

  function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      showToast("That backup is too large to import safely");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseStoredData(String(reader.result));
        if (bootState === "ready" && !window.confirm("Restore this backup? Your current timeline will be replaced and cannot be recovered from the app.")) {
          return;
        }
        let recoveryCreated = true;
        if (bootState === "ready" && !debugMode) {
          try {
            window.localStorage.setItem(
              RECOVERY_KEY,
              JSON.stringify({ profile, activities, nightMode, reminders, onboardingComplete: true }),
            );
          } catch {
            recoveryCreated = false;
          }
        }
        if (!recoveryCreated && !window.confirm("This browser cannot create a recovery copy. Restore anyway and replace the current timeline without rollback?")) {
          return;
        }
        if (parsed.legacyDemo) throw new Error("Preview backups are not importable");
        const nextProfile = parsed.profile;
        const nextReminders = parsed.reminders ?? DEFAULT_REMINDERS;
        const restoringFromRecovery = bootState !== "ready";
        if (!persistSnapshot(parsed.activities, nextProfile, Boolean(parsed.nightMode), nextReminders, true)) return;
        if (restoringFromRecovery) {
          // The stale recovery copy must not shadow future downloads now that a
          // healthy timeline is in place. (Ready-state imports keep the fresh
          // pre-import copy written above.)
          try {
            window.localStorage.removeItem(RECOVERY_KEY);
          } catch {
            // Ignore: nothing depends on the removal succeeding.
          }
        }
        setProfile(nextProfile);
        setActivities(parsed.activities);
        setNightMode(Boolean(parsed.nightMode));
        setReminders(nextReminders);
        setStorageWarning(null);
        setBootState("ready");
        showToast(parsed.droppedActivities > 0
          ? `Backup restored — ${parsed.droppedActivities} unreadable ${parsed.droppedActivities === 1 ? "entry was" : "entries were"} skipped`
          : "Backup restored");
      } catch {
        showToast("That backup could not be read");
      }
    };
    reader.onerror = () => showToast("That backup could not be opened");
    reader.readAsText(file);
    event.target.value = "";
  }

  function dismissRecoveredNotice() {
    setRecoveredNotice(null);
  }

  return {
    bootState,
    activities,
    profile,
    nightMode,
    reminders,
    storageWarning,
    recoveredNotice,
    addActivity,
    updateActivity,
    removeActivity,
    stopTimer,
    changeNightMode,
    saveProfile,
    completeOnboarding,
    changeFeedReminders,
    changeFeedReminderInterval,
    exportData,
    importData,
    downloadRecovery,
    resetUnreadableData,
    dismissRecoveredNotice,
  };
}
