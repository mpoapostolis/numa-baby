/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "@/App";
import { STORAGE_KEY } from "@/hooks/useTrackerStore";
import { Activity } from "@/domain/types";
import { stubBrowser } from "./appHarness";

// From the feedback box: Vitamin D logged under Medicine, then the daily list
// still asked for it, its tick made a second entry, and the Medicine row kept
// counting from the first one. One dose, whichever button gave it.

beforeEach(() => stubBrowser());
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function seed(activities: Activity[], routines = [{ id: "vitamin d", label: "Vitamin D" }]) {
  window.localStorage.clear();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    activities,
    profile: { name: "Mia", birthDate: "2026-09-01", feedingMode: "mixed", routines },
    nightMode: false,
    onboardingComplete: true,
  }));
}

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function medicineRow() {
  return waitFor(() => {
    const row = document.querySelector(".action-medicine");
    if (!row) throw new Error("no Medicine row yet");
    return row.textContent ?? "";
  }, { timeout: 5_000 });
}

test("Vitamin D given under Medicine is not asked for again on the daily list", async () => {
  // Earlier today, but never across midnight: the list counts calendar days.
  const minutes = Math.min(30, new Date().getHours() * 60 + new Date().getMinutes());
  seed(
    [{ id: "m1", type: "medicine", startedAt: ago(minutes), medicine: "vitamin D drops", note: "with milk" }],
    [{ id: "vitamin d", label: "Vitamin D" }, { id: "bath", label: "Bath" }],
  );
  render(<App />);
  expect(await medicineRow()).toContain("vitamin D drops");
  // The card is there, for the one not done yet; Vitamin D is not on it.
  await screen.findByRole("button", { name: "Mark Bath as done" }, { timeout: 5_000 });
  expect(screen.queryByRole("button", { name: "Mark Vitamin D as done" })).toBeNull();
}, 15_000);

test("Vitamin D ticked on the list counts on the Medicine row", async () => {
  seed([{ id: "m1", type: "medicine", startedAt: ago(26 * 60), medicine: "vitamin D drops" }]);
  render(<App />);
  const pill = await screen.findByRole("button", { name: "Mark Vitamin D as done" }, { timeout: 5_000 });
  expect(await medicineRow()).toContain("vitamin D drops · 26h ago");
  await act(async () => fireEvent.click(pill));
  await waitFor(() => expect(document.querySelector(".action-medicine")?.textContent).toContain("Vitamin D · 0m ago"));
}, 15_000);

test("a tick that is not a medicine the family logs stays off the Medicine row", async () => {
  window.localStorage.clear();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    activities: [
      { id: "m1", type: "medicine", startedAt: ago(26 * 60), medicine: "Paracetamol" },
      { id: "r1", type: "routine", routineId: "bath", note: "Bath", startedAt: ago(5) },
    ],
    profile: { name: "Mia", birthDate: "2026-09-01", feedingMode: "mixed", routines: [{ id: "bath", label: "Bath" }] },
    nightMode: false,
    onboardingComplete: true,
  }));
  render(<App />);
  expect(await medicineRow()).toContain("Paracetamol");
}, 15_000);
