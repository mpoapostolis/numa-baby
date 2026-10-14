/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { MilestoneParty } from "@/components/MilestoneParty";

// The month-birthday is the moment a parent wants the month's photo: the
// party card is the door to that month's page.

afterEach(() => cleanup());

test("a month-birthday offers the month's page", () => {
  const onAddMonth = vi.fn();
  render(<MilestoneParty milestone={{ id: "m3", title: "Mia is 3 months old today", sub: "Happy month-birthday." }} totals={null} onAddMonth={onAddMonth} />);
  fireEvent.click(screen.getByRole("button", { name: /Add this month’s photo/ }));
  expect(onAddMonth).toHaveBeenCalledWith(3);
});

test("other milestones do not", () => {
  render(<MilestoneParty milestone={{ id: "d100", title: "100 days of Mia", sub: "…" }} totals={null} onAddMonth={() => {}} />);
  expect(screen.queryByRole("button", { name: /Add this month’s photo/ })).toBeNull();
});
