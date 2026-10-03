/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
