// Family pairing persistence. The pairing record — including the bearer token
// that authenticates this device to /api/* — lives under its OWN localStorage
// key, never inside the numa-baby-v1 data blob.
//
// Token isolation contract: every path that lets data LEAVE this device reads
// only the data blob slices, so keeping the token out of that blob keeps it
// out of every export:
//   - persistSnapshot (useTrackerStore) writes {activities, profile, nightMode,
//     reminders, onboardingComplete, profileUpdatedAt} to numa-baby-v1 — no
//     pairing fields exist in that scope.
//   - buildExportFile / exportData / sharePartner serialize the same slices
//     from persistedStateRef — they never touch this module or its key.
//   - sync pushes send activities + profile only; the token travels solely in
//     the Authorization header.
// A backup file or shared partner payload therefore can never contain the
// token, and importing someone else's backup can never re-pair a device.

export type FamilyPairing = {
  familyId: string;
  token: string;
  deviceId: string;
  deviceLabel: string;
  // Cursors. lastSyncAt: server clock after the last successful pull (the next
  // pull's `since`, minus an overlap window). lastPushedAt: newest local
  // activityUpdatedAt this device has successfully uploaded, clamped to the
  // local clock so a partner's skewed stamp can never freeze future pushes.
  // lastPushedProfileAt: the profile stamp last uploaded, so profile-only
  // saves still trigger exactly one push.
  lastSyncAt: string;
  lastPushedAt: string;
  lastPushedProfileAt: string;
};

export const FAMILY_KEY = "numa-baby-family-v1";

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

// Tolerant load: a corrupt or partial record (old schema, manual edits) yields
// null — the app simply behaves as unpaired, it never crashes on boot.
export function loadPairing(): FamilyPairing | null {
  try {
    const raw = window.localStorage.getItem(FAMILY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== "object") return null;
    const familyId = asString(parsed.familyId);
    const token = asString(parsed.token);
    const deviceId = asString(parsed.deviceId);
    if (!familyId || !token || !deviceId) return null;
    return {
      familyId,
      token,
      deviceId,
      deviceLabel: asString(parsed.deviceLabel),
      lastSyncAt: asString(parsed.lastSyncAt),
      lastPushedAt: asString(parsed.lastPushedAt),
      lastPushedProfileAt: asString(parsed.lastPushedProfileAt),
    };
  } catch {
    return null;
  }
}

export function savePairing(pairing: FamilyPairing): boolean {
  try {
    window.localStorage.setItem(FAMILY_KEY, JSON.stringify(pairing));
    return true;
  } catch {
    // Storage blocked: pairing survives in memory for this session only.
    return false;
  }
}

export function clearPairing(): void {
  try {
    window.localStorage.removeItem(FAMILY_KEY);
  } catch {
    // Storage blocked — nothing readable to clear either.
  }
}

/**
 * The link a QR invite carries. The origin is passed in — callers hand it
 * `window.location.origin`, so a code scanned from the deployed site opens the
 * deployed site and one scanned in dev opens dev. The code rides in the hash,
 * never the query string: a hash is never sent to the server, so the invite
 * cannot land in an access log.
 */
export function inviteLink(origin: string, code: string) {
  return `${origin}/#join=${code}`;
}

/** The one place the join-code shape is defined; App and the tests share it. */
export const JOIN_CODE_PATTERN = /(?:^|[#&])join=(\d{6})\b/;
