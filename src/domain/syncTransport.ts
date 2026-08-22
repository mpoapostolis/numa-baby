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
  constructor(message: string) {
    super(message);
    this.name = "ApiError";
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
  if (!response.ok) throw new ApiError(body?.error || "Sync request failed");
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

export function pullSince(token: string, since: string, deviceId: string): Promise<PullResult> {
  const query = `since=${encodeURIComponent(since)}&device=${encodeURIComponent(deviceId)}`;
  return request(`/api/sync/pull?${query}`, { method: "GET" }, token);
}

export function pushBatch(token: string, body: PushBody): Promise<PushResult> {
  return request("/api/sync/push", { method: "POST", body: JSON.stringify(body) }, token);
}
