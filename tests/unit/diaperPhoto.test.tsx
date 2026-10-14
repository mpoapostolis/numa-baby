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
import { STORAGE_KEY } from "@/hooks/useTrackerStore";
import { Activity } from "@/domain/types";
import { seedLog, stubBrowser } from "./appHarness";

// Asked for from the feedback box: "when we log or put notes on the diaper
// changes, we can also attach photos of anything unusual".

beforeEach(() => {
  seedLog();
  stubBrowser();
  URL.createObjectURL = vi.fn(() => "blob:nappy");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("a nappy logged with a photo keeps it, and says so in the list", async () => {
  render(<App />);
  const earlier = await waitFor(() => {
    const button = document.querySelector<HTMLButtonElement>('button[aria-label="Log a diaper change at a different time"]');
    if (!button) throw new Error("no diaper tile yet");
    return button;
  }, { timeout: 5_000 });
  await act(async () => fireEvent.click(earlier));

  const input = (await screen.findByLabelText(/Add a photo/i)) as HTMLInputElement;
  await act(async () => {
    fireEvent.change(input, { target: { files: [new File([new Uint8Array([1])], "nappy.jpg", { type: "image/jpeg" })] } });
  });
  await screen.findByRole("button", { name: /Remove photo/i });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: /Save wet diaper/i })));

  const rows = (JSON.parse(window.localStorage.getItem(STORAGE_KEY)!) as { activities: Activity[] }).activities;
  expect(rows[0].type).toBe("diaper");
  expect(rows[0].photo).toMatch(/^[0-9a-f-]{36}$/);
  await waitFor(() => expect(document.querySelector('[aria-label="Has a photo"]')).not.toBeNull());
});
