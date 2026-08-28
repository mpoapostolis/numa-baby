// The lock on /admin, tested where it can be tested without a database: the
// one-time codes and the lockout policy. Both are pure, and both are the
// parts where a quiet mistake would be invisible until someone walked in.

import { describe, expect, it } from "vitest";
import {
  ATTEMPT_WINDOW_MS,
  BASE_LOCK_MS,
  base32Decode,
  ipAllowed,
  lockDurationMs,
  MAX_LOCK_MS,
  timingSafeEqual,
  totpCode,
  verifyTotp,
  windowFloor,
} from "../../worker/adminAuth";

// RFC 6238's own key: the ASCII digits 1..0 repeated, twenty bytes.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

describe("base32Decode", () => {
  it("decodes the RFC secret to twenty bytes of ASCII digits", () => {
    const bytes = base32Decode(RFC_SECRET);
    expect(bytes).not.toBeNull();
    expect(new TextDecoder().decode(bytes!)).toBe("12345678901234567890");
  });

  it("tolerates how an authenticator app prints a secret", () => {
    const spaced = base32Decode("gezd gnbv gy3t qojq GEZDGNBVGY3TQOJQ==");
    expect(spaced).not.toBeNull();
    expect([...spaced!]).toEqual([...base32Decode(RFC_SECRET)!]);
  });

  it("refuses anything that is not base32", () => {
    expect(base32Decode("not-base32!")).toBeNull();
    expect(base32Decode("")).toBeNull();
  });
});

describe("totpCode", () => {
  // The published SHA-1 vectors, truncated to the six digits we show.
  const vectors: Array<[number, string]> = [
    [59, "287082"],
    [1111111109, "081804"],
    [1234567890, "005924"],
    [2000000000, "279037"],
    [20000000000, "353130"],
  ];

  for (const [seconds, expected] of vectors) {
    it(`matches the RFC vector at T=${seconds}`, async () => {
      expect(await totpCode(RFC_SECRET, Math.floor(seconds / 30))).toBe(expected);
    });
  }

  it("returns null rather than a code for an unusable secret", async () => {
    expect(await totpCode("!!!", 1)).toBeNull();
  });
});

describe("verifyTotp", () => {
  const at = (seconds: number) => seconds * 1000;

  it("accepts the code for the current window", async () => {
    expect(await verifyTotp(RFC_SECRET, "287082", at(59))).toBe(1);
  });

  it("accepts one window either side, for a slow phone or a slow thumb", async () => {
    // 287082 belongs to counter 1, so it is still good at counter 0 and 2.
    expect(await verifyTotp(RFC_SECRET, "287082", at(29))).toBe(1);
    expect(await verifyTotp(RFC_SECRET, "287082", at(89))).toBe(1);
  });

  it("refuses a code two windows old", async () => {
    expect(await verifyTotp(RFC_SECRET, "287082", at(150))).toBeNull();
  });

  it("refuses anything that is not six digits", async () => {
    expect(await verifyTotp(RFC_SECRET, "28708", at(59))).toBeNull();
    expect(await verifyTotp(RFC_SECRET, "", at(59))).toBeNull();
    expect(await verifyTotp(RFC_SECRET, "abcdef", at(59))).toBeNull();
  });
});

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
