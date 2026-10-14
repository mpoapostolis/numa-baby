// Baby photos on the phone, and to the other parent's phone.
//
// Asked for from the feedback box: a photo for each month, the baby's
// profile picture, a photo on a nappy entry "of anything unusual".
//
// - Every photo is compressed here before it is kept: drawn through a canvas
//   at most 1280px on its long edge and re-encoded as JPEG, which also drops
//   the camera's EXIF — the GPS position of the family's home included.
// - This phone's copy lives in IndexedDB. localStorage is a few megabytes of
//   text and would be full after a handful of pictures.
// - A family that shares its log (Family Sync) also sends each photo to the
//   private bucket behind the Worker (worker/photos.ts), under the family's
//   key; the other phone fetches it the first time it is shown and keeps it.
//   A family that does not share sends nothing anywhere.
// - An upload or a removal that fails (offline, a tunnel) is queued and
//   retried; flushPhotoQueue runs with every sync.

import { loadPairing } from "../domain/familyPairing";
import { PHOTO_QUEUE_KEY } from "../domain/photoRef";

const DB_NAME = "numalog-photos";
const STORE = "photos";
const QUEUE_KEY = PHOTO_QUEUE_KEY;

/** Long edge, in pixels: sharp full-screen on a phone, small to keep. */
const MAX_EDGE = 1280;
/** Compressed photos aim under this; quality steps down until they fit. */
const TARGET_BYTES = 300_000;

export function newPhotoId(): string {
  return crypto.randomUUID();
}

// ---- IndexedDB --------------------------------------------------------------

let opening: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => {
      const db = request.result;
      // iOS may close a backgrounded app's connection under it; a newer tab
      // may upgrade. Either way, the next call opens a fresh one.
      db.onclose = () => {
        opening = null;
      };
      db.onversionchange = () => {
        db.close();
        opening = null;
      };
      resolve(db);
    };
    request.onerror = () => {
      opening = null;
      reject(request.error);
    };
  });
  return opening;
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE, mode);
    const request = work(transaction.objectStore(STORE));
    // Settled by the transaction, not the request: a write can succeed as a
    // request and still be thrown away at commit (storage full), and a photo
    // reported as kept must be kept.
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error ?? request.error ?? new DOMException("Aborted", "AbortError"));
  });
}

// Kept as bytes and a type, not as a Blob: older iOS Safari could not keep a
// Blob in IndexedDB at all, and bytes survive every engine's structured clone.
type Stored = { type: string; bytes: ArrayBuffer };

export async function putLocalPhoto(id: string, blob: Blob): Promise<void> {
  // Ask the browser not to evict this origin's storage under pressure: these
  // are photos of somebody's baby, not a cache.
  void navigator.storage?.persist?.().catch(() => undefined);
  const stored: Stored = { type: blob.type || "image/jpeg", bytes: await blob.arrayBuffer() };
  await run("readwrite", (store) => store.put(stored, id));
}

/** This phone's copy, null when there is none — and an error when this
    phone cannot tell (the storage connection lost for a moment). */
async function readLocalPhoto(id: string): Promise<Blob | null> {
  const stored = (await run("readonly", (store) => store.get(id))) as Stored | undefined;
  return stored ? new Blob([stored.bytes], { type: stored.type }) : null;
}

export async function getLocalPhoto(id: string): Promise<Blob | null> {
  try {
    return await readLocalPhoto(id);
  } catch {
    return null;
  }
}

export async function deleteLocalPhoto(id: string): Promise<void> {
  try {
    await run("readwrite", (store) => store.delete(id));
  } catch {
    // Nothing to remove.
  }
}

// Bumped by "Erase everything": work that started before it (a download on
// its way, a queue being flushed) must not write anything back after it.
let eraseGeneration = 0;

/** "Erase everything" means the photos too. */
export async function clearAllPhotos(): Promise<void> {
  eraseGeneration += 1;
  try {
    window.localStorage.removeItem(QUEUE_KEY);
  } catch {
    // Nothing queued that can be reached.
  }
  try {
    const db = await openDb();
    db.close();
  } catch {
    // Never opened: nothing to close.
  }
  opening = null;
  await new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
  });
}

// ---- Sharing with the other phone ------------------------------------------

type QueuedOp = { op: "put" | "delete"; id: string };

// The debug preview runs on made-up data inside a real phone that may well be
// paired: nothing it does may reach the real family's photos.
let sharingSuspended = false;

export function setPhotoSharingSuspended(suspended: boolean) {
  sharingSuspended = suspended;
}

function sharingPairing() {
  return sharingSuspended ? null : loadPairing();
}

/** Until when the server asked this phone to wait before sending more. */
let pausedUntil = 0;

/** Refusals that retrying cannot change: too large, not a JPEG, a bad id,
    the family's allowance reached. Anything else — signed out for a moment,
    too many at once, the server having a bad minute — is tried again. */
const FINAL_REFUSALS = new Set([400, 413, 415, 507]);

function readQueue(): QueuedOp[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(QUEUE_KEY) ?? "[]") as unknown;
    return Array.isArray(parsed) ? (parsed as QueuedOp[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedOp[]) {
  try {
    if (queue.length) window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    else window.localStorage.removeItem(QUEUE_KEY);
  } catch {
    // A queue that cannot be stored is retried by the next explicit action.
  }
}

function enqueue(next: QueuedOp) {
  // The latest intent for a photo replaces any earlier one.
  writeQueue([...readQueue().filter((op) => op.id !== next.id), next]);
}

// One photo, one order of events: a removal waits for an upload of the same
// photo that is still on its way, or the upload would land after it and put
// the photo back in the bucket with nothing pointing at it.
const inflight = new Map<string, Promise<boolean>>();

async function send(op: QueuedOp, token: string): Promise<boolean> {
  const previous = inflight.get(op.id);
  const run = (async () => {
    if (previous) await previous.catch(() => false);
    return sendNow(op, token);
  })();
  inflight.set(op.id, run);
  try {
    return await run;
  } finally {
    if (inflight.get(op.id) === run) inflight.delete(op.id);
  }
}

async function sendNow(op: QueuedOp, token: string): Promise<boolean> {
  try {
    let body: Blob | undefined;
    if (op.op === "put") {
      // A failed read throws to the catch below and stays queued; only a
      // photo that is really gone from this phone is dropped.
      const local = await readLocalPhoto(op.id);
      if (!local) return true; // Gone from this phone since: nothing to send.
      body = local;
    }
    const response = await fetch(`/api/photos/${encodeURIComponent(op.id)}`, {
      method: op.op === "put" ? "PUT" : "DELETE",
      headers: { authorization: `Bearer ${token}`, ...(body ? { "content-type": "image/jpeg" } : {}) },
      body,
    });
    if (response.status === 429 || response.status === 503) {
      // "Not now" — the hour's uploads spent, or storage full for everyone.
      // Asking again with every photo, every minute, would only spend the
      // parent's data on the same answer.
      const seconds = Number(response.headers.get("retry-after"));
      pausedUntil = Date.now() + (Number.isFinite(seconds) && seconds > 0 ? seconds : 600) * 1000;
    }
    return response.ok || FINAL_REFUSALS.has(response.status);
  } catch {
    return false;
  }
}

/** Send a photo already kept on this phone. False when it was not sent now. */
export async function sharePhoto(id: string): Promise<boolean> {
  if (sharingSuspended) return false;
  const pairing = loadPairing();
  // Not sharing yet: keep the intent. The parent who saved the app before
  // the birth adds months of photos, THEN invites the other parent — the
  // queue sends them with the first sync after pairing.
  if (!pairing || Date.now() < pausedUntil) {
    enqueue({ op: "put", id });
    return false;
  }
  const sent = await send({ op: "put", id }, pairing.token);
  if (!sent) enqueue({ op: "put", id });
  return sent;
}

/** Queue photos to be sent with the next sync — on joining a family, every
    photo the log refers to, so they follow the log into the family's space.
    A photo this phone does not hold is skipped when its turn comes. */
export function queuePhotos(ids: string[]) {
  if (sharingSuspended) return;
  for (const id of new Set(ids)) enqueue({ op: "put", id });
}

/** Drop queued uploads of photos nothing refers to any more — an entry
    deleted while this phone was not sharing, before it joins a family. */
export function keepOnlyQueuedPuts(ids: string[]) {
  const keep = new Set(ids);
  writeQueue(readQueue().filter((op) => op.op !== "put" || keep.has(op.id)));
}

let flushing: Promise<void> | null = null;

/** Retry whatever failed to send earlier. Calls that overlap share one run. */
export function flushPhotoQueue(): Promise<void> {
  flushing ??= runFlush().finally(() => {
    flushing = null;
  });
  return flushing;
}

async function runFlush(): Promise<void> {
  const pairing = sharingPairing();
  const queue = readQueue();
  if (!pairing || queue.length === 0 || Date.now() < pausedUntil) return;
  const generation = eraseGeneration;
  const left: QueuedOp[] = [];
  for (let index = 0; index < queue.length; index++) {
    if (!(await send(queue[index], pairing.token))) left.push(queue[index]);
    // Asked to wait: the rest stay queued, untried.
    if (Date.now() < pausedUntil) {
      left.push(...queue.slice(index + 1));
      break;
    }
  }
  if (generation !== eraseGeneration) return;
  // Ops queued while this ran are kept too.
  const added = readQueue().filter((op) => !queue.some((q) => q.id === op.id && q.op === op.op));
  writeQueue([...left, ...added]);
}

/** This phone's copy, or — for a family that shares — the other phone's. */
export async function fetchPhoto(id: string): Promise<Blob | null> {
  // Taken before anything is awaited: an erase during the local read counts.
  const generation = eraseGeneration;
  const local = await getLocalPhoto(id);
  if (local) return local;
  const pairing = sharingPairing();
  if (!pairing) return null;
  try {
    const response = await fetch(`/api/photos/${encodeURIComponent(id)}`, {
      headers: { authorization: `Bearer ${pairing.token}` },
    });
    if (!response.ok) return null;
    const blob = await response.blob();
    // Erased while this was on its way: do not put the photo back.
    if (generation !== eraseGeneration) return null;
    // Shown even if keeping a copy fails (storage full, a lost connection).
    await putLocalPhoto(id, blob).catch(() => undefined);
    return blob;
  } catch {
    return null;
  }
}

/**
 * On a start after the app was closed with a deleted entry's Undo still on
 * screen: let go of the photos only deleted entries refer to, here and in the
 * family's bucket. Once only — a photo no longer on this phone is skipped —
 * and never one whose Undo another open tab is still offering.
 */
export async function releaseDeletedPhotos(
  list: { deleted?: boolean; photo?: string }[],
  profile: { photo?: string },
): Promise<void> {
  const inUse = new Set([profile.photo, ...list.filter((item) => !item.deleted).map((item) => item.photo)]);
  const ids = new Set(list.flatMap((item) => (item.deleted && item.photo && !inUse.has(item.photo) ? [item.photo] : [])));
  for (const id of ids) {
    const forget = async () => {
      if (await getLocalPhoto(id)) void forgetPhoto(id);
    };
    // Another tab or window still offering this entry's Undo holds its lock
    // (useTrackerStore removeActivity): leave the photo for its next start.
    if (navigator.locks) {
      await navigator.locks.request(`numalog-photo-undo:${id}`, { ifAvailable: true }, (lock) => (lock ? forget() : undefined));
    } else {
      await forget();
    }
  }
}

/** Remove a photo from this phone and, for a family that shares, the bucket. */
export async function forgetPhoto(id: string): Promise<void> {
  await deleteLocalPhoto(id);
  if (sharingSuspended) return;
  const pairing = loadPairing();
  // Never sent: nothing to remove anywhere but the queue.
  if (!pairing) {
    writeQueue(readQueue().filter((op) => op.id !== id));
    return;
  }
  if (!(await send({ op: "delete", id }, pairing.token))) enqueue({ op: "delete", id });
}

// ---- Compression -------------------------------------------------------------
//
// Measured in Safari's engine and Chromium before this was written: JPEG is
// the only format both can ENCODE (Safari quietly hands back a PNG for webp,
// three to four times larger, and nothing encodes AVIF), and at one quality
// number Safari's JPEGs come out 1.7-2x larger than Chrome's — so quality is
// stepped down until the photo fits, rather than fixed. The re-encode keeps
// no GPS or orientation EXIF in either engine.

const QUALITIES = [0.82, 0.72, 0.62, 0.52];

function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality));
}

type Decoded = { source: ImageBitmap | HTMLImageElement; width: number; height: number; release: () => void };

async function decode(file: Blob): Promise<Decoded> {
  try {
    // Honour the camera's orientation flag, or portraits arrive on their side.
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  } catch (error) {
    // Older engines (iOS 15, Chrome before 112) do not take that option. An
    // <img> applies the orientation itself; img-src allows blob: for this.
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => undefined };
    } catch {
      throw error;
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** The browser's own high-quality downscale where it has one; otherwise the
    canvas scales while drawing. */
async function shrunk(source: Decoded["source"], width: number, height: number): Promise<{ image: CanvasImageSource; release: () => void }> {
  try {
    const bitmap = await createImageBitmap(source, { resizeWidth: width, resizeHeight: height, resizeQuality: "high" });
    return { image: bitmap, release: () => bitmap.close() };
  } catch {
    return { image: source, release: () => undefined };
  }
}

/**
 * A phone photo (often 3-12 MB) down to a JPEG of at most TARGET_BYTES and
 * MAX_EDGE on its long side, upright, with no EXIF. Throws for a photo this
 * phone cannot decode (an HEIC on Android, say) — the caller says so kindly.
 */
export async function compressPhoto(file: Blob): Promise<Blob> {
  const original = await decode(file);
  let edge = Math.min(MAX_EDGE, Math.max(original.width, original.height));
  let best: Blob | null = null;
  try {
    for (let shrink = 0; shrink < 4; shrink++) {
      const scale = edge / Math.max(original.width, original.height);
      const width = Math.max(1, Math.round(original.width * scale));
      const height = Math.max(1, Math.round(original.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      // No context (iOS out of canvas memory): stop, rather than encode an
      // empty canvas and keep a black square as somebody's baby photo.
      if (!context) throw new Error("This phone could not prepare the photo");
      // JPEG has no transparency: a screenshot's clear corners would turn
      // black. White is what the eye expected there.
      context.fillStyle = "#fff";
      context.fillRect(0, 0, width, height);
      context.imageSmoothingQuality = "high";
      const resized = await shrunk(original.source, width, height);
      context.drawImage(resized.image, 0, 0, width, height);
      resized.release();
      for (const quality of QUALITIES) {
        const blob = await encode(canvas, quality);
        // Anything that is not a JPEG is an engine falling back, not a photo.
        if (!blob || blob.type !== "image/jpeg") continue;
        if (!best || blob.size < best.size) best = blob;
        if (blob.size <= TARGET_BYTES) break;
      }
      // iOS caps canvas memory in total and is slow to give it back.
      canvas.width = 0;
      canvas.height = 0;
      if (best && best.size <= TARGET_BYTES) break;
      edge = Math.round(edge * 0.8);
    }
  } finally {
    original.release();
  }
  if (!best) throw new Error("This phone could not prepare the photo");
  return best;
}
