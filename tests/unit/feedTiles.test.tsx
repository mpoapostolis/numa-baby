/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "@/App";
import { STORAGE_KEY } from "@/hooks/useTrackerStore";
import type { FeedingMode } from "@/domain/types";
import { seedLog, stubBrowser } from "./appHarness";

// "Nursing button is still missing" — from a parent who had picked Bottle on
// the first day. The choice used to hide the other tile altogether, and the
// way back was three screens deep. Now both are always on Today; the choice
// only decides which comes first.

beforeEach(() => {
  stubBrowser();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function seed(feedingMode: FeedingMode) {
  seedLog([{ id: "b", type: "bottle", amount: 120, startedAt: new Date(Date.now() - 3_600_000).toISOString() }]);
  const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
  saved.profile.feedingMode = feedingMode;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

async function feedTiles() {
  return waitFor(() => {
    const tiles = [...document.querySelectorAll(".quick-grid > .quick-tile")].map((tile) => tile.className);
    if (!tiles.length) throw new Error("not on Today yet");
    return tiles;
  }, { timeout: 5_000 });
}

test.each(["bottle", "breast", "mixed"] as const)("with %s chosen, Bottle and Nursing are both on Today", async (mode) => {
  seed(mode);
  render(<App />);
  await feedTiles();
  expect(screen.getByRole("button", { name: /Log 120 millilitres|Log a bottle/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /Start nursing timer on the left side/ })).toBeTruthy();
  expect(screen.getByRole("button", { name: /Start nursing timer on the right side/ })).toBeTruthy();
}, 15_000);

test("breastfeeding puts Nursing first; otherwise Bottle leads", async () => {
  seed("breast");
  render(<App />);
  const breast = await feedTiles();
  expect(breast.findIndex((c) => c.includes("tile-nurse"))).toBeLessThan(breast.findIndex((c) => c.includes("tile-bottle")));
  cleanup();

  seed("bottle");
  render(<App />);
  const bottle = await feedTiles();
  expect(bottle.findIndex((c) => c.includes("tile-bottle"))).toBeLessThan(bottle.findIndex((c) => c.includes("tile-nurse")));
}, 20_000);
