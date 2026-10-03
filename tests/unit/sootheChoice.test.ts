/** @vitest-environment jsdom */
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { DEFAULT_SOOTHE_CHOICE, loadSootheChoice, saveSootheChoice } from "@/domain/soothe";

// "Keep going" was a choice made again every night: the player opened at 30
// minutes each time, so a parent who wanted the noise all night had it stop
// under them unless they remembered. What was last played is remembered on
// the phone. The volume is not — it always opens low, on purpose.

beforeEach(() => window.localStorage.clear());
afterEach(() => vi.restoreAllMocks());

test("a phone that never played anything opens at the defaults", () => {
  expect(loadSootheChoice()).toEqual(DEFAULT_SOOTHE_CHOICE);
  expect(DEFAULT_SOOTHE_CHOICE.timer).toBe(30);
});

test("keep going, and the sound it went with, come back next time", () => {
  saveSootheChoice({ mode: "lullaby", kind: "pink", tune: "twinkle", timer: null });
  expect(loadSootheChoice()).toEqual({ mode: "lullaby", kind: "pink", tune: "twinkle", timer: null });
});

test("a timed choice comes back as that timer", () => {
  saveSootheChoice({ ...DEFAULT_SOOTHE_CHOICE, timer: 60 });
  expect(loadSootheChoice().timer).toBe(60);
});

test("anything unrecognised falls back to its default, one field at a time", () => {
  window.localStorage.setItem("numalog-soothe-v1", JSON.stringify({
    mode: "noise",
    kind: "purple",
    tune: "twinkle",
    timer: 17,
  }));
  expect(loadSootheChoice()).toEqual({ ...DEFAULT_SOOTHE_CHOICE, tune: "twinkle" });

  window.localStorage.setItem("numalog-soothe-v1", "{not json");
  expect(loadSootheChoice()).toEqual(DEFAULT_SOOTHE_CHOICE);
});

test("storage that refuses is a missing memory, not a broken player", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("SecurityError");
  });
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("QuotaExceededError");
  });
  expect(() => saveSootheChoice({ ...DEFAULT_SOOTHE_CHOICE, timer: null })).not.toThrow();
  expect(loadSootheChoice()).toEqual(DEFAULT_SOOTHE_CHOICE);
});
