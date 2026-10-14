/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { WhatsNew } from "@/components/WhatsNew";

afterEach(() => cleanup());

// The card on Today is one line until it is opened — and for a release that
// brings something to find, the way to it is part of that line.
test("the card offers the new places while still closed, one tap each", () => {
  const onAction = vi.fn();
  render(<WhatsNew releaseIds={["2026-10-14"]} onDismiss={() => {}} onAction={onAction} />);
  expect(screen.getByRole("button", { name: /Months, photos and vaccines/ }).getAttribute("aria-expanded")).toBe("false");

  fireEvent.click(screen.getByRole("button", { name: "Months" }));
  fireEvent.click(screen.getByRole("button", { name: "Vaccines" }));
  fireEvent.click(screen.getByRole("button", { name: "Baby’s photo" }));
  expect(onAction.mock.calls.map(([to]) => to)).toEqual(["months", "vaccines", "profile"]);
});

test("an older release with nothing to open stays a single line", () => {
  render(<WhatsNew releaseIds={["2026-10-11.2"]} onDismiss={() => {}} onAction={() => {}} />);
  expect(document.querySelector(".release-actions")).toBeNull();
});
