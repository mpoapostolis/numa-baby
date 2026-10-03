/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "@/App";
import { seedLog, stubBrowser } from "./appHarness";

// Asked for from the feedback box: "if we can have the sound continuous". The
// player lived inside the Today screen, and Today unmounts when another tab
// opens — so checking the timeline for the last feed silenced the white noise
// a baby was falling asleep to.

let pause: ReturnType<typeof vi.fn>;

beforeEach(() => {
  seedLog();
  ({ pause } = stubBrowser());
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("the white noise keeps playing when another tab opens", async () => {
  render(<App />);

  fireEvent.click(await screen.findByRole("button", { name: /Sounds/ }));
  fireEvent.click(await screen.findByRole("button", { name: /^Play$/ }));
  // Close the player: the parent goes back to the app with the noise on.
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

  const audio = document.querySelector("audio");
  expect(audio).not.toBeNull();
  pause.mockClear();

  await act(async () => {
    fireEvent.click(screen.getAllByRole("button", { name: /Timeline/ })[0]);
  });

  expect(pause).not.toHaveBeenCalled();
  expect(audio!.isConnected).toBe(true);
});
