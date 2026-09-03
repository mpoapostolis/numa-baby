import { describe, expect, it } from "vitest";
import { webcrypto as crypto } from "node:crypto";
import { buildPushPayload } from "@block65/webcrypto-web-push";
import { REMINDERS, dueAt, isPushEndpoint } from "../../worker/push";

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
