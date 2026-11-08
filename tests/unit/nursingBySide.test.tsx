/** @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { DayRecapLine } from "@/components/DayRecapLine";
import { summarizeDay } from "@/domain/daySummary";
import { Activity } from "@/domain/types";

// From the feedback box: "how long does she nurse on the right and on the
// left each day?" — on the Timeline, under each day.

afterEach(cleanup);

const day = new Date(2026, 7, 12);
const now = Date.parse("2026-08-12T20:00:00");
const nursing = (id: string, side: Activity["side"], from: string, to: string): Activity => ({
  id, type: "nursing", startedAt: `2026-08-12T${from}:00`, endedAt: `2026-08-12T${to}:00`, side,
});

function line(activities: Activity[]) {
  render(<DayRecapLine summary={summarizeDay(activities, day, now)} />);
  return document.querySelector(".recap-line")?.textContent ?? null;
}

test("a day's line says how long each side was nursed", () => {
  expect(line([
    nursing("a", "left", "06:00", "06:15"),
    nursing("b", "right", "06:15", "06:27"),
    nursing("c", "left", "10:00", "10:50"),
  ])).toBe("3 feeds · Left 1h 5m · Right 12m");
});

test("only the sides used appear, and a both-sides session keeps its own part", () => {
  expect(line([nursing("a", "right", "06:00", "06:20"), nursing("b", "both", "09:00", "09:25")]))
    .toBe("2 feeds · Right 20m · Both sides 25m");
});

test("a session saved with no side still counts, as nursing", () => {
  expect(line([nursing("a", undefined, "06:00", "06:08")])).toBe("1 feed · 8m nursing");
});

test("a bottle-only day reads exactly as before", () => {
  expect(line([{ id: "b", type: "bottle", startedAt: "2026-08-12T06:00:00", amount: 90 }])).toBe("1 feed · 90 ml");
});
