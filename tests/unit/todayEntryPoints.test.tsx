/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "@/App";
import { seedLog, stubBrowser } from "./appHarness";
import { STORAGE_KEY } from "@/hooks/useTrackerStore";
import { monthsReached } from "@/domain/keepsakes";
import { Activity } from "@/domain/types";

// The way in to the month pages and the vaccinations is on Today, where the
// parents already are — a feature behind a grey corner chip is a feature a
// parent writes in to ask for.

const stamped = new Date(Date.now() - 86_400_000).toISOString();
const soon = new Date(Date.now() + 5 * 86_400_000);
const due = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, "0")}-${String(soon.getDate()).padStart(2, "0")}`;

beforeEach(() => {
  seedLog([
    { id: "v1", type: "vaccine", vaccine: "Pentavalent", dose: "2nd", planned: true, due, startedAt: stamped },
  ]);
  stubBrowser();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function row(name: RegExp) {
  return waitFor(() => {
    const found = Array.from(document.querySelectorAll("button")).find((b) => name.test(b.textContent ?? ""));
    if (!found) throw new Error("not on Today yet");
    return found;
  }, { timeout: 5_000 });
}

test("Today says which vaccine is next, and opens the vaccinations", async () => {
  render(<App />);
  const vaccines = await row(/^Vaccines/);
  expect(vaccines.textContent).toContain("Pentavalent");
  await act(async () => fireEvent.click(vaccines));
  expect(await screen.findByText("Mia’s vaccines")).toBeTruthy();
}, 15_000);

test("Today opens the month pages", async () => {
  render(<App />);
  const months = await row(/^Months/);
  await act(async () => fireEvent.click(months));
  expect(await screen.findByText("Mia’s months")).toBeTruthy();
}, 15_000);

/** A family whose baby is about three months old, with this log. */
function seedBabyOfThreeMonths(activities: Activity[] = []) {
  const born = new Date(Date.now() - 100 * 86_400_000);
  const birthDate = `${born.getFullYear()}-${String(born.getMonth() + 1).padStart(2, "0")}-${String(born.getDate()).padStart(2, "0")}`;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    activities,
    profile: { name: "Mia", birthDate, feedingMode: "mixed" },
    nightMode: false,
    onboardingComplete: true,
  }));
  return monthsReached(birthDate, Date.now())!;
}

// "We said god-tier UX — I can't tell where it is." The months are at the top
// of Today, under the baby's age, not eight rows down.
test("under the baby's age, Today asks for this month's photo and opens that month", async () => {
  const month = seedBabyOfThreeMonths();
  render(<App />);
  const pill = await row(new RegExp(`^Add the ${month}‑month photo$`));
  expect(pill.closest(".welcome-hero")).toBeTruthy();
  await act(async () => fireEvent.click(pill));
  expect(await screen.findByRole("button", { name: "Save this month" })).toBeTruthy();
  expect(screen.getByText(`${month} months`)).toBeTruthy();
}, 15_000);

test("once this month has its photo, the same place opens the album", async () => {
  const month = seedBabyOfThreeMonths();
  seedBabyOfThreeMonths([{ id: `month-${month}`, type: "month", month, photo: "3f2a9c1e-0b7d-4e55-9a1f-2c8d7e6b5a40", startedAt: stamped }]);
  render(<App />);
  const pill = await row(/^Mia’s months$/);
  await act(async () => fireEvent.click(pill));
  expect(await screen.findByRole("heading", { name: "Mia’s months" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Save this month" })).toBeNull();
}, 15_000);
