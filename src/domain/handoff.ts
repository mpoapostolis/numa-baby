// Moving a log from one web address to another.
//
// The whole app lives in localStorage, and localStorage belongs to an ORIGIN.
// numa-baby.workers.dev and a shiny new domain are two different origins, so a
// redirect from one to the other does not move a family's log — it hides it.
// The entries are still on the phone, and unreachable forever, which is the
// worst outcome available: not lost, not there.
//
// So the move is done deliberately, by the person who owns the data, in a
// single hop through the old address:
//
//   new origin  →  OLD/handoff#to=<new origin>     (a top-level navigation, so
//                                                    the old page gets its own
//                                                    first-party storage back;
//                                                    an iframe would not — see
//                                                    storage partitioning)
//   old origin  →  NEW/#numa-handoff=<payload>     (in the FRAGMENT, which no
//                                                    browser sends to a server)
//
// Nothing touches the network. The payload is the same backup file the Download
// button already writes, gzipped and base64url'd, so the receiving side reuses
// the import path that already exists — same validation, same confirmation,
// same rollback copy — rather than inventing a second way in.
//
// THE SECURITY OF THE WHOLE THING IS ONE LIST. The old address will hand a
// complete infant health record to whatever origin it is asked to. If that
// choice could be made by a link, then any page anywhere could link to
// OLD/handoff#to=https://evil.example and be sent the lot. So the target is
// checked against the list below and nothing else is ever accepted — no
// wildcards, no subdomain matching, no "starts with".

/**
 * Every address the real app answers on. Adding a domain here is granting it a
 * family's complete history: add nothing that is not this same app under the
 * same owner. A second entry appears the day a proper domain is bought — until
 * then there is nowhere to move a log TO, and the offer never appears.
 */
export const PRODUCTION_ORIGINS: readonly string[] = [
  "https://numa-baby.mpoapostolis.workers.dev",
];

/**
 * The same flow on one machine. Two origins pointing at one dev server is
 * exactly the situation this has to survive, so it can be tested end to end
 * without buying anything.
 */
export const DEVELOPMENT_ORIGINS: readonly string[] = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

export const HANDOFF_ORIGINS: readonly string[] = [...PRODUCTION_ORIGINS, ...DEVELOPMENT_ORIGINS];

/**
 * The addresses THIS one may exchange logs with.
 *
 * Deliberately not "everything on the list": the deployed app must never agree
 * to send a log to http://localhost:3000, or a link could hand a family's
 * records to whatever happens to be listening on the victim's own machine.
 * Production talks to production; a dev build talks to dev builds.
 */
function band(origin: string): readonly string[] | null {
  if (PRODUCTION_ORIGINS.includes(origin)) return PRODUCTION_ORIGINS;
  if (DEVELOPMENT_ORIGINS.includes(origin)) return DEVELOPMENT_ORIGINS;
  // An origin the app does not recognise exchanges logs with nobody. This is
  // what a preview deployment, or a copy someone else has put up, gets.
  return null;
}

/** Fragment key on the receiving side. */
export const PAYLOAD_KEY = "numa-handoff";
/** Fragment key on the sending side. */
export const TARGET_KEY = "to";
/** The path the sending side answers on. */
export const HANDOFF_PATH = "/handoff";

/**
 * A URL that is too long stops being a URL somewhere between "works" and
 * "silently truncated", and the failure looks like data loss. Past this, the
 * flow says so and points at the backup file, which has no limit at all.
 */
export const MAX_PAYLOAD_CHARS = 512_000;

/** May a log travel from `currentOrigin` to `target`? */
export function isAllowedTarget(currentOrigin: string, target: string): boolean {
  const allowed = band(currentOrigin);
  return allowed !== null && target !== currentOrigin && allowed.includes(target);
}

/** The other addresses this app answers on — the ones a log could be sitting
    at. Never includes where you already are, and empty until there is a second
    address, which is when the offer stops being shown at all. */
export function handoffPeers(currentOrigin: string): string[] {
  return (band(currentOrigin) ?? []).filter((origin) => origin !== currentOrigin);
}

/** "numa-baby.mpoapostolis.workers.dev" — what a person recognises, rather
    than the scheme and the slashes. */
export function originLabel(origin: string): string {
  try {
    return new URL(origin).host;
  } catch {
    return origin;
  }
}

/** Read `#to=…` from a sending-side URL. Returns null unless it names a single,
    well-formed address this one may talk to — anything else is not a near miss
    to be repaired, it is an attempt. */
export function readHandoffTarget(hash: string, currentOrigin: string): string | null {
  const value = readFragment(hash, TARGET_KEY);
  if (!value) return null;
  let origin: string;
  try {
    // Parsed rather than string-matched: "https://numa.app.evil.example" and
    // "https://numa.app@evil.example" both start with the right characters.
    origin = new URL(value).origin;
  } catch {
    return null;
  }
  return isAllowedTarget(currentOrigin, origin) ? origin : null;
}

/** Read `#numa-handoff=…` from a receiving-side URL. */
export function readHandoffPayload(hash: string): string | null {
  const value = readFragment(hash, PAYLOAD_KEY);
  if (!value) return null;
  // base64url and nothing else, checked before anything tries to decode it.
  return /^[A-Za-z0-9_-]+$/.test(value) && value.length <= MAX_PAYLOAD_CHARS ? value : null;
}

function readFragment(hash: string, key: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const value = params.get(key);
  return value && value.length ? value : null;
}

export function handoffSendUrl(oldOrigin: string, newOrigin: string): string {
  return `${oldOrigin}${HANDOFF_PATH}#${TARGET_KEY}=${encodeURIComponent(newOrigin)}`;
}

export function handoffReturnUrl(target: string, payload: string): string {
  return `${target}/#${PAYLOAD_KEY}=${payload}`;
}

// ---------------------------------------------------------------------------
// Packing
// ---------------------------------------------------------------------------

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  // Chunked: String.fromCharCode(...bytes) on a megabyte blows the call stack.
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function through(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const reader = stream.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

/** Gzip and base64url a backup. Returns null if the result is too long to
    survive being a URL — the caller then falls back to the backup file. */
export async function packHandoff(json: string): Promise<string | null> {
  const bytes = new TextEncoder().encode(json);
  // CompressionStream is missing on older Safari. Uncompressed still works;
  // it just runs into the length cap sooner, which is handled, not hidden.
  const packed = "CompressionStream" in globalThis
    ? await through(
        new Blob([bytes as unknown as BlobPart])
          .stream()
          .pipeThrough(new CompressionStream("gzip")) as ReadableStream<Uint8Array>,
      )
    : bytes;
  const encoded = toBase64Url(packed);
  return encoded.length > MAX_PAYLOAD_CHARS ? null : encoded;
}

/** The inverse. Throws on anything that is not a log this app wrote. */
export async function unpackHandoff(payload: string): Promise<string> {
  const bytes = fromBase64Url(payload);
  // Gzip announces itself: 1f 8b. Anything else is treated as plain UTF-8,
  // which is what a browser without CompressionStream will have sent.
  const gzipped = bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
  if (!gzipped) return new TextDecoder().decode(bytes);
  const out = await through(
    new Blob([bytes as unknown as BlobPart])
      .stream()
      .pipeThrough(new DecompressionStream("gzip")) as ReadableStream<Uint8Array>,
  );
  return new TextDecoder().decode(out);
}
