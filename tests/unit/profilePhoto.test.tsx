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

import App from "@/App";
import { compressPhoto } from "@/lib/photos";
import { STORAGE_KEY } from "@/hooks/useTrackerStore";
import { seedLog, stubBrowser } from "./appHarness";

// Asked for from the feedback box: "upload their pictures in profile".

beforeEach(() => {
  seedLog();
  stubBrowser();
  URL.createObjectURL = vi.fn(() => "blob:baby");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("a photo chosen in the baby profile becomes the baby's picture", async () => {
  render(<App />);
  const open = await waitFor(() => {
    const button = document.querySelector<HTMLButtonElement>('button[aria-label="Baby profile"]');
    if (!button) throw new Error("no profile button yet");
    return button;
  }, { timeout: 5_000 });
  await act(async () => fireEvent.click(open));

  const input = (await screen.findByLabelText(/Add a photo/i)) as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { files: [new File([new Uint8Array([1])], "baby.jpg", { type: "image/jpeg" })] } });
  });
  await screen.findByRole("button", { name: /Remove photo/i });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save profile" })));

  const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!) as { profile: { photo?: string } };
  expect(stored.profile.photo).toMatch(/^[0-9a-f-]{36}$/);
  await waitFor(() => expect(document.querySelector('.baby-avatar img[src="blob:baby"]')).not.toBeNull());
});

// A name typed while the photo is still being prepared is the name saved:
// the photo arriving afterwards does not put the old one back.
test("typing while the photo is prepared is not undone when it arrives", async () => {
  let finish: (blob: Blob) => void = () => {};
  vi.mocked(compressPhoto).mockImplementationOnce(() => new Promise<Blob>((resolve) => { finish = resolve; }));
  render(<App />);
  const open = await waitFor(() => {
    const button = document.querySelector<HTMLButtonElement>('button[aria-label="Baby profile"]');
    if (!button) throw new Error("no profile button yet");
    return button;
  }, { timeout: 5_000 });
  await act(async () => fireEvent.click(open));
  const input = (await screen.findByLabelText(/Add a photo/i)) as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { files: [new File([new Uint8Array([1])], "baby.jpg", { type: "image/jpeg" })] } });
  });
  const name = screen.getByLabelText("Name") as HTMLInputElement;
  fireEvent.change(name, { target: { value: "Mia Rose" } });
  await act(async () => {
    finish(new Blob([new Uint8Array([0xff, 0xd8, 0xff, 7])], { type: "image/jpeg" }));
  });
  await screen.findByRole("button", { name: /Remove photo/i });
  expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Mia Rose");
}, 15_000);
