import { expect, test } from "vitest";
import { tummyGoalMinutes } from "@/domain/tummyGoal";

// The Guide's numbers (AAP): a few minutes a few times a day at first, 15–30
// a day from about 7 weeks; nothing to time once rolling both ways.
test("the daily tummy time goal follows the age", () => {
  expect(tummyGoalMinutes(null)).toBeNull();
  expect(tummyGoalMinutes(-1)).toBeNull();
  expect(tummyGoalMinutes(0)).toBe(10);
  expect(tummyGoalMinutes(48)).toBe(10);
  expect(tummyGoalMinutes(49)).toBe(30);
  expect(tummyGoalMinutes(212)).toBe(30);
  expect(tummyGoalMinutes(213)).toBeNull();
});
