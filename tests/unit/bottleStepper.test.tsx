/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type ComponentProps } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { LogSheet } from "@/components/LogSheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Activity } from "@/domain/types";
import { setUnits } from "@/domain/units";

// From the feedback box: "can you have the option of milk amount in oz?
// including .5 oz amounts?" — and, here, "how do I log 55 ml?". The bottle
// sheet's + and − now go by 5 ml, and in ounces they land on half-ounce marks.

type SheetProps = ComponentProps<typeof LogSheet>;

function renderSheet(lastBottle?: Activity) {
  const onAdd = vi.fn((entry: Activity, message: string) => Boolean(entry && message));
  const props: SheetProps = {
    sheet: "bottle",
    editingActivity: null,
    initialNursingMode: "timer",
    lastBottle,
    activeNursing: undefined,
    activities: lastBottle ? [lastBottle] : [],
    babyAgeMonths: 2,
    profile: { name: "Mia", birthDate: "2026-08-01", feedingMode: "bottle" },
    onAdd,
    onUpdate: () => true,
    onRemove: () => true,
    onSaveProfile: () => true,
    onClose: () => {},
    showToast: () => {},
    monthEntries: [],
    vaccineEntries: [],
    onUpsert: () => true,
  };
  render(
    <Dialog open>
      <DialogContent>
        <LogSheet {...props} />
      </DialogContent>
    </Dialog>,
  );
  return onAdd;
}

const bottle = (amount: number): Activity => ({ id: "b", type: "bottle", amount, milkType: "formula", startedAt: new Date(Date.now() - 3_600_000).toISOString() });
const shown = () => screen.getByRole("status").textContent;
const plus = () => fireEvent.click(screen.getByRole("button", { name: "Increase amount" }));
const minus = () => fireEvent.click(screen.getByRole("button", { name: "Decrease amount" }));

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {};
  setUnits("metric");
});
afterEach(() => {
  cleanup();
  setUnits("metric");
});

test("in millilitres, + and − go by 5, so 55 ml is two taps from 60", () => {
  const onAdd = renderSheet(bottle(60));
  minus();
  expect(shown()).toBe("55ml");
  minus();
  expect(shown()).toBe("50ml");
  plus();
  plus();
  plus();
  expect(shown()).toBe("65ml");
  fireEvent.click(screen.getByRole("button", { name: "Save 65 ml" }));
  expect(onAdd.mock.calls[0][0]).toMatchObject({ amount: 65 });
});

test("an amount between the marks steps to the next mark, not past it", () => {
  // 53 ml, typed in an edit once: + is 55, − is 50.
  renderSheet(bottle(53));
  plus();
  expect(shown()).toBe("55ml");
  cleanup();
  renderSheet(bottle(53));
  minus();
  expect(shown()).toBe("50ml");
});

test("in ounces, a bottle logged in millilitres starts on a half-ounce mark", () => {
  setUnits("us");
  // 150 ml is 5.07 oz: the sheet starts at 5, and + is 5.5, not 5.6.
  renderSheet(bottle(150));
  expect(shown()).toBe("5oz");
  plus();
  expect(shown()).toBe("5.5oz");
  plus();
  expect(shown()).toBe("6oz");
  minus();
  minus();
  minus();
  expect(shown()).toBe("4.5oz");
  expect(screen.getByRole("button", { name: "Save 4.5 oz" })).toBeTruthy();
});
