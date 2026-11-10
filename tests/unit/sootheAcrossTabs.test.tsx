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

  // The player is a lazy chunk: on a busy CI runner it can take longer than
  // the default second to arrive.
  fireEvent.click(await screen.findByRole("button", { name: /Sounds/ }, { timeout: 5_000 }));
  fireEvent.click(await screen.findByRole("button", { name: /^Play$/ }, { timeout: 5_000 }));
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
}, 15_000);
