import { vi } from "vitest";
import { STORAGE_KEY } from "@/hooks/useTrackerStore";
import { Activity } from "@/domain/types";

// What the whole app needs from a browser that jsdom does not have: a media
// pipeline, layout and media queries. Call from beforeEach; undo with
// vi.restoreAllMocks().
export function stubBrowser() {
  const pause = vi.fn();
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(pause);
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
  globalThis.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  return { pause };
}

/** A family past onboarding, with this log on the phone. */
export function seedLog(activities: Activity[] = []) {
  window.localStorage.clear();
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
    activities,
    profile: { name: "Mia", birthDate: "2026-09-01", feedingMode: "mixed" },
    nightMode: false,
    onboardingComplete: true,
  }));
}
