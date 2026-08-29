// Verifying "Continue with Google" credentials — the one file where a
// mistake hands a family's log to a stranger, so it does nothing clever.
//
// The client sends the ID token Google's button produced. We verify it the
// boring, specified way: signature against Google's published keys (RS256,
// JWKS at the well-known URL, cached), issuer, audience, expiry, and
// email_verified. Nothing from the log ever travels to Google; the token is
// Google vouching "this person owns that address", and that vouch is all we
// keep — as an email bound to a family, so a lost phone stops being a lost
// history.

const JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const ISSUERS = new Set(["https://accounts.google.com", "accounts.google.com"]);

type GoogleIdentity = {
  /** Google's stable account id — survives an email change. */
  sub: string;
  /** The verified address, lowercased. */
  email: string;
};

type Jwk = { kid: string; n: string; e: string; kty: string; alg?: string };

// Keys rotate rarely; a Worker isolate lives minutes. One fetch per isolate
// is plenty, and a kid miss refreshes once in case a rotation just happened.
let cachedKeys: Jwk[] | null = null;

async function googleKeys(forceFresh: boolean): Promise<Jwk[]> {
  if (!forceFresh && cachedKeys) return cachedKeys;
  const res = await fetch(JWKS_URL);
  if (!res.ok) throw new Error("Google's keys are unreachable");
  const body = (await res.json()) as { keys?: Jwk[] };
  cachedKeys = (body.keys ?? []).filter((key) => key.kty === "RSA");
  return cachedKeys;
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const raw = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function decodeSegment(segment: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(fromBase64Url(segment))) as Record<string, unknown>;
}

/**
 * Returns the verified identity, or a string saying what failed — never an
 * exception for a bad token, so callers cannot confuse "invalid" with
 * "Google is down" (which DOES throw, and deserves a 502, not a 401).
 */
export async function verifyGoogleCredential(
  credential: string,
  clientId: string,
  now = Date.now(),
): Promise<GoogleIdentity | string> {
  const parts = credential.split(".");
  if (parts.length !== 3) return "That is not a Google credential.";

  let header: Record<string, unknown>;
  let claims: Record<string, unknown>;
  try {
    header = decodeSegment(parts[0]);
    claims = decodeSegment(parts[1]);
  } catch {
    return "That is not a Google credential.";
  }
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    return "Unexpected credential format.";
  }

  // Claims first: they are free to check, and a stale token should say
  // "sign in again" even when the signature would also fail.
  if (!ISSUERS.has(String(claims.iss))) return "Wrong issuer.";
  if (String(claims.aud) !== clientId) return "This credential is for a different app.";
  const expiresAt = Number(claims.exp) * 1000;
  if (!Number.isFinite(expiresAt) || expiresAt < now) return "That sign-in expired — try again.";
  if (claims.email_verified !== true && claims.email_verified !== "true") {
    return "Google has not verified that address.";
  }
  const sub = String(claims.sub ?? "");
  const email = String(claims.email ?? "").trim().toLowerCase();
  if (!sub || !email.includes("@")) return "The credential is missing its identity.";

  // Signature last. On an unknown kid, refresh once — rotations happen.
  let keys = await googleKeys(false);
  let jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) {
    keys = await googleKeys(true);
    jwk = keys.find((key) => key.kid === header.kid);
  }
  if (!jwk) return "Unknown signing key.";

  const publicKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "RSA", n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    fromBase64Url(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!valid) return "The signature does not check out.";

  return { sub, email };
}
