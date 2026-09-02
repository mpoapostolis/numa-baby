import { ChangeEvent, useEffect, useRef, useState } from "react";
import { mergeActivities, mergeStored, summarizeMerge } from "../domain/merge";
import { activityUpdatedAt, liveActivities, parseStoredData } from "../domain/validate";
import { Activity, BootState, Profile, ReminderSettings } from "../domain/types";
import { STALE_OPEN_SPAN_MINUTES } from "../domain/daySummary";
import { humanDuration } from "../domain/time";

// The entire persistence core in one hook: the five persisted state slices,
// the persist-first write path (nothing reaches React state unless the write
// succeeded), inverse-operation undo, boot, cross-tab sync and backup flows.
// The UI layer only ever sees state plus actions.

export const STORAGE_KEY = "numa-baby-v1";
export const RECOVERY_KEY = "numa-baby-v1-recovery";
/** When a backup file was last written. Its own key, not part of the blob:
    a backup is a fact about this device, and restoring an old blob must not
    resurrect an old answer to "have you backed up lately". */
export const LAST_BACKUP_KEY = "numa-baby-last-backup-v1";
const EMPTY_PROFILE: Profile = { name: "", birthDate: "", feedingMode: "mixed" };
const DEFAULT_REMINDERS: ReminderSettings = {
  feedEnabled: false,
  feedIntervalMinutes: 180,
  diaperEnabled: false,
  diaperIntervalMinutes: 120,
};

// Tombstones (deleted: true) are kept in storage so a future sync can merge
// deletions across devices, but they must not grow the blob forever. Any
// tombstone whose last write (activityUpdatedAt) is older than this window has
// had ample time to propagate and is dropped on the next persist.
const TOMBSTONE_RETENTION_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

// localStorage is counted in UTF-16 code units against a budget of 5 MiB on
// Safari and Firefox (10 MiB on Chromium). 1.8 million characters is about
// 70% of the smaller budget: months of entries still fit, and "download a
// backup" arrives as advice rather than as an autopsy. Once quota is actually
// hit nothing can be written — not even a deletion, which is a tombstone
// write — so the warning has to come first.
const STORAGE_WATERMARK_CHARS = 1_800_000;
const LARGE_LOG_WARNING = "Your log is getting large for this browser. Download a backup so nothing is ever lost.";

function isQuotaError(error: unknown): boolean {
  if (!(error instanceof DOMException)) return false;
  return (
    error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    error.code === 22 ||
    error.code === 1014
  );
}

/** setItem with one retry at quota. The recovery copy — a pre-import rollback
    snapshot, or the raw blob of a boot that skipped rows — is the only other
    thing this origin stores at size, and at quota the entry being logged right
    now matters more than an old rollback. Only in the ready state: on the
    recovery screen that copy may be a family's only surviving version. */
function writeBlob(text: string, mayDropRecovery: boolean): "written" | "freed" | "failed" {
  try {
    window.localStorage.setItem(STORAGE_KEY, text);
    return "written";
  } catch (error) {
    if (!mayDropRecovery || !isQuotaError(error)) return "failed";
    try {
      if (window.localStorage.getItem(RECOVERY_KEY) === null) return "failed";
      window.localStorage.removeItem(RECOVERY_KEY);
      window.localStorage.setItem(STORAGE_KEY, text);
      return "freed";
    } catch {
      return "failed";
    }
  }
}

function sweepExpiredTombstones(list: Activity[]): Activity[] {
  const cutoff = Date.now() - TOMBSTONE_RETENTION_DAYS * DAY_MS;
  const swept = list.filter(
    (activity) => !activity.deleted || new Date(activityUpdatedAt(activity)).getTime() >= cutoff,
  );
  return swept.length === list.length ? list : swept;
}

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
  // What the browser answered when asked to keep this data. FALSE is the
  // interesting one: it is the browser saying out loud that it may reclaim a
  // year of a baby's life to free up space. Discarding that answer, as this
  // did, meant eviction looked exactly like a bug.
  const [storagePersisted, setStoragePersisted] = useState<boolean | null>(null);
  const [recoveredNotice, setRecoveredNotice] = useState<string | null>(null);
  // Bumped on every successful persist. The sync engine watches it to know
  // "something was written locally" without reaching into this hook's internals.
  const [persistVersion, setPersistVersion] = useState(0);
  // Bumped only when entries arrive that this device did not just write — an
  // imported backup, or a log walked over from the app's other web address.
  // Family Sync watches it because those entries carry their ORIGINAL
  // timestamps, which sit below its push cursor and would otherwise never be
  // sent. See domain/syncCursor.ts.
  const [backfillVersion, setBackfillVersion] = useState(0);
  // The oldest updatedAt among the entries the last merge brought in — the
  // sync hook rewinds its push cursor past this so they actually upload.
  const [backfillOldestAt, setBackfillOldestAt] = useState("");
  // Always-current mirror of every persisted slice. Undo callbacks and post-await
  // code read from here so they never write a stale render's snapshot to storage.
  // Synced inside persistSnapshot and the load paths — never from render.
  // NOTE: `activities` here is the FULL persisted list including tombstones;
  // the React `activities` state above is always its live (non-deleted) view.
  const persistedStateRef = useRef({
    activities,
    profile,
    nightMode,
    reminders,
    bootState,
    profileUpdatedAt: undefined as string | undefined,
  });

  // Single entry point for loading state from storage (boot, cross-tab, reset):
  // keeps the persisted-state ref and React state in lockstep.
  function applyLoadedState(next: {
    activities: Activity[];
    profile: Profile;
    profileUpdatedAt?: string;
    nightMode?: boolean;
    reminders?: ReminderSettings;
    bootState: BootState;
  }) {
    const merged = {
      activities: next.activities,
      profile: next.profile,
      profileUpdatedAt: next.profileUpdatedAt,
      nightMode: next.nightMode ?? persistedStateRef.current.nightMode,
      reminders: next.reminders ?? persistedStateRef.current.reminders,
      bootState: next.bootState,
    };
    persistedStateRef.current = merged;
    setActivities(liveActivities(merged.activities));
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
                profileUpdatedAt: parsed.profileUpdatedAt,
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
      navigator.storage
        ?.persist?.()
        .then((granted) => setStoragePersisted(granted))
        .catch(() => undefined);
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
            profileUpdatedAt: parsed.profileUpdatedAt,
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
    nextProfileUpdatedAt: string | undefined = persistedStateRef.current.profileUpdatedAt,
  ) {
    // Every persist doubles as the tombstone sweep: expired tombstones are
    // dropped from what gets written (and from the ref), never from mid-flight
    // UI state — the live view they were already absent from.
    const sweptActivities = sweepExpiredTombstones(nextActivities);
    const nextPersisted = {
      activities: sweptActivities,
      profile: nextProfile,
      nightMode: nextNightMode,
      reminders: nextReminders,
      bootState: nextOnboardingComplete ? ("ready" as const) : persistedStateRef.current.bootState,
      profileUpdatedAt: nextProfileUpdatedAt,
    };
    if (debugMode) {
      persistedStateRef.current = nextPersisted;
      setStorageWarning(null);
      setPersistVersion((version) => version + 1);
      return true;
    }
    // profileUpdatedAt is undefined until a profile save stamps it;
    // JSON.stringify drops the key, keeping legacy blobs byte-identical.
    const text = JSON.stringify({ activities: sweptActivities, profile: nextProfile, nightMode: nextNightMode, reminders: nextReminders, onboardingComplete: nextOnboardingComplete, profileUpdatedAt: nextProfileUpdatedAt });
    const outcome = writeBlob(text, persistedStateRef.current.bootState === "ready");
    if (outcome === "failed") {
      setStorageWarning("This browser could not save the latest change. Your previous data is still intact.");
      showToast("Could not save on this device. Nothing was changed.");
      return false;
    }
    persistedStateRef.current = nextPersisted;
    // The warning is the one surface that speaks before quota does: a log
    // that has grown to most of the browser's budget gets a standing
    // "download a backup" long before a tap fails.
    setStorageWarning(text.length > STORAGE_WATERMARK_CHARS ? LARGE_LOG_WARNING : null);
    if (outcome === "freed") showToast("Storage was full — an older recovery copy was removed to make room.");
    setPersistVersion((version) => version + 1);
    return true;
  }

  // After a successful persistSnapshot the ref holds the swept full list;
  // React state always shows its live view.
  function syncActivitiesFromRef() {
    setActivities(liveActivities(persistedStateRef.current.activities));
  }

  function addActivity(activity: Activity, message: string) {
    const stamped: Activity = { ...activity, updatedAt: new Date().toISOString() };
    const next = [stamped, ...persistedStateRef.current.activities];
    if (!persistSnapshot(next)) return false;
    syncActivitiesFromRef();
    showToast(message, () => {
      // Remove exactly this entry — never restore a whole stale array, which
      // would silently delete anything logged after it. And remove it as a
      // TOMBSTONE, like any other deletion, never as a filter-out: the entry
      // may already have left this device. Family Sync pushes two seconds
      // after a save and this toast stays for four, so an entry filtered out
      // of the list was still on the server, came straight back on the next
      // poll, and was announced as "new from your partner". A tombstone
      // travels; a gap does not.
      const undone = persistedStateRef.current.activities.map((item) =>
        item.id === stamped.id
          ? { ...item, deleted: true as const, updatedAt: new Date().toISOString() }
          : item,
      );
      if (!persistSnapshot(undone)) return;
      syncActivitiesFromRef();
      showToast("Last change undone");
    });
    return true;
  }

  function updateActivity(next: Activity) {
    const stamped: Activity = { ...next, updatedAt: new Date().toISOString() };
    const nextActivities = persistedStateRef.current.activities.map((activity) => activity.id === stamped.id ? stamped : activity);
    if (!persistSnapshot(nextActivities)) return false;
    syncActivitiesFromRef();
    return true;
  }

  function removeActivity(activity: Activity) {
    // Delete is a tombstone write, not a filter-out: the row stays in storage
    // (deleted: true) so a future sync can merge the deletion, and the UI only
    // ever sees the live view.
    const next = persistedStateRef.current.activities.map((item) =>
      item.id === activity.id
        ? { ...item, deleted: true as const, updatedAt: new Date().toISOString() }
        : item,
    );
    if (!persistSnapshot(next)) return false;
    syncActivitiesFromRef();
    showToast("Entry removed", () => {
      // Undo revives the tombstone in place: the deleted flag comes off and the
      // revival is itself a fresh write (restamped updatedAt) so it wins a merge.
      const restored = persistedStateRef.current.activities.map((item) => {
        if (item.id !== activity.id) return item;
        const revived: Activity = { ...item, updatedAt: new Date().toISOString() };
        delete revived.deleted;
        return revived;
      });
      if (!persistSnapshot(restored)) return;
      syncActivitiesFromRef();
      showToast("Entry restored");
    });
    return true;
  }

// What a running timer is called, so stopping a burp no longer reports a
// nursing session. Three timers exist; the fallbacks cover a fourth arriving
// without this file being updated.
const TIMER_LABEL: Partial<Record<Activity["type"], string>> = {
  nursing: "Nursing session",
  sleep: "Sleep",
  burp: "Burping",
};
const TIMER_NOUN: Partial<Record<Activity["type"], string>> = {
  nursing: "nursing timer",
  sleep: "sleep timer",
  burp: "burping timer",
};

  function stopTimer(id: string) {

    const current = persistedStateRef.current.activities;
    const target = current.find((activity) => activity.id === id);
    if (!target || target.deleted || target.endedAt) return;
    const stampedAt = new Date().toISOString();
    const ranForMinutes = Math.round(
      (Date.parse(stampedAt) - Date.parse(target.startedAt)) / 60_000,
    );

    // A timer left running overnight is not a forty-hour feed, and the summaries
    // already refuse to count one (STALE_OPEN_SPAN_MINUTES in daySummary.ts).
    // Until now the ENTRY was still written at its full length, so the log and
    // the recap disagreed and only the recap was right. Neither guessing is
    // safe here — a genuine long sleep and a forgotten stopwatch look identical
    // from the outside — so this is the one moment worth asking about.
    if (ranForMinutes > STALE_OPEN_SPAN_MINUTES) {
      // OK is the reflex tap, so OK must be the SAFE answer: it saves. Only
      // an explicit Cancel discards — the previous mapping put a genuine
      // overnight sleep one habitual OK away from a tombstone.
      const savedIt = window.confirm(
        `This ${TIMER_NOUN[target.type] ?? "timer"} has been running for ${humanDuration(ranForMinutes)}. ` +
          `That is usually a timer left on by mistake.\n\nOK saves it as a ${humanDuration(ranForMinutes)} session. Cancel discards it.`,
      );
      if (!savedIt) {
        // Discarded, not deleted-and-forgotten: it becomes a tombstone like any
        // other removal, so the other phone drops it too.
        const withoutIt = current.map((activity) =>
          activity.id === id ? { ...activity, deleted: true as const, updatedAt: stampedAt } : activity,
        );
        if (!persistSnapshot(withoutIt)) return;
        syncActivitiesFromRef();
        showToast("Timer discarded — nothing was added to the log");
        return;
      }
    }

    const nextActivities = current.map((activity) =>
        activity.id === id
          ? { ...activity, endedAt: stampedAt, updatedAt: stampedAt }
          : activity,
    );
    if (!persistSnapshot(nextActivities)) return;
    syncActivitiesFromRef();
    showToast(`${TIMER_LABEL[target.type] ?? "Session"} saved — ${humanDuration(ranForMinutes)}`);
  }

  function changeNightMode(enabled: boolean) {
    if (bootState === "recovery") {
      // Never persist from the recovery screen — it would overwrite the unreadable
      // original that the recovery card promises to leave untouched.
      setNightMode(enabled);
      return;
    }
    // Read activities through the ref: the live state is missing tombstones,
    // and persisting it would silently drop them from storage.
    if (!persistSnapshot(persistedStateRef.current.activities, profile, enabled)) return;
    setNightMode(enabled);
  }

  function saveProfile(nextProfile: Profile) {
    // Stamp the save so the sync engine can tell whose profile edit is fresher.
    if (!persistSnapshot(persistedStateRef.current.activities, nextProfile, undefined, undefined, undefined, new Date().toISOString())) return false;
    setProfile(nextProfile);
    return true;
  }

  function completeOnboarding(nextProfile: Profile) {
    if (!persistSnapshot([], nextProfile, nightMode, reminders, true, new Date().toISOString())) return false;
    setActivities([]);
    setProfile(nextProfile);
    setStorageWarning(null);
    setBootState("ready");
    return true;
  }

  // The phone that STARTS a family is the source of truth for the baby's
  // profile, but a profile saved before sync existed carries no stamp — and
  // the push deliberately only sends stamped profiles, so without this the
  // partner's phone would join and never learn the baby's name or birth date.
  // Stamping once, at pairing, makes the existing profile syncable without
  // touching a single entry. A phone that JOINS must never call this: its
  // profile has to lose to the family's.
  /** The counterpart of stampProfileForSync, for JOINS: strip this device's
      profile claim entirely, so the family's own identity wins the merge and
      nothing local ever pushes over it. persistSnapshot cannot express
      "explicitly undefined" through its default parameter, so the ref is
      adjusted first and persisted as-is. */
  function demoteProfileForJoin() {
    persistedStateRef.current.profileUpdatedAt = undefined;
    persistSnapshot(persistedStateRef.current.activities);
  }

  /** Adopt-the-cloud-copy: drop every local entry and the profile claim in
      one stroke, for a device joining a family it wants to mirror, not
      pollute. Never called without the person choosing it in a dialog. */
  function dropLocalForAdoption() {
    persistedStateRef.current.profileUpdatedAt = undefined;
    persistSnapshot([]);
  }

  function stampProfileForSync() {
    const current = persistedStateRef.current;
    const isEmptyDefault = current.profile.name === "" && current.profile.birthDate === "";
    if (current.profileUpdatedAt || isEmptyDefault) return;
    persistSnapshot(
      current.activities,
      current.profile,
      undefined,
      undefined,
      undefined,
      new Date().toISOString(),
    );
  }

  // A phone that joined a family skips the setup form entirely: it has no
  // baby of its own to describe, and the profile is about to arrive over the
  // sync. Onboarding is marked complete so the app reaches "ready" — the sync
  // engine deliberately refuses to pull before then — and the profile is left
  // as the untouched empty default with NO stamp, so the first pull adopts the
  // family's copy rather than out-ranking it with a fresh local timestamp.
  function completeJoin() {
    const current = persistedStateRef.current;
    if (!persistSnapshot(current.activities, current.profile, nightMode, reminders, true, current.profileUpdatedAt)) {
      return false;
    }
    setBootState("ready");
    return true;
  }

  async function changeReminder(
    key: "feedEnabled" | "diaperEnabled",
    enabled: boolean,
    label: string,
  ) {
    if (!enabled) {
      const next = { ...reminders, [key]: false };
      if (!persistSnapshot(persistedStateRef.current.activities, profile, nightMode, next)) return;
      setReminders(next);
      showToast(`${label} reminders off`);
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
    const next = { ...persistedStateRef.current.reminders, [key]: true };
    if (!persistSnapshot(persistedStateRef.current.activities, undefined, undefined, next)) return;
    setReminders(next);
    showToast(`${label} reminders on`);
  }

  function changeFeedReminders(enabled: boolean) {
    return changeReminder("feedEnabled", enabled, "Feed");
  }

  // Asked for by a user: "put a reminder to change diaper".
  function changeDiaperReminders(enabled: boolean) {
    return changeReminder("diaperEnabled", enabled, "Nappy");
  }

  function changeFeedReminderInterval(minutes: number) {
    if (![120, 180, 240].includes(minutes)) return;
    const next = { ...reminders, feedIntervalMinutes: minutes };
    if (!persistSnapshot(persistedStateRef.current.activities, profile, nightMode, next)) return;
    setReminders(next);
  }

  function changeDiaperReminderInterval(minutes: number) {
    if (![90, 120, 180].includes(minutes)) return;
    const next = { ...reminders, diaperIntervalMinutes: minutes };
    if (!persistSnapshot(persistedStateRef.current.activities, profile, nightMode, next)) return;
    setReminders(next);
  }

  // Sync ingestion. Union the partner's rows into the FULL persisted list
  // (mergeActivities: LWW, ties to the tombstone, deletions never resurrect)
  // and report what changed from this device's point of view. Persist-first
  // like every write path — and only when something actually changed, so the
  // 60-second poll never rewrites an identical blob.
  // `persisted: false` is the one outcome the sync cursor must respect: the
  // merge computed fine but the write to storage failed, so advancing past
  // these rows would skip them forever.
  function mergeRemote(remote: Activity[], remoteProfile?: Profile, remoteProfileUpdatedAt?: string): { added: number; updated: number; persisted: boolean } {
    const current = persistedStateRef.current;
    const merged = remote.length ? mergeActivities(current.activities, remote) : current.activities;
    const summary = remote.length ? summarizeMerge(current.activities, merged) : { added: 0, updated: 0 };
    // Profile rule: adopt the remote copy only when it cannot clobber a fresher
    // local edit — the local profile is still the untouched empty default, or
    // the remote stamp is strictly newer than the local one. A local profile
    // that predates stamping counts as older: once a family syncs, the stamped
    // copy is the only one whose recency is known, and a local re-edit always
    // stamps newer and wins back.
    const localMs = current.profileUpdatedAt ? new Date(current.profileUpdatedAt).getTime() : -1;
    const remoteMs = remoteProfileUpdatedAt ? new Date(remoteProfileUpdatedAt).getTime() : -1;
    const emptyDefault = current.profile.name === "" && current.profile.birthDate === "";
    const adoptProfile = remoteProfile !== undefined && (emptyDefault || remoteMs > localMs);
    if (summary.added === 0 && summary.updated === 0 && !adoptProfile) return { added: 0, updated: 0, persisted: true };
    const nextProfile = adoptProfile && remoteProfile ? remoteProfile : current.profile;
    const nextStamp = adoptProfile && remoteProfileUpdatedAt ? remoteProfileUpdatedAt : current.profileUpdatedAt;
    if (!persistSnapshot(merged, nextProfile, undefined, undefined, undefined, nextStamp)) {
      return { added: 0, updated: 0, persisted: false };
    }
    syncActivitiesFromRef();
    if (adoptProfile) setProfile(nextProfile);
    return { added: summary.added, updated: summary.updated, persisted: true };
  }

  // Sync egress. A function rather than a value so the debounced push reads
  // the ref at send time — never a stale render's snapshot. Returns the FULL
  // list (tombstones included: deletions must travel) plus the profile stamp.
  function readPersisted() {
    const { activities, profile, profileUpdatedAt } = persistedStateRef.current;
    return { activities, profile, profileUpdatedAt };
  }

  // One payload for every way data leaves this device (download, share): the
  // full persisted list, tombstones included — a backup is a sync artifact, and
  // a restore elsewhere must be able to merge deletions too. A debug-preview
  // export is marked isDemo so the import guard rejects it — fake entries must
  // never be restorable over a real log.
  function buildExportFile() {
    const exportProfile = debugMode ? { ...profile, isDemo: true } : profile;
    // Compact, not pretty-printed: the indented form was a third larger, and
    // a year of one baby's log crossed the import path's own size cap at
    // about eleven months — the backup the app itself wrote was refused by
    // its own Restore button, discovered on the new phone after the old one
    // was gone. Nobody reads a backup file; everybody needs it to open.
    const payload = JSON.stringify({ profile: exportProfile, activities: persistedStateRef.current.activities, nightMode, reminders, onboardingComplete: true, exportedAt: new Date().toISOString() });
    const name = debugMode
      ? `numalog-DEBUG-${new Date().toISOString().slice(0, 10)}.json`
      : `numalog-backup-${new Date().toISOString().slice(0, 10)}.json`;
    return { payload, name };
  }

  function downloadExportFile(payload: string, name: string) {
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast(debugMode ? "Debug file saved — this is not your real log" : "Backup saved to your device");
  }

  function exportData() {
    const { payload, name } = buildExportFile();
    downloadExportFile(payload, name);
    try {
      window.localStorage.setItem(LAST_BACKUP_KEY, new Date().toISOString());
    } catch {
      // Storage blocked. The file was still written, which is the part that
      // matters; the nudge will simply ask again.
    }
  }

  /** The backup file's contents, without writing a file — what the handoff
      hands to the app's other web address. */
  function exportPayload(): string {
    return buildExportFile().payload;
  }

  async function sharePartner() {
    const { payload, name } = buildExportFile();
    const file = new File([payload], name, { type: "application/json" });
    if (!navigator.canShare?.({ files: [file] })) {
      // No file sharing here (typically desktop): the download is the same
      // payload, so the partner flow still works via any file hand-off.
      downloadExportFile(payload, name);
      return;
    }
    try {
      await navigator.share({ files: [file] });
      showToast(debugMode
        ? "Debug file shared — this is not your real log"
        : "Shared — have your partner open it in their Numalog");
    } catch (error) {
      // Closing the share sheet is a decision, not a failure — stay silent.
      if (error instanceof DOMException && error.name === "AbortError") return;
      // canShare said yes but share still failed: fall back to the download.
      downloadExportFile(payload, name);
    }
  }

  function downloadRecovery() {
    try {
      const raw = window.localStorage.getItem(RECOVERY_KEY) ?? window.localStorage.getItem(STORAGE_KEY);
      if (!raw) throw new Error("No recovery data");
      const blob = new Blob([raw], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `numalog-recovery-${new Date().toISOString().slice(0, 10)}.json`;
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

  /**
   * Merge a backup, whatever brought it here.
   *
   * A file the parent chose, or a log handed over from the app's old web
   * address (domain/handoff.ts) — the confirmation, the rollback copy, the
   * validation and the counts are the same either way, because a second route
   * into the timeline is a second place for it to go wrong.
   *
   * @param prompt what to ask before merging, since the two callers arrive
   *               with different context
   * @param source where the data came from, which decides how much is taken on
   *               trust. A FILE was chosen by the person holding the phone. A
   *               LINK was not: anyone can put one in front of anybody, so it
   *               is always confirmed and never allowed near the recovery copy.
   * @returns whether anything was merged
   */
  function mergeBackupText(text: string, prompt: string, source: "file" | "link"): boolean {
      try {
        const parsed = parseStoredData(text);
        if (parsed.legacyDemo) throw new Error("Preview backups are not importable");
        // A file is only ever merged unasked on a phone with nothing to lose —
        // a fresh install, or the recovery screen, where the parent has just
        // picked the file themselves. A link has no such story: it is always
        // confirmed, whatever state the app is in, or a page could plant a
        // fabricated log on a fresh install with no tap at all.
        if ((source === "link" || bootState === "ready") && !window.confirm(prompt)) return false;
        // Rollback safety: the pre-merge state is written to the recovery slot
        // BEFORE anything is merged, so a bad backup can always be walked back.
        let recoveryCreated = true;
        if (bootState === "ready" && !debugMode) {
          try {
            window.localStorage.setItem(
              RECOVERY_KEY,
              JSON.stringify({
                profile: persistedStateRef.current.profile,
                activities: persistedStateRef.current.activities,
                nightMode: persistedStateRef.current.nightMode,
                reminders: persistedStateRef.current.reminders,
                onboardingComplete: true,
              }),
            );
          } catch {
            recoveryCreated = false;
          }
        }
        if (!recoveryCreated && !window.confirm("This browser cannot create a recovery copy. Merge the backup anyway without rollback?")) {
          return false;
        }
        const localActivities = persistedStateRef.current.activities;
        const merged = mergeStored(
          {
            activities: localActivities,
            profile: persistedStateRef.current.profile,
            nightMode: persistedStateRef.current.nightMode,
            reminders: persistedStateRef.current.reminders,
          },
          {
            activities: parsed.activities,
            profile: parsed.profile,
            nightMode: Boolean(parsed.nightMode),
            reminders: parsed.reminders ?? DEFAULT_REMINDERS,
          },
        );
        const summary = summarizeMerge(localActivities, merged.activities);
        // Only a file the parent chose may clear the recovery copy, and only
        // when they were on the recovery screen to choose it. In that state the
        // copy is a family's ONLY surviving version of an unreadable log, and a
        // link that could delete it would be a way to destroy someone's history
        // from a distance — with no tap, and nothing left to restore.
        const restoringFromRecovery = source === "file" && bootState !== "ready";
        if (!persistSnapshot(merged.activities, merged.profile, merged.nightMode, merged.reminders, true)) return false;
        if (restoringFromRecovery) {
          // The stale recovery copy must not shadow future downloads now that a
          // healthy timeline is in place. (Ready-state imports keep the fresh
          // pre-merge copy written above.)
          try {
            window.localStorage.removeItem(RECOVERY_KEY);
          } catch {
            // Ignore: nothing depends on the removal succeeding.
          }
        }
        setProfile(merged.profile);
        syncActivitiesFromRef();
        setNightMode(merged.nightMode);
        setReminders(merged.reminders);
        setStorageWarning(null);
        setBootState("ready");
        // History has been rewritten underneath the sync cursor: whatever came
        // in is dated when it was first logged, not now. The oldest incoming
        // stamp travels with the bump so the sync hook can rewind its PUSH
        // cursor past it — without this, merged entries were pulled fine but
        // never pushed, and two paired phones could drift apart forever (the
        // exact mismatch one family chased for days).
        if (summary.added > 0 || summary.updated > 0) {
          const oldest = parsed.activities.reduce(
            (low, activity) => {
              const stamp = activityUpdatedAt(activity);
              return low === "" || stamp < low ? stamp : low;
            },
            "",
          );
          setBackfillOldestAt(oldest);
          setBackfillVersion((v) => v + 1);
        }
        const counts = `Merged: ${summary.added} new, ${summary.updated} updated, ${summary.unchanged} unchanged`;
        showToast(parsed.droppedActivities > 0
          ? `${counts} — ${parsed.droppedActivities} unreadable ${parsed.droppedActivities === 1 ? "entry" : "entries"} skipped`
          : counts);
        return true;
      } catch {
        showToast("That backup could not be read");
        return false;
      }
  }

  function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    // A memory bound, not a data bound: a year of one baby is under two
    // megabytes, so this is a hundred years of logging, and the earlier
    // 2 MB cap refused the app's own year-old backups.
    if (file.size > 25_000_000) {
      showToast("That backup is too large to import safely");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      mergeBackupText(
        String(reader.result),
        "Merge this backup into your timeline? Existing entries stay; newer versions win.",
        "file",
      );
    };
    reader.onerror = () => showToast("That backup could not be opened");
    reader.readAsText(file);
    event.target.value = "";
  }

  function dismissRecoveredNotice() {
    setRecoveredNotice(null);
  }

  // Deliberate, confirmed, total erase — the only way back to onboarding.
  function eraseAllData(): boolean {
    // Count only live entries — tombstones are invisible bookkeeping and would
    // inflate the number a parent is asked to confirm deleting.
    const count = liveActivities(persistedStateRef.current.activities).length;
    const name = persistedStateRef.current.profile.name.trim() || "your baby";
    if (
      !window.confirm(
        `Erase all of ${name}'s data from this device? ${count} ${count === 1 ? "entry" : "entries"} will be deleted. Download a backup first if you may ever need it — this cannot be undone.`,
      )
    ) return false;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      window.localStorage.removeItem(RECOVERY_KEY);
      applyLoadedState({
        activities: [],
        profile: EMPTY_PROFILE,
        reminders: DEFAULT_REMINDERS,
        bootState: "onboarding",
      });
      setStorageWarning(null);
      showToast("Everything erased. Starting fresh.");
      return true;
    } catch {
      showToast("This browser blocked the erase. Nothing was changed.");
      return false;
    }
  }

  return {
    bootState,
    activities,
    profile,
    nightMode,
    reminders,
    storageWarning,
    storagePersisted,
    recoveredNotice,
    persistVersion,
    backfillVersion,
    backfillOldestAt,
    mergeRemote,
    readPersisted,
    addActivity,
    updateActivity,
    removeActivity,
    stopTimer,
    changeNightMode,
    saveProfile,
    completeOnboarding,
    completeJoin,
    stampProfileForSync,
    demoteProfileForJoin,
    dropLocalForAdoption,
    changeFeedReminders,
    changeFeedReminderInterval,
    changeDiaperReminders,
    changeDiaperReminderInterval,
    exportData,
    exportPayload,
    sharePartner,
    importData,
    mergeBackupText,
    downloadRecovery,
    resetUnreadableData,
    dismissRecoveredNotice,
    eraseAllData,
  };
}
