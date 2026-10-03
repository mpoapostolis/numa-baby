/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "@/App";
import { seedLog, stubBrowser } from "./appHarness";

// Asked for from the feedback box: "log manually the time just in case I miss
// to press the buttons for sleep or feed". A sleep started twenty minutes
// late, or a Wake up never pressed, could only be put right by finding the
// entry again in the log. The running tile's own start time is the way in.

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  stubBrowser();
});

test("a running sleep's start time opens it for editing", async () => {
  const startedAt = new Date(Date.now() - 25 * 60_000).toISOString();
  seedLog([{ id: "nap", type: "sleep", startedAt }]);
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: /Started .* · Edit/ }));

  expect(await screen.findByText("Edit log")).toBeTruthy();
  // Started can move back; Ended is where the missed Wake up goes.
  expect(screen.getByLabelText("Started")).toBeTruthy();
  expect(screen.getByLabelText("Ended")).toBeTruthy();
});

test("the way to log a missed one says what it is for", async () => {
  // "Past" sat grey in the tile's corner and a parent on the current build
  // asked for the very feature it opens.
  seedLog();
  render(<App />);

  for (const name of [
    "Add a completed nursing session manually",
    "Log a diaper change at a different time",
    "Add a sleep that has already finished",
  ]) {
    expect((await screen.findByRole("button", { name })).textContent).toBe("Earlier");
  }
});
