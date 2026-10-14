/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import TimelineScreen from "@/screens/TimelineScreen";
import { Activity } from "@/domain/types";

// Finding the nappy photo taken for the doctor again: one filter, every
// entry that has a photo.

afterEach(() => cleanup());

const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
const entries: Activity[] = [
  { id: "a", type: "diaper", diaperKind: "dirty", note: "Greenish", photo: "3f6c1d2e-9a4b-4c1d-8e2f-112233445566", startedAt: at(30) },
  { id: "b", type: "diaper", diaperKind: "wet", startedAt: at(60) },
  { id: "c", type: "bottle", amount: 120, startedAt: at(90) },
];

function show(filter: "photos" | "all", activities = entries) {
  render(<TimelineScreen activities={activities} minuteClock={Date.now()} filter={filter} limit={50} onFilterChange={() => {}} onShowMore={() => {}} onEdit={() => {}} />);
}

test("Photos shows only the entries that have one", () => {
  show("photos");
  expect(screen.getByRole("radio", { name: "Show entries with a photo" })).toBeTruthy();
  const rows = screen.getAllByRole("listitem");
  expect(rows).toHaveLength(1);
  expect(rows[0].textContent).toContain("Greenish");
});

test("with no photos yet, it says so", () => {
  show("photos", entries.filter((entry) => !entry.photo));
  expect(document.body.textContent).toContain("No photos yet.");
});
