// Asking about a backup before it is too late to ask.
//
// Everything this app knows lives in one browser's storage on one phone. That
// is the promise and it is also the whole risk: a lost phone, a cleared
// browser, or an operating system quietly reclaiming space, and a year of a
// baby's life is gone with no warning and nothing to restore from. Until now
// the app said nothing about it until storage had ALREADY failed, which is the
// one moment the advice is useless.
//
// It is a nudge, not an alarm. The rules below exist to make sure it is worth
// reading on the rare occasions it appears:
//
//   • Not until there is something to lose. A parent three entries in has
//     nothing worth interrupting them for.
//   • Never if Family Sync is on. Their log is already in two places.
//   • Never if they backed up recently. They did the thing; do not ask again.
//   • Not for a while after they say no. "No" is an answer.
//
// And it says something different when the browser has actually told us it may
// evict the data, because at that point it is not a precaution any more.

export type BackupInput = {
  /** Live entries — tombstones are not something anyone would miss. */
  entries: number;
  /** When a backup file was last written, ISO, or null for never. */
  lastBackupAt: string | null;
  /** Family Sync paired: the log already exists somewhere else. */
  synced: boolean;
  /**
   * What navigator.storage.persist() answered. FALSE is the interesting one:
   * the browser is telling us this data is evictable. null means it was never
   * asked or the browser does not know.
   */
  storagePersisted: boolean | null;
  /** When the nudge was last dismissed, ISO, or null. */
  dismissedAt: string | null;
};

export type BackupNudge = {
  tone: "info" | "warn";
  headline: string;
  body: string;
  /** The label for the action that resolves it. */
  action: string;
};

/** Below this there is nothing worth interrupting a new parent for. */
export const MIN_ENTRIES = 20;
/** A backup this fresh is still a backup. */
export const BACKUP_FRESH_DAYS = 30;
/** How long "not now" lasts. */
export const DISMISS_DAYS = 14;

const DAY = 24 * 60 * 60_000;

function daysSince(iso: string | null, now: number): number | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  return (now - then) / DAY;
}

export function backupNudge(input: BackupInput, now: number): BackupNudge | null {
  if (input.synced) return null;
  if (input.entries < MIN_ENTRIES) return null;

  const sinceBackup = daysSince(input.lastBackupAt, now);
  if (sinceBackup !== null && sinceBackup < BACKUP_FRESH_DAYS) return null;

  const sinceDismiss = daysSince(input.dismissedAt, now);
  if (sinceDismiss !== null && sinceDismiss < DISMISS_DAYS) return null;

  // The browser has said out loud that it may reclaim this. That is no longer
  // a precaution, and the wording stops being gentle about it.
  if (input.storagePersisted === false) {
    return {
      tone: "warn",
      headline: "This browser may delete your log",
      body:
        "It has not promised to keep it. Clearing site data, or the phone running low on space, would take every entry with it. A backup file or Family Sync fixes that for good.",
      action: "Download a backup",
    };
  }

  return {
    tone: "info",
    headline: `${input.entries} entries, on this phone only`,
    body:
      sinceBackup === null
        ? "There is no copy of them anywhere else. If this phone breaks or the browser is cleared, they go with it."
        : "Your last backup is over a month old. Everything since then exists only here.",
    action: "Download a backup",
  };
}
