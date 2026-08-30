import { useEffect, useRef, useState } from "react";
import {
  FamilyPairing,
  clearPairing,
  loadPairing,
  rewoundPushCursor,
  savePairing,
} from "../domain/familyPairing";
import { saveAuthHint } from "../domain/authHint";
import { selectPushDelta } from "../domain/syncCursor";
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
  backfillVersion: number;
  /** Strip the local profile claim before a join — the family's name wins. */
  demoteProfileForJoin: () => void;
  /** Drop local entries AND the profile claim — chosen adoption of the cloud copy. */
  dropLocalForAdoption: () => void;
  /** Oldest updatedAt among the last merge's incoming entries ("" = none). */
  backfillOldestAt: string;
  readPersisted: () => { activities: Activity[]; profile: Profile; profileUpdatedAt?: string };
  /** Makes an unstamped legacy profile syncable. Only ever called on create. */
  stampProfileForSync: () => void;
  mergeRemote: (remote: Activity[], profile?: Profile, profileUpdatedAt?: string) => { added: number; updated: number; persisted: boolean };
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
  // Set when entries have been merged in that this device did not write, and
  // cleared only once a push has carried the whole log across. It survives a
  // failed push on purpose: a restore that never reached the partner must be
  // retried, not forgotten.
  backfilled: boolean;
  // Raised by markFailed, read (and cleared) only by syncNow — the one
  // caller that needs a truthful yes/no rather than a status enum.
  lastSyncFailed: boolean;
};

export function useFamilySync({ debugMode, bootState, persistVersion, backfillVersion, backfillOldestAt, readPersisted, stampProfileForSync, demoteProfileForJoin, dropLocalForAdoption, mergeRemote, showToast }: FamilySyncOptions) {
  const [pairing, setPairing] = useState<FamilyPairing | null>(() => (debugMode ? null : loadPairing()));
  const [status, setStatus] = useState<SyncStatus>(() => ({
    phase: "idle",
    lastSyncAt: pairing && pairing.lastSyncAt ? pairing.lastSyncAt : null,
    deviceCount: null,
  }));
  // Mutable sync internals, mirroring persistedStateRef's pattern: async code
  // reads pairing and in-flight flags from here, never from a render snapshot.
  // Only read inside effects and callbacks — never during render.
  const live = useRef<LiveSync>({ pairing, pushTimer: 0, pullBusy: false, pushBusy: false, pushAgain: false, revoked: false, backfilled: false, lastSyncFailed: false });

  function adoptPairing(next: FamilyPairing | null) {
    live.current.pairing = next;
    setPairing(next);
    if (next) savePairing(next);
    else clearPairing();
  }

  function markFailed(error: unknown) {
    live.current.lastSyncFailed = true;
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
      let allPersisted = true;
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
        const merged = mergeRemote(rows, profile, stamp);
        added += merged.added;
        // A merge that could not persist (storage blocked) must not let the
        // cursor advance past rows this device never actually kept.
        if (rows.length && merged.persisted === false) allPersisted = false;
        // Keyset pagination for oversized backlogs (the first pull after a
        // join): pages are capped at 2000 rows, receivedAt ascending — the
        // server's arrival clock, so a restored backup's months-old entries
        // still page through. Step the cursor 1ms behind the last row so
        // boundary ties re-fetch instead of skip; the idempotent merge makes
        // the repeats free, and the guard bounds the pathological page.
        const last = Array.isArray(page.activities) ? page.activities[page.activities.length - 1] : undefined;
        const lastMs = last ? new Date(last.receivedAt ?? last.updatedAt).getTime() : NaN;
        if (Number.isFinite(lastMs)) since = new Date(lastMs - 1).toISOString();
        guard += 1;
      } while (Array.isArray(page.activities) && page.activities.length >= PAGE && guard < 20);
      const cur = live.current.pairing;
      // Left (or re-paired) while the pull was in flight — drop the result.
      if (!cur || cur.token !== before.token) return;
      if (allPersisted) adoptPairing({ ...cur, lastSyncAt: page.serverTime });
      setStatus({
        phase: "idle",
        lastSyncAt: allPersisted ? page.serverTime : cur.lastSyncAt || null,
        deviceCount: page.deviceCount,
      });
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
    // Delta selection: everything written since the last successful push —
    // unless a backup has been merged in, in which case the whole log goes,
    // because imported entries are dated when they were first logged and sit
    // below the cursor. See domain/syncCursor.ts for why that is the safe
    // direction to be wrong in.
    const backfilled = l.backfilled;
    const delta = selectPushDelta(activities, before.lastPushedAt, backfilled);
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
      if (cur.lastPushedAt !== before.lastPushedAt) {
        // A backup merged in MID-FLIGHT and rewound the cursor underneath
        // this push. Advancing to maxStamp now would bury the rewind and
        // strand the merged entries below the cursor again — keep the
        // rewound value and run once more from there instead.
        l.pushAgain = true;
      } else {
        // The whole log is across; the cursor can be trusted again.
        if (backfilled) live.current.backfilled = false;
        adoptPairing({
          ...cur,
          lastPushedAt: maxStamp,
          lastPushedProfileAt: sendProfile && profileUpdatedAt ? profileUpdatedAt : cur.lastPushedProfileAt,
        });
      }
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

  /** The worried-parent button: force a full pull and push RIGHT NOW and
      answer honestly whether both landed. "Is it synced?" becomes a tap
      with a result instead of an anxiety. */
  async function syncNow(): Promise<boolean> {
    const l = live.current;
    if (!l.pairing || debugMode || l.revoked) return false;
    l.lastSyncFailed = false;
    await runPull(true);
    await runPush();
    return !l.lastSyncFailed && !l.revoked;
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

  // BACKFILL trigger: a merged backup bumps backfillVersion. The flag is
  // raised here rather than inside the merge because the store cannot reach
  // this hook — it is built first, and hands its counters forward.
  //
  // Mount does not count: a bare `useState(0)` on a fresh render is not an
  // import, and treating it as one would resend the entire log on every boot.
  const seenBackfill = useRef(backfillVersion);
  useEffect(() => {
    if (backfillVersion === seenBackfill.current) return;
    seenBackfill.current = backfillVersion;
    live.current.backfilled = true;
    // THE CHA FIX. Merged entries keep their original updatedAt, which sits
    // behind an advanced push cursor — so the pull side widened (backfilled
    // above) while the push side silently skipped everything that had just
    // arrived. Rewinding the cursor past the oldest incoming stamp makes the
    // next push re-send from there; over-sending is safe (idempotent, LWW).
    const p = live.current.pairing;
    if (p) {
      const rewound = rewoundPushCursor(p.lastPushedAt, backfillOldestAt);
      // The pull cursor resets alongside the push rewind: an imported backup
      // can resurrect an entry whose deletion this device swept long ago
      // (tombstones are pruned locally after 90 days), and only a FULL pull
      // brings the family's tombstone back down to re-bury it. Re-pulling
      // the whole log is idempotent and a family's log is small — the cost
      // is a few reads, the alternative is a ghost entry nobody can kill.
      adoptPairing({ ...p, lastPushedAt: rewound ?? p.lastPushedAt, lastSyncAt: "" });
      if (bootState === "ready") window.setTimeout(() => void runPull(true), 0);
    }
    // No schedulePush here: the same merge persists, so persistVersion bumps
    // alongside this and the effect below already queues the push.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backfillVersion]);

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
    // a full first pull, then the entire local backlog pushes up. But a
    // SWITCH (paired -> paired, new family) never flips that flag — pull
    // right away, or "your log is on its way" would mean "in a minute".
    // pullBusy dedupes the double-fire when the effect runs too.
    if (bootState === "ready") window.setTimeout(() => void runPull(true), 0);
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
      // Proof before mutation: the profile claim is only demoted once the
      // join actually succeeded — a bad code must change nothing local.
      const minted = await transport.joinFamily(code, label);
      demoteProfileForJoin();
      beginPairing(minted, label);
      return true;
    } catch (error) {
      markFailed(error);
      // The server's own copy is the calmest guidance for a bad/expired code.
      showToast(error instanceof transport.ApiError ? error.message : OFFLINE_MESSAGE);
      return false;
    }
  }

  // Google recovery: the same three verbs the invite path has, plus the
  // disaster door. All of them ride the existing pairing machinery — a
  // recovered device IS a joined device.
  /** "elsewhere" = the account already guards a DIFFERENT family; the UI
      offers to switch this device to it rather than parroting a 409. */
  async function googleProtect(credential: string): Promise<string | "elsewhere" | null> {
    const p = live.current.pairing;
    if (!p || debugMode) return null;
    try {
      const { email } = await transport.googleLink(p.token, credential);
      saveAuthHint({ method: "google", email });
      return email;
    } catch (error) {
      if (error instanceof transport.ApiError && error.status === 409) return "elsewhere";
      markFailed(error);
      showToast(error instanceof transport.ApiError ? error.message : OFFLINE_MESSAGE);
      return null;
    }
  }

  async function googleUnprotect(): Promise<boolean> {
    const p = live.current.pairing;
    if (!p || debugMode) return false;
    try {
      await transport.googleUnlink(p.token);
      return true;
    } catch (error) {
      markFailed(error);
      return false;
    }
  }

  async function recoveryEmail(): Promise<string | null> {
    const p = live.current.pairing;
    if (!p || debugMode) return null;
    try {
      return (await transport.recoveryStatus(p.token)).email;
    } catch {
      // Status is decoration; a failed read must not mark the pairing bad.
      return null;
    }
  }

  /** How many live entries this device holds — the UI asks before a join. */
  function localEntryCount(): number {
    return readPersisted().activities.filter((a) => !a.deleted).length;
  }

  /** "Does this account guard a log?" — no side effects, for gating the
      merge-or-adopt dialog. Null means the question itself failed (offline,
      Google hiccup) and the failure was already toasted. */
  async function googleProbe(credential: string): Promise<boolean | null> {
    if (debugMode) return null;
    try {
      return (await transport.googleProbe(credential)).guarded;
    } catch (error) {
      markFailed(error);
      showToast(error instanceof transport.ApiError ? error.message : OFFLINE_MESSAGE);
      return null;
    }
  }

  /**
   * The continue-with-Google front door — for the protect surface, the
   * restore surface, and the switch-families dialog alike. If this account
   * guards a family, "continue" means JOIN IT and let the latest data
   * follow; the 404 is an answer here ("none"), never an error to toast.
   *
   * Proof strictly before mutation: NOTHING local changes until the server
   * has minted the new key. Only then does the old pairing (if any) get
   * left, the local entries get dropped (when adoption was chosen in a real
   * dialog) or the profile claim demoted (so the family's identity wins),
   * and the new pairing begin. A failure anywhere leaves the device exactly
   * as it was — same family, same entries, same profile.
   */
  async function googleContinue(
    credential: string,
    label: string,
    options: { discardLocal?: boolean } = {},
  ): Promise<"joined" | "none" | "failed"> {
    if (debugMode) return "failed";
    try {
      const minted = await transport.googleRecover(credential, label);
      const old = live.current.pairing;
      if (old) {
        // Switching families: hand the old key back, fire-and-forget — the
        // new pairing must not be blocked by the old server row.
        void transport.leaveFamily(old.token).catch(() => undefined);
        window.clearTimeout(live.current.pushTimer);
      }
      if (options.discardLocal) dropLocalForAdoption();
      else demoteProfileForJoin();
      beginPairing(minted, label);
      saveAuthHint({ method: "google" });
      // The parent must SEE the rescue working, not deduce it from entries
      // trickling in. The pull that follows fills the screen underneath.
      showToast("Welcome back — your log is on its way.");
      return "joined";
    } catch (error) {
      if (error instanceof transport.ApiError && error.status === 404) return "none";
      markFailed(error);
      showToast(error instanceof transport.ApiError ? error.message : OFFLINE_MESSAGE);
      return "failed";
    }
  }

  async function emailProtect(email: string): Promise<boolean> {
    const p = live.current.pairing;
    if (!p || debugMode) return false;
    try {
      await transport.emailLink(p.token, email);
      saveAuthHint({ method: "email", email });
      return true;
    } catch (error) {
      markFailed(error);
      showToast(error instanceof transport.ApiError ? error.message : OFFLINE_MESSAGE);
      return false;
    }
  }

  async function emailRedeem(
    token: string,
    label: string,
    options: { discardLocal?: boolean } = {},
  ): Promise<"confirmed" | "recovered" | null> {
    if (debugMode) return null;
    try {
      // Proof before mutation, same vow as googleContinue: the token must
      // redeem before anything local is dropped or demoted.
      const outcome = await transport.emailRedeem(token, label);
      // The hint is saved only when this device JOINS. A confirm tap can
      // land on any device where the inbox happens to be open — a bystander
      // phone must not inherit a "welcome back" identity from it. The phone
      // that asked for the link saved its own hint when it sent it.
      if ("confirmed" in outcome) return "confirmed";
      saveAuthHint({ method: "email", email: outcome.email });
      if (options.discardLocal) dropLocalForAdoption();
      else demoteProfileForJoin();
      beginPairing(outcome, label);
      showToast("Welcome back — your log is on its way.");
      return "recovered";
    } catch (error) {
      markFailed(error);
      showToast(error instanceof transport.ApiError ? error.message : OFFLINE_MESSAGE);
      return null;
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
    // Hand the key back first, then forget locally. Fire-and-forget on
    // purpose: if the network is down, the local goodbye must still happen —
    // a parent tapping "leave" should never be blocked by connectivity. The
    // stale token is then cleared by the other phone's "sign out all".
    // Read the LIVE pairing, not the render snapshot: a rollback right after
    // createFamily happens inside one tick, before any re-render.
    const current = live.current.pairing;
    if (current) void transport.leaveFamily(current.token).catch(() => undefined);

    const l = live.current;
    window.clearTimeout(l.pushTimer);
    l.revoked = false;
    l.pushAgain = false;
    adoptPairing(null);
    setStatus({ phase: "idle", lastSyncAt: null, deviceCount: null });
  }

  /** The family's phones, for the revoke list. Null when not paired. */
  async function listDevices() {
    if (!pairing) return null;
    try {
      return (await transport.listDevices(pairing.token)).devices;
    } catch {
      return null;
    }
  }

  async function revokeDevice(target: { deviceId: string } | { all: true }) {
    if (!pairing) return false;
    try {
      await transport.revokeDevice(pairing.token, target);
      return true;
    } catch {
      showToast("Could not remove that phone — try again when you have signal.");
      return false;
    }
  }

  return {
    pairing,
    status,
    createFamily,
    createInvite,
    joinFamily,
    syncNow,
    googleProtect,
    googleUnprotect,
    googleProbe,
    googleContinue,
    localEntryCount,
    emailProtect,
    emailRedeem,
    recoveryEmail,
    leaveFamily,
    listDevices,
    revokeDevice,
  };
}

export type FamilySync = ReturnType<typeof useFamilySync>;
