/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { MonthsSheet } from "@/components/MonthsSheet";
import { VaccinesSheet } from "@/components/VaccinesSheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";

// Android back inside a sheet does what the on-screen Back does: it returns
// from a month or a vaccine form to the list, instead of closing the whole
// sheet and losing what was typed. (Its own file: the back-gesture hook keeps
// module state that other tests' history steps would disturb.)

const NOW = new Date(2026, 9, 14, 9, 0).getTime();

beforeEach(() => {
  Element.prototype.scrollTo = () => {};
  Element.prototype.scrollIntoView = () => {};
});
afterEach(() => cleanup());

async function back() {
  await act(async () => {
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
}

test("from a month back to the album", async () => {
  render(
    <Dialog open>
      <DialogContent>
        <MonthsSheet profile={{ name: "Mia", birthDate: "2026-06-14", feedingMode: "mixed" }} months={[]} now={NOW} onUpsert={() => true} />
      </DialogContent>
    </Dialog>,
  );
  fireEvent.click(document.querySelector<HTMLButtonElement>(".month-row")!);
  expect(screen.getByRole("button", { name: "Save this month" })).toBeTruthy();
  await back();
  expect(screen.queryByRole("button", { name: "Save this month" })).toBeNull();
  expect(document.querySelector(".months-now")).not.toBeNull();
});

test("from a vaccine form back to the card", async () => {
  render(
    <Dialog open>
      <DialogContent>
        <VaccinesSheet name="Mia" vaccines={[]} now={NOW} onAdd={() => true} onUpdate={() => true} onRemove={() => true} />
      </DialogContent>
    </Dialog>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Plan a vaccine" }));
  expect(screen.getByRole("button", { name: "Save to the schedule" })).toBeTruthy();
  await back();
  expect(screen.queryByRole("button", { name: "Save to the schedule" })).toBeNull();
  expect(screen.getByRole("button", { name: "Log a vaccine" })).toBeTruthy();
});
