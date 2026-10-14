/// <reference types="@cloudflare/workers-types" />
// Baby photos, for a family that shares its log.
//
// Asked for from the feedback box: a picture for each month, the baby's
// profile picture, a photo on a nappy entry "of anything unusual". A phone
// keeps its own photos in IndexedDB; this is how the OTHER parent's phone
// gets them.
//
// The bucket is private: it has no r2.dev address and no custom domain, so
// nothing in it can be fetched by URL. This handler is the only door, behind
// the same family bearer token as sync, and every key is prefixed with the
// caller's family id — a phone can only ever name its own family's photos.
//
// Photos are compressed on the phone before they come here (and lose their
// EXIF, GPS included, on the way). What arrives is checked to BE a JPEG and
// to be photo-sized; anything else is refused rather than stored.
//
// A small ledger in the database counts each family's photos, so one family
// cannot fill the free storage every other family's photos share, and so the
// operator can see the total without listing the bucket (a paid operation).

import type { Client } from "@libsql/client/web";

/** Compressed on the phone to ~150-300 KB; this leaves room, not a loophole. */
export const MAX_PHOTO_BYTES = 600_000;
/** 24 months, a profile picture, and a few hundred nappies worth a picture. */
export const MAX_PHOTOS_PER_FAMILY = 400;
/** R2's free tier is 10 GB. New photos stop short of it, so the bill stays
    at nothing; a refused photo simply stays on the phone it was taken on. */
export const MAX_TOTAL_PHOTO_BYTES = 9_000_000_000;

/** Photo ids are minted on the phone (crypto.randomUUID). */
const NAME = /^[A-Za-z0-9-]{8,64}$/;

type PhotoBucket = Pick<R2Bucket, "put" | "get" | "delete">;
type Deps = {
  db: Pick<Client, "execute">;
  bucket: PhotoBucket;
  /** One upload from this family's hourly allowance; false when it is spent. */
  spend: () => Promise<boolean>;
};

let ledgerReady = false;

async function ensureLedger(db: Deps["db"]) {
  if (ledgerReady) return;
  await db.execute(`CREATE TABLE IF NOT EXISTS photos (
    family_id TEXT NOT NULL,
    name TEXT NOT NULL,
    bytes INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (family_id, name)
  )`);
  ledgerReady = true;
}

function answer(body: BodyInit | null, status: number, contentType = "application/json"): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": contentType,
      // One family's photo, behind their key. Not even the browser's cache:
      // the phone keeps its own copy in IndexedDB, and a second copy in the
      // HTTP cache is one that "Erase everything" would never reach.
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function refuse(message: string, status: number, retryAfterSeconds?: number): Response {
  const response = answer(JSON.stringify({ error: message }), status);
  if (retryAfterSeconds) response.headers.set("retry-after", String(retryAfterSeconds));
  return response;
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

export async function handlePhoto(
  deps: Deps,
  request: Request,
  familyId: string,
  name: string,
  now: string,
): Promise<Response> {
  if (!NAME.test(name)) return refuse("Not a photo id.", 400);
  const key = `${familyId}/${name}`;

  if (request.method === "GET") {
    const object = await deps.bucket.get(key);
    if (!object) return refuse("No such photo.", 404);
    return answer(await object.arrayBuffer(), 200, "image/jpeg");
  }

  if (request.method === "PUT") {
    // Refuse what says it is too large — or will not say — before reading a
    // byte of it. A phone's upload always declares its length.
    const declared = request.headers.get("content-length");
    if (declared === null || !/^\d+$/.test(declared)) return refuse("Say how large the photo is.", 411);
    if (Number(declared) > MAX_PHOTO_BYTES) return refuse("That photo is too large.", 413);
    // Ten minutes: the phone holds the rest of its queue until then.
    if (!(await deps.spend())) return refuse("Too many photos at once — the rest will follow.", 429, 600);
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.length > MAX_PHOTO_BYTES) return refuse("That photo is too large.", 413);
    if (!isJpeg(bytes)) return refuse("Photos are stored as JPEG.", 415);
    await ensureLedger(deps.db);
    const total = await deps.db.execute("SELECT COALESCE(SUM(bytes), 0) AS total FROM photos");
    // Full for everyone is not this family's doing and may pass: a pause the
    // phone retries (503), not the final 507 of a family's own allowance.
    if (Number(total.rows[0]?.total ?? 0) + bytes.length > MAX_TOTAL_PHOTO_BYTES) {
      return refuse("Photo storage is full for now.", 503, 3600);
    }
    const counted = await deps.db.execute({
      sql: "SELECT COUNT(*) AS n FROM photos WHERE family_id = ? AND name != ?",
      args: [familyId, name],
    });
    if (Number(counted.rows[0]?.n ?? 0) >= MAX_PHOTOS_PER_FAMILY) {
      return refuse("This family has reached its photo allowance.", 507);
    }
    await deps.bucket.put(key, bytes.buffer as ArrayBuffer, { httpMetadata: { contentType: "image/jpeg" } });
    await deps.db.execute({
      sql: `INSERT INTO photos (family_id, name, bytes, created_at) VALUES (?, ?, ?, ?)
            ON CONFLICT(family_id, name) DO UPDATE SET bytes = excluded.bytes`,
      args: [familyId, name, bytes.length, now],
    });
    return answer(JSON.stringify({ ok: true }), 200);
  }

  if (request.method === "DELETE") {
    await ensureLedger(deps.db);
    await deps.bucket.delete(key);
    await deps.db.execute({ sql: "DELETE FROM photos WHERE family_id = ? AND name = ?", args: [familyId, name] });
    return answer(JSON.stringify({ ok: true }), 200);
  }

  return refuse("Unknown method.", 405);
}
