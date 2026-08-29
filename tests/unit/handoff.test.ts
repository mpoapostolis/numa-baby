// Moving a log between two web addresses. The tests that matter are the ones
// about the address it must REFUSE to send to: this flow hands over a complete
// infant health record, and the only thing standing between that record and a
// stranger's server is the allowlist.

import { describe, expect, it } from "vitest";
import {
  DEVELOPMENT_ORIGINS,
  MAX_PAYLOAD_CHARS,
  PRODUCTION_ORIGINS,
  handoffPeers,
  handoffReturnUrl,
  handoffSendUrl,
  isAllowedTarget,
  packHandoff,
  readHandoffPayload,
  readHandoffTarget,
  unpackHandoff,
} from "@/domain/handoff";

const PROD = PRODUCTION_ORIGINS[0];
const DEV = DEVELOPMENT_ORIGINS[0];
const DEV_OTHER = DEVELOPMENT_ORIGINS[1];
// Stands in for the second address, the day one is bought.
const GOOD = DEV_OTHER;

describe("the allowlist", () => {
  it("lets two addresses in the same band exchange logs", () => {
    expect(isAllowedTarget(DEV, DEV_OTHER)).toBe(true);
    expect(isAllowedTarget(DEV_OTHER, DEV)).toBe(true);
  });

  it("refuses everything else, however close it looks", () => {
    for (const origin of [
      "https://evil.example",
      // A prefix match would let all three of these through.
      `${DEV_OTHER}.evil.example`,
      "https://numa-baby.mpoapostolis.workers.dev.evil.example",
      "",
    ]) {
      expect(isAllowedTarget(DEV, origin)).toBe(false);
    }
  });

  it("never sends a log to itself", () => {
    expect(isAllowedTarget(DEV, DEV)).toBe(false);
  });

  it("keeps the deployed app from handing a log to a machine's own localhost", () => {
    // The attack this closes: a link to PROD/handoff#to=http://localhost:3000
    // would otherwise send a family's records to whatever the victim happens
    // to be running on their own computer.
    for (const dev of DEVELOPMENT_ORIGINS) expect(isAllowedTarget(PROD, dev)).toBe(false);
    expect(isAllowedTarget(DEV, PROD)).toBe(false);
  });

  it("gives an unrecognised address nobody to talk to", () => {
    // A preview deployment, or somebody else's copy of the app.
    expect(isAllowedTarget("https://someone-elses-fork.example", PROD)).toBe(false);
    expect(handoffPeers("https://someone-elses-fork.example")).toEqual([]);
  });
});

describe("handoffPeers", () => {
  it("offers the other addresses in the same band, never this one", () => {
    expect(handoffPeers(DEV)).toEqual([DEV_OTHER]);
  });

  it("offers the app's other real address, and never a dev one", () => {
    // numalog.app was bought on 2026-08-29 and joined the production band, so
    // each production address offers exactly the other. What must still never
    // happen is a production build offering "localhost:3000" — that would be
    // nonsense on a stranger's phone, or worse, whatever is listening there.
    expect(handoffPeers(PROD)).toEqual(["https://numa-baby.mpoapostolis.workers.dev"]);
    expect(handoffPeers("https://numa-baby.mpoapostolis.workers.dev")).toEqual([PROD]);
  });
});

describe("readHandoffTarget", () => {
  it("reads an allowlisted origin", () => {
    expect(readHandoffTarget(`#to=${encodeURIComponent(GOOD)}`, DEV)).toBe(GOOD);
    // A URL with a path still resolves to its origin, and that is what is used.
    expect(readHandoffTarget(`#to=${encodeURIComponent(`${GOOD}/somewhere?a=1`)}`, DEV)).toBe(GOOD);
  });

  it("refuses the shapes that look like the real thing", () => {
    for (const value of [
      "https://evil.example",
      // Userinfo: everything before the @ is a username, not a host.
      `https://numa-baby.mpoapostolis.workers.dev@evil.example`,
      "https://numa-baby.mpoapostolis.workers.dev.evil.example",
      "javascript:alert(1)",
      "//numa-baby.mpoapostolis.workers.dev",
      "not a url",
    ]) {
      expect(readHandoffTarget(`#to=${encodeURIComponent(value)}`, DEV)).toBeNull();
    }
  });

  it("refuses a fragment with no target at all", () => {
    expect(readHandoffTarget("", DEV)).toBeNull();
    expect(readHandoffTarget("#", DEV)).toBeNull();
    expect(readHandoffTarget("#to=", DEV)).toBeNull();
    expect(readHandoffTarget("#something=else", DEV)).toBeNull();
  });

  it("is what handoffSendUrl produces", () => {
    const url = new URL(handoffSendUrl(DEV, GOOD));
    expect(url.pathname).toBe("/handoff");
    expect(readHandoffTarget(url.hash, DEV)).toBe(GOOD);
  });
});

describe("readHandoffPayload", () => {
  it("accepts base64url and nothing else", () => {
    expect(readHandoffPayload("#numa-handoff=abcDEF-_123")).toBe("abcDEF-_123");
    expect(readHandoffPayload("#numa-handoff=has spaces")).toBeNull();
    expect(readHandoffPayload("#numa-handoff=<script>")).toBeNull();
    expect(readHandoffPayload("#numa-handoff=")).toBeNull();
    expect(readHandoffPayload("#to=https://x")).toBeNull();
  });

  it("refuses a payload longer than a URL can carry", () => {
    expect(readHandoffPayload(`#numa-handoff=${"a".repeat(MAX_PAYLOAD_CHARS + 1)}`)).toBeNull();
  });
});

describe("packing", () => {
  const backup = JSON.stringify({
    profile: { name: "Serafina", birthDate: "2026-07-27", feedingMode: "mixed" },
    activities: Array.from({ length: 400 }, (_, index) => ({
      id: `a${index}`,
      type: "bottle",
      startedAt: new Date(Date.UTC(2026, 7, 1, index % 24)).toISOString(),
      amount: 90,
    })),
    onboardingComplete: true,
  });

  it("survives the round trip byte for byte", async () => {
    const packed = await packHandoff(backup);
    expect(packed).not.toBeNull();
    expect(await unpackHandoff(packed!)).toBe(backup);
  });

  it("produces something a URL can actually carry", async () => {
    const packed = await packHandoff(backup);
    // Four hundred entries is a busy fortnight, and it has to be small enough
    // that the interesting case is rare rather than normal.
    expect(packed!.length).toBeLessThan(backup.length / 2);
    expect(readHandoffPayload(`#numa-handoff=${packed}`)).toBe(packed);
  });

  it("says no rather than producing a URL that will be truncated", async () => {
    // High-entropy text, so gzip has nothing to find and the size really is
    // over the line. Deterministic, because a test that sometimes passes is
    // not a test. (Counting characters is not enough on its own: a megabyte
    // of repeated JSON compresses to almost nothing, which is exactly why the
    // cap is applied AFTER packing rather than before.)
    let seed = 0x2f6e2b1;
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let noise = "";
    for (let index = 0; index < 700_000; index++) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      noise += alphabet[(seed >>> 0) % 64];
    }
    expect(await packHandoff(noise)).toBeNull();
  });

  it("reads back a payload from a browser with no compression", async () => {
    const plain = new TextEncoder().encode(backup);
    let binary = "";
    for (const byte of plain) binary += String.fromCharCode(byte);
    const encoded = btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
    expect(await unpackHandoff(encoded)).toBe(backup);
  });
});

describe("handoffReturnUrl", () => {
  it("puts the log in the fragment, which no browser sends to a server", () => {
    const url = new URL(handoffReturnUrl(GOOD, "PAYLOAD"));
    expect(url.origin).toBe(GOOD);
    expect(url.search).toBe("");
    expect(readHandoffPayload(url.hash)).toBe("PAYLOAD");
  });
});
