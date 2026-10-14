/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAllPhotos,
  deleteLocalPhoto,
  queuePhotos,
  fetchPhoto,
  flushPhotoQueue,
  forgetPhoto,
  getLocalPhoto,
  putLocalPhoto,
  sharePhoto,
  setPhotoSharingSuspended,
} from "@/lib/photos";
import { savePairing } from "@/domain/familyPairing";

// The phone's own copy of every photo lives in IndexedDB — localStorage is a
// few megabytes of text and would fill with a handful of pictures. A family
// that shares its log also sends each photo to the private bucket, so the
// other parent's phone can fetch it the first time it is shown.

const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3])], { type: "image/jpeg" });

async function bytes(blob: Blob | null) {
  return blob ? Array.from(new Uint8Array(await blob.arrayBuffer())) : null;
}

function pair() {
  savePairing({ familyId: "fam", token: "secret-token", deviceId: "dev", deviceLabel: "Phone" } as never);
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  window.localStorage.clear();
  fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  setPhotoSharingSuspended(false);
  for (const id of ["a1b2c3d4-one", "a1b2c3d4-two", "a1b2c3d4-far"]) await deleteLocalPhoto(id);
});

describe("on this phone", () => {
  it("keeps a photo and gives it back", async () => {
    await putLocalPhoto("a1b2c3d4-one", jpeg());
    expect(await bytes(await getLocalPhoto("a1b2c3d4-one"))).toEqual([0xff, 0xd8, 0xff, 1, 2, 3]);
    await deleteLocalPhoto("a1b2c3d4-one");
    expect(await getLocalPhoto("a1b2c3d4-one")).toBeNull();
  });

  it("sends nothing anywhere for a family that does not share its log", async () => {
    await putLocalPhoto("a1b2c3d4-one", jpeg());
    expect(await sharePhoto("a1b2c3d4-one")).toBe(false);
    expect(await fetchPhoto("a1b2c3d4-far")).toBeNull();
    await flushPhotoQueue();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends a photo taken before Family Sync once the family is paired", async () => {
    // The parent who saved the app before the birth adds photos for months,
    // then invites the other parent: those photos must follow.
    await putLocalPhoto("a1b2c3d4-one", jpeg());
    await sharePhoto("a1b2c3d4-one");
    pair();
    await flushPhotoQueue();
    expect(fetchMock.mock.calls.map((call) => [call[0], call[1].method])).toEqual([["/api/photos/a1b2c3d4-one", "PUT"]]);
  });

  it("forgets a photo removed before it was ever sent", async () => {
    await putLocalPhoto("a1b2c3d4-one", jpeg());
    await sharePhoto("a1b2c3d4-one");
    await forgetPhoto("a1b2c3d4-one");
    pair();
    await flushPhotoQueue();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("for a family that shares its log", () => {
  it("uploads the photo with the family's key", async () => {
    pair();
    await putLocalPhoto("a1b2c3d4-one", jpeg());
    expect(await sharePhoto("a1b2c3d4-one")).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/photos/a1b2c3d4-one");
    expect(init.method).toBe("PUT");
    expect(init.headers.authorization).toBe("Bearer secret-token");
  });

  it("keeps trying an upload that failed, until it goes through", async () => {
    pair();
    await putLocalPhoto("a1b2c3d4-two", jpeg());
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    expect(await sharePhoto("a1b2c3d4-two")).toBe(false);

    await flushPhotoQueue();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1].method).toBe("PUT");

    // Done: a third flush has nothing left to send.
    await flushPhotoQueue();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fetches a photo the other phone took, once, and keeps it", async () => {
    pair();
    fetchMock.mockResolvedValueOnce(new Response(new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]), { status: 200, headers: { "content-type": "image/jpeg" } }));
    expect(await bytes(await fetchPhoto("a1b2c3d4-far"))).toEqual([0xff, 0xd8, 0xff, 1, 2, 3]);
    // The second look is local.
    expect(await bytes(await fetchPhoto("a1b2c3d4-far"))).toEqual([0xff, 0xd8, 0xff, 1, 2, 3]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("removes a photo from this phone and from the bucket", async () => {
    pair();
    await putLocalPhoto("a1b2c3d4-one", jpeg());
    await forgetPhoto("a1b2c3d4-one");
    expect(await getLocalPhoto("a1b2c3d4-one")).toBeNull();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/photos/a1b2c3d4-one");
    expect(fetchMock.mock.calls[0][1].method).toBe("DELETE");
  });
});

describe("what a refusal means", () => {
  it("retries what the server could not take right now, drops what it never will", async () => {
    pair();
    await putLocalPhoto("a1b2c3d4-one", jpeg());
    await putLocalPhoto("a1b2c3d4-two", jpeg());
    // Signed out for a moment, or too many at once: try again later.
    fetchMock.mockResolvedValueOnce(new Response("", { status: 401 }));
    expect(await sharePhoto("a1b2c3d4-one")).toBe(false);
    // Too large, not a JPEG, allowance reached: retrying cannot help.
    fetchMock.mockResolvedValueOnce(new Response("", { status: 413 }));
    await sharePhoto("a1b2c3d4-two");

    fetchMock.mockClear();
    await flushPhotoQueue();
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual(["/api/photos/a1b2c3d4-one"]);
  });
});

describe("the debug preview", () => {
  it("never sends a photo to the real family", async () => {
    pair();
    setPhotoSharingSuspended(true);
    await putLocalPhoto("a1b2c3d4-one", jpeg());
    expect(await sharePhoto("a1b2c3d4-one")).toBe(false);
    await forgetPhoto("a1b2c3d4-one");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("erasing everything", () => {
  it("takes the photos with it", async () => {
    await putLocalPhoto("a1b2c3d4-one", jpeg());
    await clearAllPhotos();
    expect(await getLocalPhoto("a1b2c3d4-one")).toBeNull();
  });

  it("is not undone by a download that was already on its way", async () => {
    pair();
    let arrive: (response: Response) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { arrive = resolve; }));
    const fetching = fetchPhoto("a1b2c3d4-far");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await clearAllPhotos();
    arrive(new Response(new Uint8Array([0xff, 0xd8, 0xff, 7]), { status: 200 }));
    await fetching;
    expect(await getLocalPhoto("a1b2c3d4-far")).toBeNull();
  });
});

describe("one photo, one order of events", () => {
  it("removing a photo whose upload is still on its way removes it after the upload, not before", async () => {
    pair();
    await putLocalPhoto("a1b2c3d4-one", jpeg());
    let finish: (response: Response) => void = () => {};
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { finish = resolve; }));
    const uploading = sharePhoto("a1b2c3d4-one");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const removing = forgetPhoto("a1b2c3d4-one");
    // Give the removal every chance to overtake the upload.
    await new Promise((resolve) => setTimeout(resolve, 20));
    // The DELETE must not overtake the PUT, or the PUT lands after it and
    // the photo is back in the bucket with nothing pointing at it.
    expect(fetchMock).toHaveBeenCalledTimes(1);
    finish(new Response("{}", { status: 200 }));
    await uploading;
    await removing;
    expect(fetchMock.mock.calls.map((call) => call[1].method)).toEqual(["PUT", "DELETE"]);
  });

  it("two flushes at once send each photo once", async () => {
    pair();
    await putLocalPhoto("a1b2c3d4-two", jpeg());
    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    await sharePhoto("a1b2c3d4-two");
    fetchMock.mockClear();
    await Promise.all([flushPhotoQueue(), flushPhotoQueue()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("joining a family", () => {
  it("sends the photos this phone already has to the family it joins", async () => {
    // A phone that switches families brings its log — and its photos must
    // follow into the new family's space, not stay in the old one.
    await putLocalPhoto("a1b2c3d4-one", jpeg());
    queuePhotos(["a1b2c3d4-one", "a1b2c3d4-gone"]);
    pair();
    await flushPhotoQueue();
    // A photo this phone does not hold is skipped, not an error.
    expect(fetchMock.mock.calls.map((call) => call[0])).toEqual(["/api/photos/a1b2c3d4-one"]);
  });
});
