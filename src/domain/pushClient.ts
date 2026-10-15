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

/** Per reminder: a time is the next ring, null is "this one is off", and
    left out is "no new time — keep what you have". */
export type Schedule = { feedDueAt?: string | null; diaperDueAt?: string | null };

/**
 * What to tell the server, from the two times this phone worked out (null:
 * that reminder is off, or there is nothing to count from yet).
 *
 * A time already past is LEFT OUT. The server refuses a past time, and with
 * it the whole request — so one overdue nappy reminder used to keep a stale
 * feed alarm ringing and throw the new one away. It is not sent as null
 * either: an overdue reminder has either rung already or is about to on the
 * server's next pass, and null would cancel that.
 */
export function scheduleFor(times: { feed: number | null; diaper: number | null }, now: number): Schedule {
  // More than a week out is refused the same way (worker/push.ts dueAt) — a
  // feed logged while this phone's clock ran fast lands there — so it is
  // left out too, rather than costing the other reminder its alarm.
  const due = (at: number | null) =>
    at === null ? null : at > now && at <= now + SERVER_HORIZON_MS ? new Date(at).toISOString() : undefined;
  return { feedDueAt: due(times.feed), diaperDueAt: due(times.diaper) };
}

/** How far ahead the server stores an alarm (worker/push.ts dueAt). */
const SERVER_HORIZON_MS = 7 * 86_400_000;

/**
 * Tell the server when to ring, and nothing else. Returns false when there is
 * nothing to tell it with — the caller keeps its own timer either way.
 *
 * A paired phone passes its sync token so the server can record WHICH family
 * this alarm clock belongs to — the one thing here that is about who, and
 * the reason the operator can send a note to one family instead of everyone.
 * It is sent as a bearer token rather than an id in the body precisely so
 * that nobody can claim to be a family they are not. An unpaired phone sends
 * nothing and stays anonymous, which is still the normal case.
 */
export async function sendSchedule(schedule: Schedule, token?: string): Promise<boolean> {
  const subscription = await ensureSubscription();
  if (!subscription) return false;
  const json = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return false;
  return fetch(SCHEDULE_URL, {
    method: "POST",
    headers: token
      ? { "content-type": "application/json", authorization: `Bearer ${token}` }
      : { "content-type": "application/json" },
    // keepalive: the schedule is usually written as the app is being closed,
    // which is exactly the moment a plain fetch is abandoned.
    keepalive: true,
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      // A left-out time stays out of the JSON, which is how "keep" is said.
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
