/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

// jsdom has no canvas; compression is the browser's job and is checked there.
vi.mock("@/lib/photos", async (original) => {
  const real = await original<typeof import("@/lib/photos")>();
  return {
    ...real,
    compressPhoto: vi.fn(async () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 9])], { type: "image/jpeg" })),
  };
});

import { PhotoField } from "@/components/PhotoField";
import { getLocalPhoto } from "@/lib/photos";

beforeEach(() => {
  window.localStorage.clear();
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => cleanup());

test("choosing a photo keeps it on the phone and hands back its id", async () => {
  const onChange = vi.fn();
  render(<PhotoField label="Photo" photoId={undefined} onChange={onChange} />);

  const input = screen.getByLabelText(/Add a photo/i) as HTMLInputElement;
  const file = new File([new Uint8Array([1, 2, 3])], "IMG_0001.HEIC", { type: "image/heic" });
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });

  await waitFor(() => expect(onChange).toHaveBeenCalled());
  const id = onChange.mock.calls[0][0] as string;
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  expect(await getLocalPhoto(id)).not.toBeNull();
});

test("a chosen photo can be removed", async () => {
  const onChange = vi.fn();
  render(<PhotoField label="Photo" photoId="a1b2c3d4-existing" onChange={onChange} />);
  fireEvent.click(await screen.findByRole("button", { name: /Remove photo/i }));
  expect(onChange).toHaveBeenCalledWith(undefined);
});

test("the form is told while a photo is still being prepared", async () => {
  const onBusyChange = vi.fn();
  render(<PhotoField label="Photo" photoId={undefined} onChange={() => {}} onBusyChange={onBusyChange} />);
  const input = screen.getByLabelText(/Add a photo/i) as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { files: [new File([new Uint8Array([1])], "a.jpg", { type: "image/jpeg" })] } });
  });
  await waitFor(() => expect(onBusyChange).toHaveBeenLastCalledWith(false));
  expect(onBusyChange).toHaveBeenCalledWith(true);
});
