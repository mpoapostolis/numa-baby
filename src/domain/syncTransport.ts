// Thin typed fetch wrappers for the five Family Sync endpoints (worker/index.ts).
// Module scope, no React. Same-origin /api/* — no CORS, no base URL.
//
// Error contract: HTTP 401 becomes a typed PairingRevokedError (the token is
// no longer honoured — the orchestrator flips to its "revoked" state). Any
// other non-OK response throws an ApiError carrying the server's calm message
// when one exists. Network failures propagate as fetch's own TypeError.

export class PairingRevokedError extends Error {
  constructor() {
    super("This device is no longer paired.");
    this.name = "PairingRevokedError";
  }
}

// Non-OK, non-401: the message is the server's own user-facing copy.
export class ApiError extends Error {
  readonly status: number;
  constructor(message: string, status = 0) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type PairResult = { familyId: string; token: string; deviceId: string };
export type InviteResult = { code: string; expiresAt: string };
export type PulledRow = { id: string; payload: unknown; updatedAt: string; deleted: boolean };
export type PullResult = {
  activities: PulledRow[];
  profile: unknown;
  profileUpdatedAt: string | null;
  deviceCount: number;
  serverTime: string;
};
export type PushRow = { id: string; payload: unknown; updatedAt: string; deleted: boolean };
export type PushBody = {
  activities: PushRow[];
  profile?: unknown;
  profileUpdatedAt?: string;
  deviceId: string;
};
export type PushResult = { accepted: number; serverTime: string };

async function request<T>(path: string, init: RequestInit, token?: string): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(path, { ...init, headers });
  if (response.status === 401) throw new PairingRevokedError();
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  if (!response.ok) throw new ApiError(body?.error || "Sync request failed", response.status);
  if (!body) throw new ApiError("Sync request failed");
  return body as T;
}

export function createFamily(deviceLabel: string): Promise<PairResult> {
  return request("/api/family/create", { method: "POST", body: JSON.stringify({ deviceLabel }) });
}

export function createInvite(token: string): Promise<InviteResult> {
  return request("/api/family/invite", { method: "POST" }, token);
}

export function joinFamily(code: string, deviceLabel: string): Promise<PairResult> {
  return request("/api/family/join", { method: "POST", body: JSON.stringify({ code, deviceLabel }) });
}

// --- Google recovery -------------------------------------------------------
// The credential is Google's signed "this person owns that address"; nothing
// from the log travels the other way. See worker/googleAuth.ts for the vows.

export function googleLink(token: string, credential: string): Promise<{ email: string }> {
  return request("/api/family/google-link", { method: "POST", body: JSON.stringify({ credential }) }, token);
}

export function googleUnlink(token: string): Promise<{ ok: true }> {
  return request("/api/family/google-unlink", { method: "POST" }, token);
}

export function recoveryStatus(token: string): Promise<{ email: string | null }> {
  return request("/api/family/recovery-status", { method: "GET" }, token);
}

export function googleRecover(credential: string, deviceLabel: string): Promise<PairResult> {
  return request("/api/family/google-recover", { method: "POST", body: JSON.stringify({ credential, deviceLabel }) });
}

export function emailLink(token: string, email: string): Promise<{ sent: true }> {
  return request("/api/family/email-link", { method: "POST", body: JSON.stringify({ email }) }, token);
}

export function emailRecoverRequest(email: string): Promise<{ sent: true }> {
  return request("/api/family/email-recover-request", { method: "POST", body: JSON.stringify({ email }) });
}

/** Redeeming a link token: a 'confirm' tap returns {confirmed}, a recovery tap a full pairing. */
export function emailRedeem(
  token: string,
  deviceLabel: string,
): Promise<(PairResult & { email: string }) | { confirmed: true; email: string }> {
  return request("/api/family/email-redeem", { method: "POST", body: JSON.stringify({ token, deviceLabel }) });
}

export function pullSince(token: string, since: string, deviceId: string): Promise<PullResult> {
  const query = `since=${encodeURIComponent(since)}&device=${encodeURIComponent(deviceId)}`;
  return request(`/api/sync/pull?${query}`, { method: "GET" }, token);
}

export function pushBatch(token: string, body: PushBody): Promise<PushResult> {
  return request("/api/sync/push", { method: "POST", body: JSON.stringify(body) }, token);
}

export type FamilyDevice = {
  id: string;
  label: string;
  joined: string;
  last_seen: string | null;
  /** 0 for phones paired before revocation existed — they cannot be picked off individually. */
  revocable: number;
  isThisDevice: boolean;
};

/** Hand this phone's own key back, so the server stops accepting it. */
export function leaveFamily(token: string): Promise<{ ok: true }> {
  return request("/api/family/leave", { method: "POST" }, token);
}

export function listDevices(token: string): Promise<{ devices: FamilyDevice[] }> {
  return request("/api/family/devices", { method: "GET" }, token);
}

/** Remove one phone, or — for a phone that is genuinely lost — every other one. */
export function revokeDevice(
  token: string,
  target: { deviceId: string } | { all: true },
): Promise<{ ok: true }> {
  return request("/api/family/devices/revoke", { method: "POST", body: JSON.stringify(target) }, token);
}
