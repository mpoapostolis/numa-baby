// Generates a VAPID pair for the push notifications.
//
//   node scripts/vapid-keys.mjs
//
// YOU PROBABLY DO NOT NEED THIS. The Worker mints its own pair the first time
// a browser asks for one and keeps it in `app_secrets`, so a deployment has
// working reminders with nothing but `npm run deploy`.
//
// This script is for the one case where that is not what you want: when you
// would rather hold the key yourself than have it live in the database. Set
// the two secrets below BEFORE the first phone subscribes and they seed that
// first write; set them afterwards and nothing happens, because by then
// phones are already answering to the pair that is stored.
//
// VAPID is how a push service knows a message really came from this app: the
// public key is handed to the browser when it subscribes, the private key
// signs every send. A plain P-256 pair — no account, no vendor, no fee.
//
// Keep whichever pair you end up with for ever. Changing it invalidates every
// subscription in the wild, silently, which is why this script never writes
// anywhere and prints exactly once.
//
// The private key is a SECRET. Set it with `wrangler secret put`, never in
// wrangler.jsonc, never in the repo.

import { webcrypto as crypto } from "node:crypto";

const b64url = (buffer) =>
  Buffer.from(buffer).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
// The public key travels as the uncompressed 65-byte point the Push API wants.
const publicKey = b64url(await crypto.subtle.exportKey("raw", pair.publicKey));
// The private key travels as the JWK "d" parameter, which is what the signing
// side re-imports.
const { d } = await crypto.subtle.exportKey("jwk", pair.privateKey);

console.log(`
Two values. Keep them for the life of the app — changing them silently
unsubscribes every phone that ever said yes. Only useful BEFORE the first
phone subscribes; after that the Worker is already using the pair it stored.

  PUBLIC  (safe to publish; the browser is given it when it subscribes)
  ${publicKey}

  PRIVATE (a secret: it signs every push this app ever sends)
  ${d}

Set them on the Worker:

  npx wrangler secret put VAPID_PRIVATE_KEY     # paste the private value
  npx wrangler secret put VAPID_PUBLIC_KEY      # paste the public value
  npx wrangler secret put VAPID_SUBJECT         # mailto:you@example.com

VAPID_SUBJECT is how a push service reaches you if this app ever floods it.
An address you actually read. It is the one of the three that is safe to
change later, and it works on its own — set it without the keys and the
Worker will still mint and keep its own pair.
`);
