import { useEffect, useRef, useState } from "react";
import { FamilyPairing, clearPairing, loadPairing, savePairing } from "../domain/familyPairing";
import * as transport from "../domain/syncTransport";
import { Activity, BootState, Profile } from "../domain/types";
import { activityUpdatedAt, isValidActivity, sanitizeProfile } from "../domain/validate";

// The family-sync orchestrator. Owns the pairing lifecycle (create / invite /
// join / leave), pulls the family's changes into the store and pushes local
// writes up, all against the worker API in worker/index.ts.
//
// Failure stance: sync is a background comfort, never a gatekeeper. Fetch
// failures go quiet ("offline") and retry on the next trigger; only a 401
// (token revoked) changes posture, and even then the pairing record is kept
// until the user chooses to leave. In debugMode the hook is fully inert —
// no storage reads, no network, no timers.

const PULL_INTERVAL_MS = 60_000;
const PUSH_DEBOUNCE_MS = 2_000;
// The server filters pulls by CLIENT-stamped updatedAt, so `since` must reach
// back past what we've seen: a partner stamps a row, then debounces ~2s (or
// stays offline for hours) before pushing it — by which time our cursor has
// moved past the stamp. Polls re-cover a short window; open/visible pulls a
// long one. Re-pulled rows are free: the merge is idempotent.
const POLL_OVERLAP_MS = 15 * 60_000;
const OPEN_OVERLAP_MS = 7 * 24 * 60 * 60_000;
// Server page/batch caps (LIMIT 2000, MAX_PUSH_BATCH 500).
const PAGE = 2000;
const PUSH_CHUNK = 500;
const OFFLINE_MESSAGE = "Couldn't reach sync. Try again in a moment.";

export type SyncPhase = "idle" | "syncing" | "offline" | "revoked";
export type SyncStatus = { phase: SyncPhase; lastSyncAt: string | null; deviceCount: number | null };

type FamilySyncOptions = {
  debugMode: boolean;
  bootState: BootState;
  // Bumped by the store on every successful persist — the push trigger.
  persistVersion: number;
  readPersisted: () => { activities: Activity[]; profile: Profile; profileUpdatedAt?: string };
  /** Makes an unstamped legacy profile syncable. Only ever called on create. */
  stampProfileForSync: () => void;
  mergeRemote: (remote: Activity[], profile?: Profile, profileUpdatedAt?: string) => { added: number; updated: number };
  showToast: (message: string) => void;
};

// A pulled row back into an Activity: the payload is the activity minus its
// sync columns, which the row carries authoritatively. Anything malformed
// (a buggy or hostile client pushed it) is dropped by the same validator that
// guards imports — sync can never smuggle in a row a backup couldn't.
function rowToActivity(row: transport.PulledRow): Activity | null {
  const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload) ? row.payload : {};
  const candidate: Record<string, unknown> = { ...payload, id: row.id, updatedAt: row.updatedAt };
  if (row.deleted) candidate.deleted = true;
  else delete candidate.deleted;
  return isValidActivity(candidate) ? candidate : null;
}

// The inverse: strip the sync columns out of the stored payload.
function toPayload(activity: Activity): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...activity };
  delete payload.updatedAt;
  delete payload.deleted;
  return payload;
}

function sinceParam(lastSyncAt: string, overlapMs: number): string {
  const ms = new Date(lastSyncAt).getTime();
  // No cursor yet (fresh pairing) — pull everything.
  if (!Number.isFinite(ms)) return "";
  return new Date(Math.max(0, ms - overlapMs)).toISOString();
}

type LiveSync = {
  pairing: FamilyPairing | null;
  pushTimer: number;
  pullBusy: boolean;
  pushBusy: boolean;
  pushAgain: boolean;
  revoked: boolean;
};

export function useFamilySync({ debugMode, bootState, persistVersion, readPersisted, stampProfileForSync, mergeRemote, showToast }: FamilySyncOptions) {
  const [pairing, setPairing] = useState<FamilyPairing | null>(() => (debugMode ? null : loadPairing()));
  const [status, setStatus] = useState<SyncStatus>(() => ({
    phase: "idle",
    lastSyncAt: pairing && pairing.lastSyncAt ? pairing.lastSyncAt : null,
    deviceCount: null,
  }));
  // Mutable sync internals, mirroring persistedStateRef's pattern: async code
  // reads pairing and in-flight flags from here, never from a render snapshot.
  // Only read inside effects and callbacks — never during render.
  const live = useRef<LiveSync>({ pairing, pushTimer: 0, pullBusy: false, pushBusy: false, pushAgain: false, revoked: false });

  function adoptPairing(next: FamilyPairing | null) {
    live.current.pairing = next;
    setPairing(next);
    if (next) savePairing(next);
    else clearPairing();
  }

  function markFailed(error: unknown) {
    if (error instanceof transport.PairingRevokedError) {
      // The server no longer honours this token. Keep the record — the UI
      // shows reconnect guidance; only an explicit leave discards it.
      live.current.revoked = true;
      setStatus((s) => ({ ...s, phase: "revoked" }));
    } else {
      // Offline or a server hiccup: stay quiet, retry on the next trigger.
      setStatus((s) => ({ ...s, phase: "offline" }));
    }
  }

  function schedulePush() {
    const l = live.current;
    if (!l.pairing || debugMode || l.revoked) return;
    window.clearTimeout(l.pushTimer);
    l.pushTimer = window.setTimeout(() => void runPush(), PUSH_DEBOUNCE_MS);
  }

  async function runPull(open: boolean) {
    const l = live.current;
    const before = l.pairing;
    if (!before || debugMode || l.revoked || l.pullBusy) return;
    l.pullBusy = true;
    setStatus((s) => (s.phase === "syncing" ? s : { ...s, phase: "syncing" }));
    try {
      let added = 0;
      let since = sinceParam(before.lastSyncAt, open ? OPEN_OVERLAP_MS : POLL_OVERLAP_MS);
      let page: transport.PullResult;
      let guard = 0;
      do {
        page = await transport.pullSince(before.token, since, before.deviceId);
        const rows: Activity[] = [];
        if (Array.isArray(page.activities)) {
          for (const row of page.activities) {
            const activity = rowToActivity(row);
            if (activity) rows.push(activity);
          }
        }
        const profile = sanitizeProfile(page.profile) ?? undefined;
        const stamp = typeof page.profileUpdatedAt === "string" ? page.profileUpdatedAt : undefined;
        added += mergeRemote(rows, profile, stamp).added;
        // Keyset pagination for oversized backlogs (the first pull after a
        // join): pages are capped at 2000 rows, updatedAt ascending. Step the
        // cursor 1ms behind the last row so boundary ties re-fetch instead of
        // skip; the idempotent merge makes the repeats free, and the guard
        // bounds the pathological all-one-stamp page.
        const last = Array.isArray(page.activities) ? page.activities[page.activities.length - 1] : undefined;
        const lastMs = last ? new Date(last.updatedAt).getTime() : NaN;
        if (Number.isFinite(lastMs)) since = new Date(lastMs - 1).toISOString();
        guard += 1;
      } while (Array.isArray(page.activities) && page.activities.length >= PAGE && guard < 20);
      const cur = live.current.pairing;
      // Left (or re-paired) while the pull was in flight — drop the result.
      if (!cur || cur.token !== before.token) return;
      adoptPairing({ ...cur, lastSyncAt: page.serverTime });
      setStatus({ phase: "idle", lastSyncAt: page.serverTime, deviceCount: page.deviceCount });
      // Remote arrivals surface exactly once per pull, and only real ones.
      if (added > 0) showToast(`Synced — ${added} new from your partner`);
      // We're clearly online: flush anything the partner is still missing.
      schedulePush();
    } catch (error) {
      markFailed(error);
    } finally {
      l.pullBusy = false;
    }
  }

  async function runPush() {
    const l = live.current;
    const before = l.pairing;
    if (!before || debugMode || l.revoked) return;
    if (l.pushBusy) {
      // A push is mid-flight; run once more after it lands so the latest
      // persist is never left behind.
      l.pushAgain = true;
      return;
    }
    const { activities, profile, profileUpdatedAt } = readPersisted();
    // Delta selection: everything written since the last successful push.
    // Over-selection is safe (the server upsert is idempotent and LWW-guarded);
    // under-selection never happens because the cursor only advances after a
    // confirmed accept.
    const lastMs = before.lastPushedAt ? new Date(before.lastPushedAt).getTime() : -1;
    const delta = activities.filter((activity) => new Date(activityUpdatedAt(activity)).getTime() > lastMs);
    const sendProfile = Boolean(profileUpdatedAt) && profileUpdatedAt !== before.lastPushedProfileAt;
    if (!delta.length && !sendProfile) return;
    l.pushBusy = true;
    setStatus((s) => (s.phase === "syncing" ? s : { ...s, phase: "syncing" }));
    try {
      let maxStamp = before.lastPushedAt;
      // Chunked to the server's batch cap; Math.max keeps one iteration for a
      // profile-only save.
      for (let index = 0; index < Math.max(delta.length, 1); index += PUSH_CHUNK) {
        if (!live.current.pairing) return;
        const chunk = delta.slice(index, index + PUSH_CHUNK);
        await transport.pushBatch(before.token, {
          activities: chunk.map((activity) => ({
            id: activity.id,
            payload: toPayload(activity),
            updatedAt: activityUpdatedAt(activity),
            deleted: activity.deleted === true,
          })),
          deviceId: before.deviceId,
          // The profile rides the first chunk only — one stamp, one winner.
          ...(index === 0 && sendProfile ? { profile, profileUpdatedAt } : {}),
        });
        for (const activity of chunk) {
          const stamp = activityUpdatedAt(activity);
          if (stamp > maxStamp) maxStamp = stamp;
        }
      }
      // Clamp the cursor to this device's clock: a partner's future-skewed
      // stamp we merged and echoed must never freeze our own future pushes.
      const now = new Date().toISOString();
      if (maxStamp > now) maxStamp = now;
      const cur = live.current.pairing;
      if (!cur || cur.token !== before.token) return;
      adoptPairing({
        ...cur,
        lastPushedAt: maxStamp,
        lastPushedProfileAt: sendProfile && profileUpdatedAt ? profileUpdatedAt : cur.lastPushedProfileAt,
      });
      setStatus((s) => (s.phase === "syncing" ? { ...s, phase: "idle" } : s));
    } catch (error) {
      markFailed(error);
    } finally {
      l.pushBusy = false;
      if (l.pushAgain) {
        l.pushAgain = false;
        schedulePush();
      }
    }
  }

  const paired = Boolean(pairing);

  // PULL triggers: becoming paired, boot reaching ready, tab turning visible,
  // and a 60s heartbeat while visible. One interval, always cleaned up. The
  // opening pull is deferred to a timer so no state ever changes synchronously
  // inside the effect body.
  useEffect(() => {
    if (debugMode || !paired || bootState !== "ready") return;
    const opener = window.setTimeout(() => void runPull(true), 0);
    const interval = window.setInterval(() => {
      if (!document.hidden) void runPull(false);
    }, PULL_INTERVAL_MS);
    const onVisibility = () => {
      if (!document.hidden) void runPull(true);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(opener);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // runPull is an event handler, not a dependency: it reads every changing
    // value through live.current, and re-arming the listeners per render would
    // tear down the heartbeat on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debugMode, paired, bootState]);

  // PUSH trigger: every successful local persist bumps persistVersion; the 2s
  // debounce folds a burst of quick logs into one request. Re-running on
  // `paired` also uploads the whole local backlog right after pairing.
  useEffect(() => {
    if (debugMode || !paired || bootState !== "ready") return;
    void persistVersion;
    schedulePush();
    const l = live.current;
    return () => window.clearTimeout(l.pushTimer);
    // persistVersion IS the trigger; schedulePush is an event handler reading
    // only live.current — including it would debounce-reset on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debugMode, paired, bootState, persistVersion]);

  function beginPairing(result: transport.PairResult, label: string) {
    live.current.revoked = false;
    adoptPairing({
      familyId: result.familyId,
      token: result.token,
      deviceId: result.deviceId,
      deviceLabel: label,
      lastSyncAt: "",
      lastPushedAt: "",
      lastPushedProfileAt: "",
    });
    setStatus({ phase: "idle", lastSyncAt: null, deviceCount: null });
    // The effects above notice `paired` flip true and take it from here:
    // a full first pull, then the entire local backlog pushes up.
  }

  async function createFamily(label: string): Promise<boolean> {
    if (debugMode) return false;
    try {
      beginPairing(await transport.createFamily(label), label);
      // This phone owns the family's profile; make sure it can actually travel.
      stampProfileForSync();
      return true;
    } catch (error) {
      markFailed(error);
      showToast(OFFLINE_MESSAGE);
      return false;
    }
  }

  async function joinFamily(code: string, label: string): Promise<boolean> {
    if (debugMode) return false;
    try {
      beginPairing(await transport.joinFamily(code, label), label);
      return true;
    } catch (error) {
      markFailed(error);
      // The server's own copy is the calmest guidance for a bad/expired code.
      showToast(error instanceof transport.ApiError ? error.message : OFFLINE_MESSAGE);
      return false;
    }
  }

  async function createInvite(): Promise<transport.InviteResult | null> {
    const p = live.current.pairing;
    if (!p || debugMode) return null;
    try {
      return await transport.createInvite(p.token);
    } catch (error) {
      markFailed(error);
      if (!(error instanceof transport.PairingRevokedError)) showToast(OFFLINE_MESSAGE);
      return null;
    }
  }

  function leaveFamily() {
    // Local goodbye only — the API has no unregister endpoint; the family's
    // data stays on the server for the remaining devices.
    const l = live.current;
    window.clearTimeout(l.pushTimer);
    l.revoked = false;
    l.pushAgain = false;
    adoptPairing(null);
    setStatus({ phase: "idle", lastSyncAt: null, deviceCount: null });
  }

  return { pairing, status, createFamily, createInvite, joinFamily, leaveFamily };
}

export type FamilySync = ReturnType<typeof useFamilySync>;
