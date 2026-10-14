/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { savePairing } from "@/domain/familyPairing";
import { PHOTO_QUEUE_KEY } from "@/domain/photoRef";

// The upload queue: what waits to go to the family's bucket, and what makes
// it wait. Each test loads the photo code afresh — "asked to wait" is kept
// in the module, as it is for the life of a page.

type Photos = typeof import("@/lib/photos");
let photos: Photos;
let fetchMock: ReturnType<typeof vi.fn>;

const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 1])], { type: "image/jpeg" });
const queued = () => JSON.parse(window.localStorage.getItem(PHOTO_QUEUE_KEY) ?? "[]") as { op: string; id: string }[];
const IDS = ["a1b2c3d4-q1", "a1b2c3d4-q2", "a1b2c3d4-q3"];

beforeEach(async () => {
  window.localStorage.clear();
  vi.resetModules();
  photos = await import("@/lib/photos");
  fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  savePairing({ familyId: "fam", token: "secret-token", deviceId: "dev", deviceLabel: "Phone" } as never);
  for (const id of IDS) await photos.putLocalPhoto(id, jpeg());
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  for (const id of IDS) await photos.deleteLocalPhoto(id);
});

test("asked to wait, the rest of the queue waits with it — not resent every minute", async () => {
  fetchMock.mockImplementation(async () => new Response("{}", { status: 429, headers: { "retry-after": "600" } }));
  photos.queuePhotos(IDS);
  await photos.flushPhotoQueue();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(queued().map((op) => op.id).sort()).toEqual([...IDS].sort());

  // The next heartbeat, a minute later: still inside the wait.
  await photos.flushPhotoQueue();
  expect(await photos.sharePhoto(IDS[0])).toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test("a read this phone could not do keeps the upload queued, rather than dropping it", async () => {
  photos.queuePhotos([IDS[0]]);
  const transaction = vi.spyOn(IDBDatabase.prototype, "transaction").mockImplementation(() => {
    throw new DOMException("The database connection is closing.", "InvalidStateError");
  });
  await photos.flushPhotoQueue();
  expect(fetchMock).not.toHaveBeenCalled();
  expect(queued()).toEqual([{ op: "put", id: IDS[0] }]);

  transaction.mockRestore();
  await photos.flushPhotoQueue();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][1].method).toBe("PUT");
  expect(queued()).toEqual([]);
});

test("before joining a family, uploads of photos nothing refers to any more are dropped", () => {
  photos.queuePhotos(IDS);
  photos.keepOnlyQueuedPuts([IDS[1]]);
  expect(queued()).toEqual([{ op: "put", id: IDS[1] }]);
});

// The sweep on start: the photos of entries deleted while their Undo was
// still on screen when the app was closed.
test("on start, a deleted entry's photo still on this phone goes, here and in the bucket", async () => {
  await photos.releaseDeletedPhotos([{ deleted: true, photo: IDS[0] }, { photo: IDS[1] }], {});
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(fetchMock.mock.calls[0][0]).toBe(`/api/photos/${IDS[0]}`);
  expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  expect(await photos.getLocalPhoto(IDS[0])).toBeNull();
  expect(await photos.getLocalPhoto(IDS[1])).not.toBeNull();
});

test("and only once: a photo no longer on this phone is not asked about again", async () => {
  await photos.deleteLocalPhoto(IDS[0]);
  await photos.releaseDeletedPhotos([{ deleted: true, photo: IDS[0] }], {});
  expect(fetchMock).not.toHaveBeenCalled();
});

test("a photo still shown somewhere — the profile, a live entry — is kept", async () => {
  await photos.releaseDeletedPhotos([{ deleted: true, photo: IDS[0] }, { deleted: true, photo: IDS[1] }, { photo: IDS[1] }], { photo: IDS[0] });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(await photos.getLocalPhoto(IDS[0])).not.toBeNull();
  expect(await photos.getLocalPhoto(IDS[1])).not.toBeNull();
});

// Another tab or window with this entry's Undo still on screen holds a lock
// on its photo; a start in this one leaves that photo alone.
test("a photo whose Undo another tab is still offering is left alone", async () => {
  const held = new Set([`numalog-photo-undo:${IDS[0]}`]);
  vi.stubGlobal("navigator", {
    ...navigator,
    locks: {
      request: async (name: string, options: { ifAvailable?: boolean }, callback: (lock: object | null) => unknown) =>
        callback(options.ifAvailable && held.has(name) ? null : { name }),
    },
  });
  await photos.releaseDeletedPhotos([{ deleted: true, photo: IDS[0] }, { deleted: true, photo: IDS[1] }], {});
  await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(fetchMock.mock.calls[0][0]).toBe(`/api/photos/${IDS[1]}`);
  expect(await photos.getLocalPhoto(IDS[0])).not.toBeNull();
});
