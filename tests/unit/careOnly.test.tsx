/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "@/App";
import { seedLog, stubBrowser } from "./appHarness";

// A month's note and a vaccination live in the log but are not care. They
// must never appear among the feeds and nappies, nor count toward anything.

const now = new Date().toISOString();

beforeEach(() => {
  seedLog([
    { id: "month-1", type: "month", month: 1, startedAt: now, note: "First smile" },
    { id: "v1", type: "vaccine", vaccine: "BCG", place: "public", startedAt: now },
  ]);
  stubBrowser();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("the timeline holds care only", async () => {
  render(<App />);
  const tab = await waitFor(() => {
    const button = document.querySelector<HTMLButtonElement>('button[aria-label="Timeline"]');
    if (!button) throw new Error("no Timeline tab yet");
    return button;
  }, { timeout: 5_000 });
  await act(async () => fireEvent.click(tab));
  await waitFor(() => expect(document.querySelector(".timeline-screen, [aria-labelledby='timeline-heading']")).not.toBeNull(), { timeout: 5_000 });
  expect(document.body.textContent).not.toContain("First smile");
  expect(document.body.textContent).not.toContain("BCG");
});
