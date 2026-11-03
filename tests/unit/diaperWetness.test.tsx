/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "@/App";
import { STORAGE_KEY } from "@/hooks/useTrackerStore";
import { activityTitle } from "@/domain/activityDisplay";
import { isValidActivity } from "@/domain/validate";
import { Activity } from "@/domain/types";
import { seedLog, stubBrowser } from "./appHarness";

// Light or heavy, for a wet nappy: one more tap after Wet on Today, or a
// choice on the diaper form. Never asked for, never in the way.

beforeEach(() => {
  seedLog();
  stubBrowser();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function stored() {
  return (JSON.parse(window.localStorage.getItem(STORAGE_KEY)!) as { activities: Activity[] }).activities;
}

async function tileButton(label: string) {
  return waitFor(() => {
    const found = document.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
    if (!found) throw new Error(`no ${label} yet`);
    return found;
  }, { timeout: 5_000 });
}

/** Found first, then clicked: inside act() React holds the render back, so a
    wait for a button in there never sees it appear. */
async function tap(target: HTMLElement | Promise<HTMLElement>) {
  const element = await target;
  await act(async () => fireEvent.click(element));
}

const at = new Date(Date.now() - 3_600_000).toISOString();
const nappy = (fields: Partial<Activity>): Activity => ({ id: "d1", type: "diaper", startedAt: at, ...fields });

test("the title says how wet, and only for a wet one", () => {
  expect(activityTitle(nappy({ diaperKind: "wet" }))).toBe("Wet diaper");
  expect(activityTitle(nappy({ diaperKind: "wet", wetness: "heavy" }))).toBe("Heavy wet diaper");
  expect(activityTitle(nappy({ diaperKind: "wet", wetness: "light" }))).toBe("Light wet diaper");
  expect(activityTitle(nappy({ diaperKind: "both", wetness: "heavy" }))).toBe("Heavy wet + dirty diaper");
  expect(activityTitle(nappy({ diaperKind: "dirty", wetness: "heavy" }))).toBe("Dirty diaper");
});

test("a wetness from a later build keeps the nappy, and reads as not said", () => {
  const later = { ...nappy({ diaperKind: "wet" }), wetness: "soaked" } as unknown as Activity;
  expect(isValidActivity(later)).toBe(true);
  expect(activityTitle(later)).toBe("Wet diaper");
});

test("after Wet on Today, Light or Heavy goes on that nappy, and a second tap takes it back", async () => {
  render(<App />);
  await tap(tileButton("Log wet diaper"));
  expect(stored()[0].wetness).toBeUndefined();

  const heavy = await tileButton("Heavy wet");
  expect(heavy.getAttribute("aria-pressed")).toBe("false");
  await tap(heavy);
  expect(stored()[0]).toMatchObject({ type: "diaper", diaperKind: "wet", wetness: "heavy" });
  await waitFor(() => expect((document.querySelector('button[aria-label="Heavy wet"]') as HTMLButtonElement).getAttribute("aria-pressed")).toBe("true"));

  // Changed mind: Light replaces Heavy.
  await tap(tileButton("Light wet"));
  expect(stored()[0].wetness).toBe("light");

  await tap(tileButton("Light wet"));
  expect("wetness" in stored()[0]).toBe(false);
  expect(stored()).toHaveLength(1);
}, 15_000);

test("after Dirty, the card does not ask how wet", async () => {
  render(<App />);
  await tap(tileButton("Log dirty diaper"));
  await waitFor(() => expect(document.querySelector(".tile-since")).not.toBeNull());
  expect(document.querySelector('button[aria-label="Heavy wet"]')).toBeNull();
}, 15_000);

test("the diaper form takes How wet, and drops it for a dirty one", async () => {
  render(<App />);
  await tap(tileButton("Log a diaper change at a different time"));
  await tap(screen.findByRole("radio", { name: "Heavy" }));
  await tap(screen.getByRole("button", { name: /Save wet diaper/i }));
  expect(stored()[0]).toMatchObject({ diaperKind: "wet", wetness: "heavy" });

  cleanup();
  seedLog();
  render(<App />);
  await tap(tileButton("Log a diaper change at a different time"));
  await tap(screen.findByRole("radio", { name: "Light" }));
  await tap(screen.getByRole("radio", { name: /Dirty/ }));
  expect(screen.queryByRole("radio", { name: "Light" })).toBeNull();
  await tap(screen.getByRole("button", { name: /Save dirty diaper/i }));
  expect(stored()[0].diaperKind).toBe("dirty");
  expect("wetness" in stored()[0]).toBe(false);
}, 20_000);

test("editing a nappy shows how wet it was, and can clear it", async () => {
  seedLog([nappy({ diaperKind: "wet", wetness: "heavy" })]);
  render(<App />);
  // Today's own list opens the entry's edit sheet, like the timeline does.
  const row = await waitFor(() => {
    const found = Array.from(document.querySelectorAll("button")).find((b) => /Heavy wet diaper/.test(b.textContent ?? ""));
    if (!found) throw new Error("no row yet");
    return found;
  }, { timeout: 5_000 });
  await tap(row);
  const heavy = await screen.findByRole("radio", { name: "Heavy" });
  expect(heavy.getAttribute("aria-checked")).toBe("true");
  await tap(heavy);
  await tap(screen.getByRole("button", { name: /^Save/ }));
  expect("wetness" in stored()[0]).toBe(false);
  expect(stored()[0].diaperKind).toBe("wet");
}, 15_000);
