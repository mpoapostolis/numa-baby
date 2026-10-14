import { describe, expect, it } from "vitest";
import { MAX_PHOTO_BYTES, MAX_PHOTOS_PER_FAMILY, MAX_TOTAL_PHOTO_BYTES, handlePhoto } from "../../worker/photos";

// Baby photos, for families who share a log: a month's picture, the profile
// picture, a nappy worth showing the doctor. The bucket is private — nothing
// in it has a public address — and this is the only door to it: a phone may
// read, write and delete its OWN family's photos and nothing else.

type Row = Record<string, unknown>;

/** Just enough libSQL for the photo ledger. */
function fakeDb() {
  const rows = new Map<string, Row>();
  const key = (family: unknown, name: unknown) => `${family}/${name}`;
  return {
    rows,
    async execute(query: { sql: string; args?: unknown[] } | string) {
      const sql = (typeof query === "string" ? query : query.sql).replace(/\s+/g, " ").trim();
      const args = typeof query === "string" ? [] : (query.args ?? []);
      if (sql.startsWith("CREATE")) return { rows: [] };
      if (sql.startsWith("SELECT COALESCE(SUM(bytes)")) {
        return { rows: [{ total: [...rows.values()].reduce((n, r) => n + Number(r.bytes ?? 0), 0) }] };
      }
      if (sql.startsWith("SELECT COUNT(*)")) {
        const [family, name] = args;
        const count = [...rows.values()].filter((r) => r.family_id === family && r.name !== name).length;
        return { rows: [{ n: count }] };
      }
      if (sql.startsWith("INSERT INTO photos")) {
        const [family, name, bytes, at] = args;
        rows.set(key(family, name), { family_id: family, name, bytes, created_at: at });
        return { rows: [] };
      }
      if (sql.startsWith("DELETE FROM photos")) {
        rows.delete(key(args[0], args[1]));
        return { rows: [] };
      }
      throw new Error(`unexpected sql: ${sql}`);
    },
  };
}

function fakeBucket() {
  const objects = new Map<string, { bytes: Uint8Array; type?: string }>();
  return {
    objects,
    async put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }) {
      objects.set(key, { bytes: new Uint8Array(value), type: options?.httpMetadata?.contentType });
    },
    async get(key: string) {
      const found = objects.get(key);
      if (!found) return null;
      return { arrayBuffer: async () => found.bytes.buffer.slice(0), httpMetadata: { contentType: found.type } };
    },
    async delete(key: string) {
      objects.delete(key);
    },
  };
}

const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);
const NAME = "3f6c1d2e-9a4b-4c1d-8e2f-112233445566";

function request(method: string, body?: Uint8Array) {
  return new Request(`https://numalog.app/api/photos/${NAME}`, {
    method,
    body: body ? new Blob([body as BlobPart]) : undefined,
    headers: body ? { "content-length": String(body.length) } : undefined,
  });
}

function setup(spend: () => Promise<boolean> = async () => true) {
  const db = fakeDb();
  const bucket = fakeBucket();
  const call = (family: string, req: Request, name = NAME) =>
    handlePhoto({ db: db as never, bucket: bucket as never, spend }, req, family, name, "2026-10-14T10:00:00.000Z");
  return { db, bucket, call };
}

describe("the photo door", () => {
  it("gives a family back the photo it stored", async () => {
    const { call, bucket } = setup();
    expect((await call("fam-a", request("PUT", JPEG))).status).toBe(200);
    expect(bucket.objects.has(`fam-a/${NAME}`)).toBe(true);

    const back = await call("fam-a", request("GET"));
    expect(back.status).toBe(200);
    expect(new Uint8Array(await back.arrayBuffer())).toEqual(JPEG);
    expect(back.headers.get("content-type")).toBe("image/jpeg");
    // Never cached by the browser either: the phone keeps its own copy in
    // IndexedDB, and a second copy in the HTTP cache is a copy nobody erases.
    expect(back.headers.get("cache-control")).toBe("private, no-store");
  });

  it("never shows one family's photo to another", async () => {
    const { call } = setup();
    await call("fam-a", request("PUT", JPEG));
    expect((await call("fam-b", request("GET"))).status).toBe(404);
    // Nor lets them delete it.
    await call("fam-b", request("DELETE"));
    expect((await call("fam-a", request("GET"))).status).toBe(200);
  });

  it("takes only JPEGs, of a sane size, under a sane name", async () => {
    const { call } = setup();
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]);
    expect((await call("fam-a", request("PUT", png))).status).toBe(415);

    const huge = new Uint8Array(MAX_PHOTO_BYTES + 1);
    huge.set([0xff, 0xd8, 0xff]);
    expect((await call("fam-a", request("PUT", huge))).status).toBe(413);

    expect((await call("fam-a", request("PUT", JPEG), "../other-family/x")).status).toBe(400);
    expect((await call("fam-a", request("PUT", JPEG), "")).status).toBe(400);
  });

  it("stops a family at its photo allowance, but lets it replace one", async () => {
    const { call, db } = setup();
    for (let i = 0; i < MAX_PHOTOS_PER_FAMILY; i++) {
      db.rows.set(`fam-a/p${i}`, { family_id: "fam-a", name: `photo-${i}` });
    }
    expect((await call("fam-a", request("PUT", JPEG))).status).toBe(507);
    // Re-uploading a photo it already has is not a new one.
    db.rows.set(`fam-a/${NAME}`, { family_id: "fam-a", name: NAME });
    db.rows.delete("fam-a/p0");
    expect((await call("fam-a", request("PUT", JPEG))).status).toBe(200);
  });

  it("forgets a deleted photo", async () => {
    const { call, bucket, db } = setup();
    await call("fam-a", request("PUT", JPEG));
    expect((await call("fam-a", request("DELETE"))).status).toBe(200);
    expect(bucket.objects.size).toBe(0);
    expect(db.rows.size).toBe(0);
    expect((await call("fam-a", request("GET"))).status).toBe(404);
  });
});

describe("what keeps the free storage free", () => {
  it("refuses a body that says it is too large before reading it", async () => {
    const { call } = setup();
    const req = new Request(`https://numalog.app/api/photos/${NAME}`, {
      method: "PUT",
      headers: { "content-length": String(MAX_PHOTO_BYTES * 50) },
      body: new Blob([JPEG]),
    });
    expect((await call("fam-a", req)).status).toBe(413);
  });

  it("slows a family that uploads in a loop, and says for how long", async () => {
    const { call } = setup(async () => false);
    const response = await call("fam-a", request("PUT", JPEG));
    expect(response.status).toBe(429);
    // The phone holds the rest of its queue until then, instead of resending
    // every photo every minute.
    expect(Number(response.headers.get("retry-after"))).toBeGreaterThan(0);
  });

  it("stops short of the free storage, as a pause rather than a refusal", async () => {
    // Full for everyone is not this family's fault, and may pass: the phone
    // keeps the photo and tries again later (507 would be final).
    const { call, db } = setup();
    db.rows.set("someone/else", { family_id: "someone", name: "else", bytes: MAX_TOTAL_PHOTO_BYTES });
    const response = await call("fam-a", request("PUT", JPEG));
    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).not.toBeNull();
  });

  it("will not read a body that does not say how large it is", async () => {
    const { call } = setup();
    const stream = new ReadableStream({ start(controller) { controller.enqueue(JPEG); controller.close(); } });
    const req = new Request(`https://numalog.app/api/photos/${NAME}`, { method: "PUT", body: stream, duplex: "half" } as RequestInit);
    expect((await call("fam-a", req)).status).toBe(411);
  });
});
