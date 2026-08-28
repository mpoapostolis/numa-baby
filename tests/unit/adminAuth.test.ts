// The lock on /admin, tested where it can be tested without a database: the
// lockout policy, which is pure, and which is the part where a quiet mistake
// would be invisible until somebody walked in.

import { describe, expect, it } from "vitest";
import {
  ATTEMPT_WINDOW_MS,
  BASE_LOCK_MS,
  ipAllowed,
  lockDurationMs,
  MAX_LOCK_MS,
  timingSafeEqual,
  windowFloor,
} from "../../worker/adminAuth";

describe("lockout policy", () => {
  it("starts an address at a quarter of an hour", () => {
    expect(lockDurationMs(0, true)).toBe(BASE_LOCK_MS);
  });

  it("doubles the wait every time the same address comes back", () => {
    expect([1, 2, 3].map((strikes) => lockDurationMs(strikes, true))).toEqual([
      BASE_LOCK_MS * 2,
      BASE_LOCK_MS * 4,
      BASE_LOCK_MS * 8,
    ]);
  });

  it("never lets the wait run past a day", () => {
    expect(lockDurationMs(40, true)).toBe(MAX_LOCK_MS);
  });

  it("keeps the shared lock flat, so a stranger cannot shut the owner out for a day", () => {
    // This is the lock an attacker could trigger deliberately. It must stay
    // small enough to be an inconvenience rather than a way in — or rather,
    // a way to keep the owner out.
    for (const strikes of [0, 1, 5, 100]) {
      expect(lockDurationMs(strikes, false)).toBe(BASE_LOCK_MS);
    }
  });

  it("forgives attempts older than the window", () => {
    const now = 1_700_000_000_000;
    expect(windowFloor(now)).toBe(now - ATTEMPT_WINDOW_MS);
  });
});

describe("timingSafeEqual", () => {
  it("is an equality test, whatever the lengths", () => {
    expect(timingSafeEqual("hunter2", "hunter2")).toBe(true);
    expect(timingSafeEqual("hunter2", "hunter3")).toBe(false);
    expect(timingSafeEqual("hunter2", "hunter22")).toBe(false);
    expect(timingSafeEqual("", "")).toBe(true);
  });
});

describe("ipAllowed", () => {
  it("lets everyone knock when no list is configured", () => {
    expect(ipAllowed(undefined, "1.2.3.4")).toBe(true);
    expect(ipAllowed("", "1.2.3.4")).toBe(true);
    expect(ipAllowed("   ", "1.2.3.4")).toBe(true);
  });

  it("admits only the listed addresses once one is", () => {
    expect(ipAllowed("1.2.3.4, 5.6.7.8", "5.6.7.8")).toBe(true);
    expect(ipAllowed("1.2.3.4, 5.6.7.8", "9.9.9.9")).toBe(false);
    // An unknown address must not slip through the gate by being unknown.
    expect(ipAllowed("1.2.3.4", "unknown")).toBe(false);
  });
});
