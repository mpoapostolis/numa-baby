import { describe, expect, it } from "vitest";
import qrcode from "qrcode-generator";
import { JOIN_CODE_PATTERN, inviteLink } from "@/domain/familyPairing";
import { matrixFromPath, qrPath } from "@/domain/qrPath";

// The QR is the whole pairing flow for most people: if the link is wrong or
// the code will not encode, the partner's phone simply does nothing.

const ORIGIN = "https://numa-baby.mpoapostolis.workers.dev";

describe("inviteLink", () => {
  it("carries the code in the hash, not the query string", () => {
    const link = inviteLink(ORIGIN, "849164");
    expect(link).toContain("#join=849164");
    expect(link).not.toContain("?");
  });

  it("stays on the origin it is given", () => {
    expect(inviteLink(ORIGIN, "123456").startsWith(ORIGIN)).toBe(true);
    expect(inviteLink("http://localhost:3000", "123456")).toBe("http://localhost:3000/#join=123456");
  });
});

describe("the invite QR", () => {
  it("encodes a full invite link at error-correction M", () => {
    const qr = qrcode(0, "M");
    qr.addData(inviteLink(ORIGIN, "849164"));
    expect(() => qr.make()).not.toThrow();
    // A version the phone camera reads comfortably at 176px.
    expect(qr.getModuleCount()).toBeLessThanOrEqual(45);
    expect(qr.getModuleCount()).toBeGreaterThan(20);
  });

  it("round-trips every digit pattern through the link and back", () => {
    for (const code of ["000000", "849164", "999999", "100000"]) {
      const match = JOIN_CODE_PATTERN.exec(new URL(inviteLink(ORIGIN, code)).hash);
      expect(match?.[1]).toBe(code);
    }
  });

  it("ignores a hash that is not a six-digit join code", () => {
    for (const hash of ["#join=12345", "#join=abcdef", "#today", "", "#join="]) {
      expect(JOIN_CODE_PATTERN.test(hash)).toBe(false);
    }
  });
});

describe("qrPath", () => {
  it("draws exactly the modules the encoder marked dark", () => {
    const qr = qrcode(0, "M");
    qr.addData(inviteLink(ORIGIN, "849164"));
    qr.make();
    const count = qr.getModuleCount();
    const path = qrPath((row, col) => qr.isDark(row, col), count, 4);
    const drawn = matrixFromPath(path, count, 4);

    let dark = 0;
    for (let row = 0; row < count; row++) {
      for (let col = 0; col < count; col++) {
        expect(drawn[row][col]).toBe(qr.isDark(row, col));
        if (qr.isDark(row, col)) dark += 1;
      }
    }
    // Sanity: a real code is roughly half dark, never blank or solid.
    expect(dark).toBeGreaterThan(count * count * 0.25);
    expect(dark).toBeLessThan(count * count * 0.75);
  });

  it("keeps the three finder patterns intact through the merge", () => {
    const qr = qrcode(0, "M");
    qr.addData(inviteLink(ORIGIN, "123456"));
    qr.make();
    const count = qr.getModuleCount();
    const drawn = matrixFromPath(qrPath((r, c) => qr.isDark(r, c), count, 4), count, 4);
    // Each finder is a 7x7 block whose outer ring is dark and whose ring at
    // inset 1 is light. Checking one cell of each is enough to catch an
    // off-by-one in the run merge.
    for (const [row, col] of [[0, 0], [0, count - 7], [count - 7, 0]]) {
      expect(drawn[row][col]).toBe(true);
      expect(drawn[row + 1][col + 1]).toBe(false);
      expect(drawn[row + 3][col + 3]).toBe(true);
    }
  });

  it("offsets every module by the quiet zone", () => {
    const path = qrPath((row, col) => row === 0 && col === 0, 1, 4);
    expect(path).toBe("M4 4h1v1h-1z");
  });
});
