/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { SoothePlayer } from "@/components/SoothePlayer";
import { loadSootheChoice, saveSootheChoice } from "@/domain/soothe";

beforeEach(() => {
  window.localStorage.clear();
  // jsdom has no media pipeline.
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

test("the player opens on what was played last", () => {
  saveSootheChoice({ mode: "noise", kind: "pink", tune: "brahms", timer: null });
  render(<SoothePlayer open onOpenChange={() => {}} />);

  expect(screen.getByRole("button", { name: "Keep going" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "30m" }).getAttribute("aria-pressed")).toBe("false");
  expect(screen.getByRole("radio", { name: /Rain/ }).getAttribute("aria-checked")).toBe("true");
});

test("pressing Play remembers the choice for next time", () => {
  render(<SoothePlayer open onOpenChange={() => {}} />);

  fireEvent.click(screen.getByRole("button", { name: "Lullabies" }));
  fireEvent.click(screen.getByRole("radio", { name: /Twinkle/ }));
  fireEvent.click(screen.getByRole("button", { name: "Keep going" }));
  fireEvent.click(screen.getByRole("button", { name: /^Play$/ }));

  expect(loadSootheChoice()).toEqual({ mode: "lullaby", kind: "brown", tune: "twinkle", timer: null });
});

// Changing the timer while it plays. The buttons used to change only what the
// NEXT play would use, while the highlighted one said otherwise: "Keep going"
// picked mid-play still stopped at 30 minutes, and a timer picked over
// "Keep going" ran all night.
test("a timer picked while it plays is the one this play stops on", () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "Date"] });
  try {
    const pause = vi.mocked(HTMLMediaElement.prototype.pause);
    render(<SoothePlayer open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /^Play$/ }));
    fireEvent.click(screen.getByRole("button", { name: "Keep going" }));

    act(() => { vi.advanceTimersByTime(31 * 60_000); });
    expect(pause).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^Stop$/ })).toBeTruthy();
    expect(loadSootheChoice().timer).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "15m" }));
    expect(screen.getByRole("button", { name: /Stop · 15:00 left/ })).toBeTruthy();
    expect(loadSootheChoice().timer).toBe(15);
    act(() => { vi.advanceTimersByTime(15 * 60_000 + 1_000); });
    expect(pause).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /^Play$/ })).toBeTruthy();
  } finally {
    vi.useRealTimers();
  }
});

// The lock-screen buttons were bound once, at the first Play, to that
// render's start(): pause then play from the lock screen put the volume back
// to what it was then — louder, in a dark room, if it had been turned down.
test("lock-screen pause and play keep the volume it was turned down to", () => {
  const handlers: Record<string, () => void> = {};
  Object.defineProperty(navigator, "mediaSession", {
    configurable: true,
    value: { metadata: null, setActionHandler: (action: string, handler: () => void) => { handlers[action] = handler; } },
  });
  vi.stubGlobal("MediaMetadata", class { constructor(public init: unknown) {} });
  try {
    render(<SoothePlayer open onOpenChange={() => {}} />);
    const audio = document.querySelector("audio")!;
    fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "0.8" } });
    fireEvent.click(screen.getByRole("button", { name: /^Play$/ }));
    fireEvent.change(screen.getByLabelText("Volume"), { target: { value: "0.1" } });

    act(() => handlers.pause());
    act(() => handlers.play());
    expect(audio.volume).toBeCloseTo(0.1);
  } finally {
    Reflect.deleteProperty(navigator, "mediaSession");
    vi.unstubAllGlobals();
  }
});

// A call or a voice note pauses the element without asking. The panel went on
// saying "Stop", with the "No sound?" hint, over silence.
test("the button follows the sound when the phone pauses it", () => {
  render(<SoothePlayer open onOpenChange={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /^Play$/ }));
  const audio = document.querySelector("audio")!;

  act(() => { audio.dispatchEvent(new Event("pause")); });
  expect(screen.getByRole("button", { name: /^Play$/ })).toBeTruthy();
  expect(screen.queryByText(/No sound\?/)).toBeNull();

  // And when the phone gives the sound back, so does the button.
  act(() => { audio.dispatchEvent(new Event("play")); });
  expect(screen.getByRole("button", { name: /Stop/ })).toBeTruthy();
});

test("a pause does not reload the sound the phone may be about to resume", () => {
  const load = vi.mocked(HTMLMediaElement.prototype.load);
  render(<SoothePlayer open onOpenChange={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /^Play$/ }));
  load.mockClear();

  act(() => { document.querySelector("audio")!.dispatchEvent(new Event("pause")); });
  expect(load).not.toHaveBeenCalled();
});

// A call pauses the sound; the parent picks "Keep going" meanwhile. When the
// phone resumes it, the old 30-minute end must not stop it.
test("a timer picked while the phone has paused the sound is the one it keeps", () => {
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "setTimeout", "clearTimeout", "Date"] });
  try {
    const pause = vi.mocked(HTMLMediaElement.prototype.pause);
    saveSootheChoice({ mode: "noise", kind: "brown", tune: "brahms", timer: 30 });
    render(<SoothePlayer open onOpenChange={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /^Play$/ }));
    const audio = document.querySelector("audio")!;
    act(() => { audio.dispatchEvent(new Event("pause")); });
    fireEvent.click(screen.getByRole("button", { name: "Keep going" }));
    act(() => { audio.dispatchEvent(new Event("play")); });
    act(() => { vi.advanceTimersByTime(31 * 60_000); });
    expect(pause).not.toHaveBeenCalled();
    expect(loadSootheChoice().timer).toBeNull();
  } finally {
    vi.useRealTimers();
  }
});
