/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { MonthsSheet } from "@/components/MonthsSheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Activity } from "@/domain/types";

// Asked for from the feedback box: "a monthly milestone note for our baby,
// and ... just a monthly photo". An album: the month being lived now as a
// large card, the earlier ones below, one page each.

const NOW = new Date(2026, 9, 14, 9, 0).getTime();
const profile = { name: "Mia", birthDate: "2026-06-14", feedingMode: "mixed" as const };

beforeEach(() => {
  Element.prototype.scrollTo = () => {};
});
afterEach(() => cleanup());

function setup(months: Activity[] = [], birthDate = profile.birthDate) {
  const onUpsert = vi.fn((activity: Activity) => Boolean(activity));
  render(
    <Dialog open>
      <DialogContent>
        <MonthsSheet profile={{ ...profile, birthDate }} months={months} now={NOW} onUpsert={onUpsert} />
      </DialogContent>
    </Dialog>,
  );
  return { onUpsert };
}

const card = () => document.querySelector<HTMLButtonElement>(".months-now")!;
const rows = () => Array.from(document.querySelectorAll<HTMLButtonElement>(".month-tile"));
const note = () => screen.getByRole("textbox", { name: /^Note/ }) as HTMLTextAreaElement;

test("this month leads as a card, the earlier months follow, newest first", () => {
  setup();
  expect(card().textContent).toContain("This month");
  expect(card().textContent).toContain("4 months");
  expect(card().textContent).toContain("Mia is 4 months old today");
  expect(rows().map((row) => row.querySelector("strong")!.textContent)).toEqual(["3 months", "2 months", "1 month"]);
});

test("a note written for a month is saved as that month's one entry", () => {
  const { onUpsert } = setup();
  fireEvent.click(rows()[1]);
  fireEvent.change(note(), { target: { value: "Rolled over!" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  const saved = onUpsert.mock.calls[0][0];
  expect(saved).toMatchObject({ id: "month-2", type: "month", month: 2, note: "Rolled over!" });
  // Never dated ahead of now: a month-birthday that is today is not "later today".
  expect(new Date(saved.startedAt).getTime()).toBeLessThanOrEqual(NOW);
});

test("a month already written shows its words, and editing keeps the same entry", () => {
  const { onUpsert } = setup([{ id: "month-4", type: "month", month: 4, startedAt: new Date(NOW).toISOString(), note: "Laughs at the cat" }]);
  expect(card().textContent).toContain("Laughs at the cat");
  fireEvent.click(card());
  expect(note().value).toBe("Laughs at the cat");
  fireEvent.change(note(), { target: { value: "Laughs at the cat, every time" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(onUpsert.mock.calls[0][0]).toMatchObject({ id: "month-4", note: "Laughs at the cat, every time" });
});

test("before the first month-birthday it says when the first page opens", () => {
  setup([], "2026-10-01");
  expect(document.body.textContent).toContain("first month‑birthday is Sunday, November 1");
});

test("the sheet opens with focus on this month", () => {
  setup();
  expect(card().hasAttribute("data-initial-focus")).toBe(true);
});

test("past the second year, the two-year page is the last page, not this month", () => {
  setup([], "2024-04-14");
  expect(card().textContent).toContain("Last page");
  expect(card().textContent).not.toContain("This month");
});

// A month with no photo says so in words — a big number read as a photo
// that had failed to load.
test("an earlier month without a photo says no photo yet, and shows its note", () => {
  setup([{ id: "month-2", type: "month", month: 2, startedAt: new Date(NOW).toISOString(), note: "Rolled over!" }]);
  const two = rows().find((row) => row.textContent?.includes("2 months"))!;
  expect(two.textContent).toContain("No photo yet");
  expect(two.textContent).toContain("Rolled over!");
});

// Looking back through the album is not editing it.
test("a month opened and left as it was offers Done, and saves nothing", () => {
  const { onUpsert } = setup();
  fireEvent.click(rows()[0]);
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  expect(onUpsert).not.toHaveBeenCalled();
  expect(card()).toBeTruthy();
});
