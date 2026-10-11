/** @vitest-environment jsdom */
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { NewsDialog } from "@/components/NewsDialog";
import { RELEASES } from "@/domain/changelog";

afterEach(() => cleanup());

// A second release on the same day is "2026-10-11.2": it sorts after the
// first, so a phone that saw the morning's news still gets the evening's.
test("every release is dated, a second one on the same day included", () => {
  render(<NewsDialog open onOpenChange={() => {}} />);
  const dialog = screen.getByRole("dialog");
  expect(dialog.textContent).not.toContain("Invalid Date");
  expect(RELEASES.some((release) => release.id.includes("."))).toBe(true);
  expect(dialog.textContent).toContain("October 11, 2026");
});
