import { Activity } from "./types";
import { activityUpdatedAt } from "./validate";

/**
 * Which local entries still need to go to the server.
 *
 * The cursor is a high-water mark: the newest `updatedAt` the server has
 * confirmed. Selecting everything newer than it is correct as long as entries
 * only ever appear in the order they were written — which is true while a
 * parent is just logging feeds on their own phone.
 *
 * It stops being true the moment a backup is imported. Those entries carry the
 * `updatedAt` they were first written with, which is usually months old, so
 * every one of them lands BELOW the cursor and the filter drops the lot. The
 * parent sees the restored history on their own phone and assumes it synced;
 * their partner never receives a single entry of it. Nothing errors, and
 * nothing in the UI says anything is missing.
 *
 * So a backfill — any path that merges entries the device did not just write —
 * invalidates the cursor rather than advancing it, and the next push resends
 * everything. Over-selection is the safe direction here: the server upsert is
 * idempotent and last-write-wins guarded, so a resent entry either changes
 * nothing or correctly loses to a newer version. Under-selection is silent
 * data loss.
 */
/**
 * Where the next pull page starts, from the last row of this one.
 *
 * Pages are ordered by the server's arrival stamp, and arrival stamps TIE:
 * the one-time backfill that gave every pre-existing row a received_at gave
 * them all the same one, and a family with more than a page of such rows
 * had a joining phone fetch the first page twenty times over and never see
 * the rest — "Sync now" said done, the partner's log was silently short.
 * So the cursor is the pair (stamp, id): the server returns rows strictly
 * after it in (received_at, id) order, and a tie costs nothing.
 *
 * A row without receivedAt came from a worker that predates the arrival
 * clock; for that the old rule stands — step the client stamp back one
 * millisecond and let the idempotent merge absorb the repeat.
 */
export function nextPullCursor(
  last: { id: string; updatedAt: string; receivedAt?: string } | undefined,
): { since: string; after?: string } | null {
  if (!last) return null;
  if (last.receivedAt) return { since: last.receivedAt, after: last.id };
  const ms = new Date(last.updatedAt).getTime();
  if (!Number.isFinite(ms)) return null;
  return { since: new Date(ms - 1).toISOString() };
}

export function selectPushDelta(
  activities: Activity[],
  lastPushedAt: string,
  backfilled: boolean,
): Activity[] {
  if (backfilled) return activities;
  const lastMs = lastPushedAt ? new Date(lastPushedAt).getTime() : -1;
  return activities.filter((activity) => new Date(activityUpdatedAt(activity)).getTime() > lastMs);
}
