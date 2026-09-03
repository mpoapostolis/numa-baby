// Generates the one key pair the push notifications need.
//
//   node scripts/vapid-keys.mjs
//
// VAPID is how a push service knows a message really came from this app: the
// public key is handed to the browser when it subscribes, the private key
// signs every send. They are a plain P-256 pair — no account, no vendor, no
// fee. Generate once, keep for ever; changing them invalidates every
// subscription in the wild, so this script never writes them anywhere and
// prints them exactly once.
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
unsubscribes every phone that ever said yes.

  PUBLIC  (safe to publish; the browser is given it when it subscribes)
  ${publicKey}

  PRIVATE (a secret: it signs every push this app ever sends)
  ${d}

Set them on the Worker:

  npx wrangler secret put VAPID_PRIVATE_KEY     # paste the private value
  npx wrangler secret put VAPID_PUBLIC_KEY      # paste the public value
  npx wrangler secret put VAPID_SUBJECT         # mailto:you@example.com

VAPID_SUBJECT is how a push service reaches you if this app ever floods it.
An address you actually read.
`);
