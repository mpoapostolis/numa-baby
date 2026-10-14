/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

vi.mock("@/lib/photos", async (original) => {
  const real = await original<typeof import("@/lib/photos")>();
  return {
    ...real,
    compressPhoto: vi.fn(async () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 9])], { type: "image/jpeg" })),
  };
});

import { PhotoField } from "@/components/PhotoField";
import { compressPhoto, getLocalPhoto } from "@/lib/photos";
import { STORAGE_KEY } from "@/hooks/useTrackerStore";

// A photo picked and then abandoned — the sheet closed without Save, or
// another photo picked over it — is not kept on the phone for ever.

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ activities: [], profile: { name: "Mia", birthDate: "", feedingMode: "mixed" } }));
  URL.createObjectURL = vi.fn(() => "blob:x");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => cleanup());

async function pick(input: HTMLInputElement, chosen: () => string | undefined, before?: string) {
  await act(async () => {
    fireEvent.change(input, { target: { files: [new File([new Uint8Array([1])], "a.jpg", { type: "image/jpeg" })] } });
  });
  // Preparing is asynchronous: wait for the field to hand back a new id.
  await waitFor(() => expect(chosen() && chosen() !== before).toBe(true));
}

test("a photo picked over another lets the first one go", async () => {
  let current: string | undefined;
  const { rerender } = render(<PhotoField label="Photo" photoId={current} onChange={(id) => { current = id; }} />);
  await pick(screen.getByLabelText(/Add a photo/i) as HTMLInputElement, () => current);
  const first = current!;
  rerender(<PhotoField label="Photo" photoId={current} onChange={(id) => { current = id; }} />);
  await pick(screen.getByLabelText(/Change photo/i) as HTMLInputElement, () => current, first);
  expect(current).not.toBe(first);
  await waitFor(async () => expect(await getLocalPhoto(first)).toBeNull());
});

test("closing without saving lets the picked photo go", async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  let current: string | undefined;
  const view = render(<PhotoField label="Photo" photoId={current} onChange={(id) => { current = id; }} />);
  await pick(screen.getByLabelText(/Add a photo/i) as HTMLInputElement, () => current);
  const picked = current!;
  expect(picked).toBeTruthy();
  expect(await getLocalPhoto(picked)).not.toBeNull();
  view.unmount();
  await act(async () => { await vi.advanceTimersByTimeAsync(3_000); });
  vi.useRealTimers();
  await waitFor(async () => expect(await getLocalPhoto(picked)).toBeNull());
});

/** Every photo kept on this phone, by id. */
function storedIds(): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open("numalog-photos");
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const db = open.result;
      if (!db.objectStoreNames.contains("photos")) {
        db.close();
        resolve([]);
        return;
      }
      const keys = db.transaction("photos", "readonly").objectStore("photos").getAllKeys();
      keys.onsuccess = () => {
        db.close();
        resolve(keys.result as string[]);
      };
      keys.onerror = () => reject(keys.error);
    };
  });
}

test("closing the sheet while a photo is still being prepared keeps nothing", async () => {
  const before = await storedIds();
  let finish: (blob: Blob) => void = () => {};
  vi.mocked(compressPhoto).mockImplementationOnce(() => new Promise<Blob>((resolve) => { finish = resolve; }));
  const onChange = vi.fn();
  const view = render(<PhotoField label="Photo" photoId={undefined} onChange={onChange} />);
  await act(async () => {
    fireEvent.change(screen.getByLabelText(/Add a photo/i), { target: { files: [new File([new Uint8Array([1])], "a.jpg", { type: "image/jpeg" })] } });
  });
  view.unmount();
  finish(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 5])], { type: "image/jpeg" }));
  await new Promise((resolve) => setTimeout(resolve, 100));
  expect(onChange).not.toHaveBeenCalled();
  expect(await storedIds()).toEqual(before);
});
