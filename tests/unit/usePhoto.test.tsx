/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const fetchPhoto = vi.fn();
vi.mock("@/lib/photos", () => ({ fetchPhoto: (id: string) => fetchPhoto(id) }));

import { usePhoto } from "@/hooks/usePhoto";

// The other parent's entry can arrive over sync a moment before its photo
// has finished uploading. The first look is then a miss — and must not be
// the last.

beforeEach(() => {
  vi.useFakeTimers();
  URL.createObjectURL = vi.fn(() => "blob:late");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  fetchPhoto.mockReset();
});

test("a photo that is not there yet is looked for again", async () => {
  fetchPhoto.mockResolvedValueOnce(null).mockResolvedValueOnce(new Blob([new Uint8Array([1])]));
  const { result } = renderHook(() => usePhoto("3f6c1d2e-late"));
  await act(async () => { await vi.advanceTimersByTimeAsync(10); });
  // Still looking: not yet "missing".
  expect(result.current).toBeUndefined();
  await act(async () => { await vi.advanceTimersByTimeAsync(20_000); });
  expect(result.current).toBe("blob:late");
  expect(fetchPhoto).toHaveBeenCalledTimes(2);
});

test("a photo still missing after the last retry is looked for again when the app comes back", async () => {
  fetchPhoto.mockResolvedValue(null);
  const { result } = renderHook(() => usePhoto("3f6c1d2e-later"));
  await act(async () => { await vi.advanceTimersByTimeAsync(20 * 60_000); });
  const tries = fetchPhoto.mock.calls.length;
  fetchPhoto.mockResolvedValueOnce(new Blob([new Uint8Array([1])]));
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
    await vi.advanceTimersByTimeAsync(10);
  });
  expect(fetchPhoto.mock.calls.length).toBe(tries + 1);
  expect(result.current).toBe("blob:late");
});

test("after the last retry the photo is said to be missing, not still loading", async () => {
  fetchPhoto.mockResolvedValue(null);
  const { result } = renderHook(() => usePhoto("3f6c1d2e-never"));
  await act(async () => { await vi.advanceTimersByTimeAsync(20 * 60_000); });
  expect(result.current).toBeNull();
});

test("coming back to the app during a download does not start a second one", async () => {
  let arrive: (blob: Blob) => void = () => {};
  fetchPhoto.mockImplementationOnce(() => new Promise<Blob>((resolve) => { arrive = resolve; }));
  const { unmount } = renderHook(() => usePhoto("3f6c1d2e-slow"));
  await act(async () => { await vi.advanceTimersByTimeAsync(10); });
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  document.dispatchEvent(new Event("visibilitychange"));
  expect(fetchPhoto).toHaveBeenCalledTimes(1);
  await act(async () => {
    arrive(new Blob([new Uint8Array([1])]));
    await vi.advanceTimersByTimeAsync(10);
  });
  unmount();
  // One URL made, and that one let go of.
  expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
  expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
});

test("coming back mid-schedule looks at once and keeps the looks that were left", async () => {
  fetchPhoto.mockResolvedValue(null);
  const { result } = renderHook(() => usePhoto("3f6c1d2e-mid"));
  await act(async () => { await vi.advanceTimersByTimeAsync(10); });
  Object.defineProperty(document, "hidden", { configurable: true, value: false });
  document.dispatchEvent(new Event("visibilitychange"));
  await act(async () => { await vi.advanceTimersByTimeAsync(10); });
  expect(fetchPhoto).toHaveBeenCalledTimes(2);
  // Not given up on: still "looking", and the schedule goes on.
  expect(result.current).toBeUndefined();
  fetchPhoto.mockResolvedValue(new Blob([new Uint8Array([1])]));
  await act(async () => { await vi.advanceTimersByTimeAsync(10 * 60_000); });
  expect(result.current).toBe("blob:late");
});
