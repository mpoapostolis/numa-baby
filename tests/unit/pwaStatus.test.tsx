/** @vitest-environment jsdom */
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { PwaStatus } from "@/PwaStatus";

// An update is applied by reloading the page. It used to happen on any hide or
// show with a version waiting, so unlocking the phone to log a feed stopped
// the white noise, and a camera opened for a photo threw the half-written
// entry away. It now waits until nothing is in use.

const sw = vi.hoisted(() => ({
  updateSW: vi.fn<(reloadPage?: boolean) => Promise<void>>(async () => undefined),
  onNeedRefresh: () => {},
}));
const updateSW = sw.updateSW;
vi.mock("virtual:pwa-register", () => ({
  registerSW: (options: { onNeedRefresh: () => void }) => {
    sw.onNeedRefresh = options.onNeedRefresh;
    return sw.updateSW;
  },
}));

function setVisibility(state: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  act(() => { document.dispatchEvent(new Event("visibilitychange")); });
}

function playingAudio() {
  const audio = document.createElement("audio");
  Object.defineProperty(audio, "paused", { value: false, configurable: true });
  document.body.appendChild(audio);
  return audio;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"] });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  updateSW.mockClear();
  document.body.replaceChildren();
});

test("with the noise on, locking and unlocking leave the update waiting", () => {
  render(<PwaStatus />);
  vi.advanceTimersByTime(60_000);
  act(() => sw.onNeedRefresh());
  const audio = playingAudio();

  setVisibility("hidden");
  setVisibility("visible");
  expect(updateSW).not.toHaveBeenCalled();

  // The noise stopped: the next time the phone is put down, it lands.
  Object.defineProperty(audio, "paused", { value: true });
  setVisibility("hidden");
  expect(updateSW).toHaveBeenCalledWith(true);
});

test("an update found just after opening waits while a sheet is open", () => {
  render(<PwaStatus />);
  const sheet = document.createElement("div");
  sheet.setAttribute("role", "dialog");
  document.body.appendChild(sheet);

  vi.advanceTimersByTime(3_000);
  act(() => sw.onNeedRefresh());
  // The camera, opened for a photo, hides the page.
  setVisibility("hidden");
  expect(updateSW).not.toHaveBeenCalled();

  sheet.remove();
  setVisibility("visible");
  expect(updateSW).toHaveBeenCalledWith(true);
});

test("an idle app still takes an update while it is opening", () => {
  render(<PwaStatus />);
  vi.advanceTimersByTime(3_000);
  act(() => sw.onNeedRefresh());
  expect(updateSW).toHaveBeenCalledWith(true);
});
