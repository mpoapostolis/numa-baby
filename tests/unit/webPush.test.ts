import { describe, expect, it, vi } from "vitest";
import { webcrypto as crypto } from "node:crypto";
import { buildPushPayload } from "@block65/webcrypto-web-push";
import { REMINDERS, dueAt, isPushEndpoint, saveSchedule, sendDue } from "../../worker/push";

// A push nobody can decrypt is a reminder that never rings, and the failure
// is silent — the push service accepts the bytes and the phone drops them.
// So the encryption is not taken on trust: the library encrypts, and the
// RECEIVING half is implemented here, straight from RFC 8291 and RFC 8188,
// with no code shared between the two. Two independent implementations that
// agree on a payload are two implementations that are almost certainly both
// right; one that quietly disagrees fails this test instead of failing a
// parent at 3am.

const b64url = (buffer: ArrayBuffer | Uint8Array) =>
  Buffer.from(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer))
    .toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const bytes = (...parts: Array<Uint8Array | number[]>): Uint8Array<ArrayBuffer> => {
  const flat = parts.flatMap((part) => Array.from(part));
  const out = new Uint8Array(new ArrayBuffer(flat.length));
  out.set(flat);
  return out;
};

const utf8 = (value: string) => new TextEncoder().encode(value);

/** HKDF, the two halves the web-push specs use directly. */
async function hmac(key: BufferSource, data: BufferSource): Promise<Uint8Array<ArrayBuffer>> {
  const imported = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", imported, data));
}
const extract = (salt: BufferSource, ikm: BufferSource) => hmac(salt, ikm);
const expand = async (prk: Uint8Array<ArrayBuffer>, info: Uint8Array<ArrayBuffer>, length: number) =>
  (await hmac(prk, bytes(info, [1]))).slice(0, length);

/** One user agent: an ECDH key pair and an auth secret, as a browser makes. */
async function makeSubscriber() {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const publicKey = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const auth = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  return { pair, publicKey, auth };
}

/** The phone's side of RFC 8291 §3.4, plus the RFC 8188 record framing. */
async function decrypt(body: Uint8Array<ArrayBuffer>, subscriber: Awaited<ReturnType<typeof makeSubscriber>>): Promise<string> {
  const salt = body.slice(0, 16);
  const idLength = body[20];
  const senderPublic = body.slice(21, 21 + idLength);
  const ciphertext = body.slice(21 + idLength);

  const sender = await crypto.subtle.importKey("raw", senderPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: sender }, subscriber.pair.privateKey, 256),
  ) as Uint8Array<ArrayBuffer>;

  // "WebPush: info" || 0x00 || ua public || as public
  const keyInfo = bytes(utf8("WebPush: info"), [0], subscriber.publicKey, senderPublic);
  const ikm = await expand(await extract(subscriber.auth, shared), keyInfo, 32);
  const prk = await extract(salt, ikm);
  const cek = await expand(prk, bytes(utf8("Content-Encoding: aes128gcm"), [0]), 16);
  const nonce = await expand(prk, bytes(utf8("Content-Encoding: nonce"), [0]), 12);

  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["decrypt"]);
  const padded = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce }, key, ciphertext));
  // The record ends with a delimiter (0x02 on the last record) and may carry
  // zero padding after it.
  let end = padded.length;
  while (end > 0 && padded[end - 1] === 0) end -= 1;
  return new TextDecoder().decode(padded.slice(0, Math.max(0, end - 1)));
}

async function makeVapid() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return {
    subject: "mailto:someone@example.com",
    publicKey: b64url(await crypto.subtle.exportKey("raw", pair.publicKey)),
    privateKey: jwk.d as string,
  };
}

describe("the push a phone actually receives", () => {
  it("decrypts back to the reminder that was sent", async () => {
    const subscriber = await makeSubscriber();
    const vapid = await makeVapid();
    const message = { title: REMINDERS.feed.title, body: REMINDERS.feed.body, tag: REMINDERS.feed.tag, url: "/" };

    const payload = await buildPushPayload(
      { data: message, options: { ttl: 1800, urgency: "high" } },
      {
        endpoint: "https://fcm.googleapis.com/fcm/send/abc",
        expirationTime: null,
        keys: { p256dh: b64url(subscriber.publicKey), auth: b64url(subscriber.auth) },
      },
      vapid,
    );

    expect(payload.headers["content-encoding"]).toBe("aes128gcm");
    expect(payload.headers.authorization).toMatch(/^vapid t=[\w-]+\.[\w-]+\.[\w-]+, k=[\w-]+$/);
    expect(payload.headers.ttl).toBe("1800");

    const received = await decrypt(new Uint8Array(payload.body), subscriber);
    expect(JSON.parse(received)).toEqual(message);
  });

  it("says nothing about the baby — the server has nothing to say", () => {
    const words = Object.values(REMINDERS).map((r) => `${r.title} ${r.body}`).join(" ");
    // No name, no figure, no "since". This shows on a lock screen other
    // people can see, and the server does not know any of it anyway.
    expect(words).not.toMatch(/\d/);
    expect(words.toLowerCase()).not.toMatch(/name|ago|hours since|ml|oz/);
  });
});

describe("what the endpoint will accept", () => {
  it("takes the real push services and nothing else", () => {
    for (const good of [
      "https://fcm.googleapis.com/fcm/send/abc123",
      "https://web.push.apple.com/QAbc",
      "https://updates.push.services.mozilla.com/wpush/v2/gAA",
      "https://par02p.notify.windows.com/w/?token=x",
    ]) {
      expect(isPushEndpoint(good), good).toBe(true);
    }
    // This Worker POSTs to whatever it stored, so anything else is a way to
    // make it fetch a URL of somebody else's choosing.
    for (const bad of [
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://evil.example/hook",
      "https://fcm.googleapis.com.evil.example/x",
      "https://127.0.0.1/admin",
      "https://push.apple.com.evil.test/x",
      "file:///etc/passwd",
      "",
    ]) {
      expect(isPushEndpoint(bad), bad).toBe(false);
    }
  });

  it("only accepts a real time, in the future, inside a week", () => {
    const now = Date.parse("2026-09-03T12:00:00.000Z");
    expect(dueAt("2026-09-03T15:00:00.000Z", now)).toBe("2026-09-03T15:00:00.000Z");
    expect(dueAt("2026-09-03T11:59:00.000Z", now)).toBeNull(); // already gone
    expect(dueAt("2026-09-30T12:00:00.000Z", now)).toBeNull(); // a wrong clock
    expect(dueAt("tomorrow", now)).toBeNull();
    expect(dueAt(1_759_000_000_000, now)).toBeNull();
    expect(dueAt(null, now)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// The signing identity.
//
// A VAPID pair is not a password, it is the NAME a phone learned this app by
// when it subscribed. Mint a second one and every subscribed phone goes
// silent — no error, no log, the push service just refuses a signature it has
// never seen. So the two things worth proving are that a deployment gets a
// pair without anybody performing a key ceremony, and that once it has one it
// can never accidentally get another.

type SecretRow = { payload: string; created_at: string };

/** The four statements vapidKeys() makes, and nothing else. */
function fakeDb(seed: SecretRow | null = null) {
  let row = seed;
  let inserts = 0;
  const client = {
    execute: async (query: unknown) => {
      const sql = typeof query === "string" ? query : (query as { sql: string }).sql;
      const args = typeof query === "string" ? [] : ((query as { args?: unknown[] }).args ?? []);
      if (sql.trimStart().startsWith("CREATE TABLE")) return { rows: [] };
      if (sql.includes("SELECT payload")) return { rows: row ? [{ ...row }] : [] };
      if (sql.includes("INSERT OR IGNORE INTO app_secrets")) {
        inserts += 1;
        // OR IGNORE: the first writer wins and the rest are no-ops.
        if (!row) row = { payload: String(args[0]), created_at: String(args[1]) };
        return { rows: [] };
      }
      throw new Error(`unexpected sql: ${sql}`);
    },
  };
  return {
    client: client as unknown as Parameters<typeof import("../../worker/push").vapidKeys>[0],
    peek: () => row,
    writes: () => inserts,
  };
}

/** A fresh copy of the module, because the pair is cached per isolate. */
async function freshPush() {
  vi.resetModules();
  return import("../../worker/push");
}

describe("the signing identity", () => {
  it("mints itself on first use, so a deployment needs no key ceremony", async () => {
    const push = await freshPush();
    const db = fakeDb();

    const keys = await push.vapidKeys(db.client, {});
    expect(keys).not.toBeNull();
    // The raw uncompressed P-256 point is 65 bytes; base64url of that is 87
    // characters, which is exactly what a browser expects to be handed.
    expect(keys?.publicKey).toMatch(/^[\w-]{87}$/);
    expect(keys?.privateKey).toMatch(/^[\w-]{43}$/);
    expect(db.peek()).not.toBeNull();
  });

  it("keeps the pair it minted, whatever else it is later told", async () => {
    const push = await freshPush();
    const db = fakeDb();

    const first = await push.vapidKeys(db.client, {});
    // A second isolate: same database, no cache, and now an environment that
    // disagrees. The stored pair has to win, because phones already know it.
    const second = await freshPush();
    const later = await second.vapidKeys(db.client, {
      VAPID_PUBLIC_KEY: "a-different-public-key",
      VAPID_PRIVATE_KEY: "a-different-private-key",
    });

    expect(later?.publicKey).toBe(first?.publicKey);
    expect(later?.privateKey).toBe(first?.privateKey);
    // And it did not write a second time.
    expect(db.writes()).toBe(1);
  });

  it("lets an operator hold the key instead, by seeding the first write", async () => {
    const push = await freshPush();
    const db = fakeDb();
    const mine = await makeVapid();

    const keys = await push.vapidKeys(db.client, {
      VAPID_PUBLIC_KEY: mine.publicKey,
      VAPID_PRIVATE_KEY: mine.privateKey,
      VAPID_SUBJECT: "mailto:ops@example.com",
    });

    expect(keys?.publicKey).toBe(mine.publicKey);
    expect(keys?.privateKey).toBe(mine.privateKey);
    expect(keys?.subject).toBe("mailto:ops@example.com");
  });

  it("has a subject even when nobody set one — an empty one is rejected downstream", async () => {
    const push = await freshPush();
    const keys = await push.vapidKeys(fakeDb().client, {});
    expect(keys?.subject).toMatch(/^https:\/\/|^mailto:/);
  });

  it("survives two isolates minting at the same moment", async () => {
    const db = fakeDb();
    const [a, b] = await Promise.all([
      freshPush().then((push) => push.vapidKeys(db.client, {})),
      freshPush().then((push) => push.vapidKeys(db.client, {})),
    ]);
    // Both generated a pair; only one row exists, and both must be signing
    // with it — a phone handed one public key and pushed with another is a
    // phone that never rings.
    expect(a?.publicKey).toBe(b?.publicKey);
  });

  it("shows the operator the identity and never the secret", async () => {
    const push = await freshPush();
    const db = fakeDb();
    expect(await push.storedVapid(db.client)).toBeNull(); // looking does not mint
    expect(db.peek()).toBeNull();

    const keys = await push.vapidKeys(db.client, {});
    const status = await push.storedVapid(db.client);
    expect(status?.publicKey).toBe(keys?.publicKey);
    expect(JSON.stringify(status)).not.toContain(keys?.privateKey ?? "never");
  });

  it("mints a pair the push library can actually sign with", async () => {
    // The real risk in generating a key ourselves is the EXPORT SHAPE: the
    // public key must be the raw point and the private key the JWK `d`, and
    // getting it wrong fails at 3am on somebody's phone rather than here.
    const push = await freshPush();
    const generated = await push.generateVapidKeys();
    const subscriber = await makeSubscriber();
    const message = { title: REMINDERS.diaper.title, body: REMINDERS.diaper.body, tag: REMINDERS.diaper.tag, url: "/" };

    const payload = await buildPushPayload(
      { data: message, options: { ttl: 1800, urgency: "high" } },
      {
        endpoint: "https://fcm.googleapis.com/fcm/send/abc",
        expirationTime: null,
        keys: { p256dh: b64url(subscriber.publicKey), auth: b64url(subscriber.auth) },
      },
      { subject: "https://numalog.app", ...generated },
    );

    // The key the push service is asked to check against is the one a phone
    // would have subscribed with.
    expect(payload.headers.authorization).toContain(`k=${generated.publicKey}`);
    expect(JSON.parse(await decrypt(new Uint8Array(payload.body), subscriber))).toEqual(message);
  });
});

// ---------------------------------------------------------------------------
// Losing a reminder silently.
//
// The phone stands its own timer down the moment the server says it holds the
// alarm (pushArmed in App.tsx). Everything below is a way the server could
// then fail to ring while the client still believes it is armed — which is
// worse than having no push at all, because the fallback is gone too.

describe("an alarm the server accepts is an alarm the server keeps", () => {
  type Row = Record<string, unknown>;

  function alarmDb() {
    const rows = new Map<string, Row>();
    // The signing pair has to actually persist here: without it vapidKeys
    // answers null, sendDue returns early, and every count in these tests is
    // quietly zero for the wrong reason.
    const secrets = new Map<string, Row>();
    const client = {
      execute: async (query: unknown) => {
        const sql = (typeof query === "string" ? query : (query as { sql: string }).sql).replace(/\s+/g, " ").trim();
        const args = typeof query === "string" ? [] : ((query as { args?: unknown[] }).args ?? []);
        if (sql.startsWith("CREATE") || sql.startsWith("ALTER")) return { rows: [] };
        if (sql.includes("SELECT payload, created_at FROM app_secrets")) {
          const row = secrets.get("vapid");
          return { rows: row ? [row] : [] };
        }
        if (sql.includes("INSERT OR IGNORE INTO app_secrets")) {
          if (!secrets.has("vapid")) secrets.set("vapid", { payload: String(args[0]), created_at: String(args[1]) });
          return { rows: [] };
        }
        if (sql.startsWith("INSERT INTO push_subscriptions")) {
          const [endpoint, p256dh, auth, feed, diaper, created, updated, family] = args as string[];
          const existing = rows.get(endpoint);
          rows.set(endpoint, {
            endpoint, p256dh, auth, feed_due_at: feed, diaper_due_at: diaper,
            created_at: existing?.created_at ?? created, updated_at: updated,
            failures: 0, family_id: family,
          });
          return { rows: [] };
        }
        if (sql.includes("FROM push_subscriptions WHERE feed_due_at")) {
          const [at, floor] = args as string[];
          const due: Row[] = [];
          for (const row of rows.values()) {
            for (const kind of ["feed", "diaper"] as const) {
              const value = row[`${kind}_due_at`] as string | null;
              if (value && value <= at && value > floor) due.push({ ...row, kind, due: value });
            }
          }
          return { rows: due.sort((a, b) => String(a.due).localeCompare(String(b.due))) };
        }
        if (sql.startsWith("UPDATE push_subscriptions SET failures = failures + 1")) {
          const row = rows.get(String(args[0]));
          if (row) row.failures = Number(row.failures) + 1;
          return { rows: [] };
        }
        if (sql.startsWith("UPDATE push_subscriptions SET failures = 0")) {
          const row = rows.get(String(args[0]));
          if (row) row.failures = 0;
          return { rows: [] };
        }
        if (sql.startsWith("UPDATE push_subscriptions SET feed_due_at = NULL")) {
          const row = rows.get(String(args[0]));
          if (row) row.feed_due_at = null;
          return { rows: [] };
        }
        if (sql.startsWith("UPDATE push_subscriptions SET diaper_due_at = NULL")) {
          const row = rows.get(String(args[0]));
          if (row) row.diaper_due_at = null;
          return { rows: [] };
        }
        if (sql.startsWith("DELETE FROM push_subscriptions")) {
          rows.delete(String(args[0]));
          return { rows: [] };
        }
        throw new Error(`unexpected sql: ${sql}`);
      },
      batch: async (statements: unknown[]) => {
        for (const statement of statements) await client.execute(statement);
        return [];
      },
    };
    return { client: client as never, rows };
  }

  /** A real subscriber, because encryption happens before the fetch and a
      placeholder key produces no send at all rather than a failed one. */
  async function subscriber() {
    const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
    return {
      endpoint: "https://fcm.googleapis.com/fcm/send/one",
      keys: {
        p256dh: b64url(await crypto.subtle.exportKey("raw", pair.publicKey)),
        auth: b64url(crypto.getRandomValues(new Uint8Array(16))),
      },
    };
  }

  it("survives a push service having a bad minute", async () => {
    const { client, rows } = alarmDb();
    const who = await subscriber();
    const now = Date.parse("2026-09-04T14:00:00.000Z");
    await saveSchedule(client, { ...who, feedDueAt: "2026-09-04T15:00:00.000Z" }, now);

    // One 500. This used to delete the alarm outright, and the phone had
    // already stood its own timer down — so the parent got nothing at all,
    // from a single transient upstream error.
    vi.stubGlobal("fetch", async () => ({ status: 500 }) as Response);
    const first = await sendDue(client, {}, Date.parse("2026-09-04T15:01:00.000Z"));
    expect(first.failed).toBe(1);
    expect(rows.get(who.endpoint)?.feed_due_at).toBe("2026-09-04T15:00:00.000Z");

    // Five minutes later the service is fine and the reminder still rings.
    vi.stubGlobal("fetch", async () => ({ status: 201 }) as Response);
    const second = await sendDue(client, {}, Date.parse("2026-09-04T15:06:00.000Z"));
    expect(second.sent).toBe(1);
    expect(rows.get(who.endpoint)?.feed_due_at).toBeNull();
    // And the earlier refusal is forgiven, so a phone that had one bad
    // afternoon is not one failure from being given up on weeks later.
    expect(rows.get(who.endpoint)?.failures).toBe(0);
  });

  it("does eventually stop ringing a bell that never works", async () => {
    const { client, rows } = alarmDb();
    const who = await subscriber();
    const now = Date.parse("2026-09-04T14:00:00.000Z");
    await saveSchedule(client, { ...who, feedDueAt: "2026-09-04T15:00:00.000Z" }, now);
    vi.stubGlobal("fetch", async () => ({ status: 500 }) as Response);

    let attempts = 0;
    for (let minute = 1; minute <= 30; minute += 5) {
      const result = await sendDue(client, {}, Date.parse(`2026-09-04T15:${String(minute).padStart(2, "0")}:00.000Z`));
      attempts += result.attempted;
    }
    // Retried, then given up on — not retried for ever, and not abandoned on
    // the first refusal either.
    expect(attempts).toBe(3);
    expect(rows.get(who.endpoint)?.feed_due_at).toBeNull();
  });

  it("refuses an alarm it is not going to keep, instead of answering ok", async () => {
    const { client, rows } = alarmDb();
    const who = await subscriber();
    const now = Date.parse("2026-09-04T12:00:00.000Z");

    // A phone whose clock runs behind computes a time already in the server's
    // past. Answering true here told the client "I hold it", the client stood
    // its timer down, and the reminder existed nowhere.
    expect(await saveSchedule(client, { ...who, feedDueAt: "2026-09-04T11:00:00.000Z" }, now)).toBe(false);
    // A time a decade out, from a clock the other way.
    expect(await saveSchedule(client, { ...who, feedDueAt: "2036-09-04T11:00:00.000Z" }, now)).toBe(false);
    // Turning both off is not a refusal — it is how a phone says "stop".
    expect(await saveSchedule(client, { ...who, feedDueAt: null, diaperDueAt: null }, now)).toBe(true);
    expect(rows.get(who.endpoint)?.feed_due_at).toBeNull();
  });

  it("lets go of a family the phone has left", async () => {
    const { client, rows } = alarmDb();
    const who = await subscriber();
    const now = Date.parse("2026-09-04T12:00:00.000Z");
    await saveSchedule(client, { ...who, feedDueAt: "2026-09-04T15:00:00.000Z" }, now, "alpha-000");
    expect(rows.get(who.endpoint)?.family_id).toBe("alpha-000");

    // Unpaired: the app stops sending the token, so the next schedule write
    // arrives unauthenticated. It must not stay in the household — a phone
    // that left kept receiving that family's notes for ever.
    await saveSchedule(client, { ...who, feedDueAt: "2026-09-04T16:00:00.000Z" }, now, null);
    expect(rows.get(who.endpoint)?.family_id).toBeNull();
  });
});
