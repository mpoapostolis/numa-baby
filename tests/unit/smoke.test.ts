import { expect, test } from "vitest";
import { humanDuration, median } from "@/domain/time";

// Seed test: proves the vitest + alias wiring against a real domain module
// without pulling in the app shell.
test("domain helpers are importable and pure", () => {
  expect(humanDuration(90)).toBe("1h 30m");
  expect(median([3, 1, 2])).toBe(2);
});
