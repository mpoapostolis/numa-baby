// Asking the push service to ring this phone.
//
// The half of the reminder that survives the app being closed. The other
// half — a setTimeout while the app is open — stays exactly where it was:
// it is instant, needs no network, and carries the same notification tag, so
// the two can never show up as two notifications.
//
// What leaves this phone is a push endpoint, its two keys, and up to two
// future timestamps. Never a name, never an entry, never how long since the
// last feed. The server is an alarm clock, not a witness.

const KEY_URL = "/api/push/key";
const SCHEDULE_URL = "/api/push/schedule";
const OFF_URL = "/api/push/off";

/** The VAPID public key travels as base64url; the Push API wants bytes. */
function keyBytes(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  return navigator.serviceWorker.ready.catch(() => null);
}

/**
 * The phone's current subscription, creating one if this is the first time.
 * Null when push is unavailable, permission was refused, or the deployment
 * has no VAPID key — every one of which is a reason to fall back silently to
 * the in-page timer rather than to complain.
 */
export async function ensureSubscription(): Promise<PushSubscription | null> {
  const registered = await registration();
  if (!registered) return null;
  const existing = await registered.pushManager.getSubscription().catch(() => null);
  if (existing) return existing;
  const key = await fetch(KEY_URL)
    .then((response) => (response.ok ? (response.json() as Promise<{ key?: string } | null>) : null))
    .then((body) => body?.key ?? null)
    .catch(() => null);
  if (!key) return null;
  return registered.pushManager
    .subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) })
    .catch(() => null);
}

export type Schedule = { feedDueAt: string | null; diaperDueAt: string | null };

/**
 * Tell the server when to ring, and nothing else. Returns false when there is
 * nothing to tell it with — the caller keeps its own timer either way.
 */
export async function sendSchedule(schedule: Schedule): Promise<boolean> {
  const subscription = await ensureSubscription();
  if (!subscription) return false;
  const json = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return false;
  return fetch(SCHEDULE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // keepalive: the schedule is usually written as the app is being closed,
    // which is exactly the moment a plain fetch is abandoned.
    keepalive: true,
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      feedDueAt: schedule.feedDueAt,
      diaperDueAt: schedule.diaperDueAt,
    }),
  })
    .then((response) => response.ok)
    .catch(() => false);
}

/** Reminders turned off, or permission withdrawn: stop the server ringing. */
export async function stopPush(): Promise<void> {
  const registered = await registration();
  const subscription = await registered?.pushManager.getSubscription().catch(() => null);
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch(() => undefined);
  await fetch(OFF_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ endpoint }),
  }).catch(() => undefined);
}
