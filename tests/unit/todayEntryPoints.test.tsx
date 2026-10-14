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

test("Today opens the monthly photos", async () => {
  render(<App />);
  const months = await row(/^Monthly photos/);
  await act(async () => fireEvent.click(months));
  expect(await screen.findByRole("heading", { name: "Mia’s monthly photos" })).toBeTruthy();
}, 15_000);

// A dose late or due this week is at the top of Today, beside the baby's
// age — where the testers looked for it — not only in the list below.
test("a vaccine due this week is named at the top of Today, and opens the vaccines", async () => {
  render(<App />);
  const pill = await row(/^Pentavalent vaccine · in 5 days$/);
  expect(pill.closest(".welcome-hero")).toBeTruthy();
  await act(async () => fireEvent.click(pill));
  expect(await screen.findByText("Mia’s vaccines")).toBeTruthy();
}, 15_000);

// The drawn face is where a parent looks for the baby's picture.
test("the baby's face at the top of Today opens the baby profile", async () => {
  render(<App />);
  const button = await waitFor(() => {
    const found = document.querySelector<HTMLButtonElement>(".welcome-hero button.welcome-face");
    if (!found) throw new Error("not on Today yet");
    return found;
  }, { timeout: 5_000 });
  expect(button.getAttribute("aria-label")).toBe("Mia’s profile and picture");
  await act(async () => fireEvent.click(button));
  expect(await screen.findByRole("heading", { name: "Baby profile" })).toBeTruthy();
}, 15_000);

/** A family whose baby turned three months old two days ago, with this log. */
function seedFreshThirdMonth(activities: Activity[] = []) {
  // Born on a day every month has, so the month-birthday is never clamped
  // out of this week, whatever day the test runs.
  const ref = new Date(Date.now() - 2 * 86_400_000);
  const born = new Date(ref.getFullYear(), ref.getMonth() - 3, Math.min(ref.getDate(), 28), 12);
  const birthDate = `${born.getFullYear()}-${String(born.getMonth() + 1).padStart(2, "0")}-${String(born.getDate()).padStart(2, "0")}`;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    activities,
    profile: { name: "Mia", birthDate, feedingMode: "mixed" },
    nightMode: false,
    onboardingComplete: true,
  }));
  return monthsReached(birthDate, Date.now())!;
}

// Beside the baby's age, always: the way into the monthly photos. Until this
// month has its photo it asks for it, and opens that month's page.
test("under the baby's age, Today asks for this month's photo and opens that month", async () => {
  const month = seedFreshThirdMonth();
  render(<App />);
  const pill = await row(new RegExp(`^Add the ${month}‑month photo$`));
  expect(pill.closest(".welcome-hero")).toBeTruthy();
  await act(async () => fireEvent.click(pill));
  expect(await screen.findByLabelText(/Add a photo/i)).toBeTruthy();
  expect(screen.getByText(`${month} months`)).toBeTruthy();
}, 15_000);

test("once that month has its photo, the same place opens the album", async () => {
  const month = seedFreshThirdMonth();
  seedFreshThirdMonth([{ id: `month-${month}`, type: "month", month, photo: "3f2a9c1e-0b7d-4e55-9a1f-2c8d7e6b5a40", startedAt: stamped }]);
  render(<App />);
  const pill = await row(/^Monthly photos$/);
  await act(async () => fireEvent.click(pill));
  expect(await screen.findByRole("heading", { name: "Mia’s monthly photos" })).toBeTruthy();
}, 15_000);

// Asked for from the feedback box: a photo of a nappy for the doctor. Right
// after Dirty, the Diaper card offers it — and not after Wet.
test("right after a dirty nappy, the Diaper card offers to add a photo of it", async () => {
  render(<App />);
  const dirty = await waitFor(() => {
    const found = document.querySelector<HTMLButtonElement>('button[aria-label="Log dirty diaper"]');
    if (!found) throw new Error("not on Today yet");
    return found;
  }, { timeout: 5_000 });
  await act(async () => fireEvent.click(dirty));
  const add = await row(/Add photo$/);
  await act(async () => fireEvent.click(add));
  expect(await screen.findByLabelText(/Add a photo/i)).toBeTruthy();
}, 15_000);

test("after a wet one, it does not", async () => {
  render(<App />);
  const wet = await waitFor(() => {
    const found = document.querySelector<HTMLButtonElement>('button[aria-label="Log wet diaper"]');
    if (!found) throw new Error("not on Today yet");
    return found;
  }, { timeout: 5_000 });
  await act(async () => fireEvent.click(wet));
  await waitFor(() => expect(document.querySelector(".tile-since")).not.toBeNull());
  expect(document.querySelector(".tile-since-photo")).toBeNull();
}, 15_000);
