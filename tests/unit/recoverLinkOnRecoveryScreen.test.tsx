/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { STORAGE_KEY } from "@/hooks/useTrackerStore";
import { stubBrowser } from "./appHarness";

// The recovery screen offers "Email me a link" — and the link it sent was
// thrown away when tapped, because a tap on the recovery screen only got a
// toast. The link is read once, at module load, so App is imported fresh.

beforeEach(() => {
  stubBrowser();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, "", "/");
});

test("a recovery link tapped on the recovery screen asks to restore", async () => {
  window.localStorage.clear();
  window.localStorage.setItem(STORAGE_KEY, "{not json");
  window.history.replaceState(null, "", `/#recover=${"ab12".repeat(8)}`);
  vi.resetModules();
  const { default: App } = await import("@/App");
  render(<App />);

  expect(await screen.findByText(/Restore your log on this phone\?/, undefined, { timeout: 5_000 })).toBeTruthy();
  // The card's own advice, within reach while the dialog covers it.
  expect(screen.getByRole("button", { name: "Download the saved copy first" })).toBeTruthy();
  // Nothing is restored, and nothing overwritten, until a tap.
  expect(window.localStorage.getItem(STORAGE_KEY)).toBe("{not json");
}, 15_000);
