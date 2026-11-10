/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type ComponentProps } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { LogSheet } from "@/components/LogSheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Activity } from "@/domain/types";
import { setUnits } from "@/domain/units";
import { convertWeightDraft, getWeightEntry, kgDraftToGrams, setWeightEntry } from "@/domain/weightEntry";

// From the feedback box: "Switching between kg/g — I prefer using kg." The
// weight showed in kilograms already; the field took grams. Now it takes
// either, and the phone remembers which. Storage is grams either way.

type SheetProps = ComponentProps<typeof LogSheet>;

function renderSheet(props: Partial<SheetProps>) {
  const onAdd = vi.fn((entry: Activity, message: string) => Boolean(entry && message));
  const onUpdate = vi.fn((entry: Activity) => Boolean(entry));
  const base: SheetProps = {
    sheet: "growth",
    editingActivity: null,
    initialNursingMode: "timer",
    lastBottle: undefined,
    activeNursing: undefined,
    activities: [],
    babyAgeMonths: 2,
    profile: { name: "Mia", birthDate: "2026-08-01", feedingMode: "mixed" },
    onAdd,
    onUpdate,
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
        <LogSheet {...base} {...props} />
      </DialogContent>
    </Dialog>,
  );
  return { onAdd, onUpdate };
}

const weight = () => screen.getByLabelText("Weight") as HTMLInputElement;
const unitButton = (name: "kg" | "g") => screen.getByRole("radio", { name });
const growth = (grams: number): Activity => ({ id: "w", type: "growth", weightGrams: grams, startedAt: new Date(Date.now() - 3_600_000).toISOString() });

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {};
  window.localStorage.clear();
  setUnits("metric");
  setWeightEntry("g");
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  setUnits("metric");
});

test("grams stay the default: 3520 is 3520 g, as it always was", () => {
  const { onAdd } = renderSheet({});
  expect(unitButton("g").getAttribute("aria-checked")).toBe("true");
  fireEvent.change(weight(), { target: { value: "3520" } });
  fireEvent.click(screen.getByRole("button", { name: "Save growth check" }));
  expect(onAdd.mock.calls[0][0]).toMatchObject({ type: "growth", weightGrams: 3520 });
});

test("in kilograms, 3.52 is saved as 3520 g, and the phone remembers kg", () => {
  const { onAdd } = renderSheet({});
  fireEvent.click(unitButton("kg"));
  fireEvent.change(weight(), { target: { value: "3.52" } });
  fireEvent.click(screen.getByRole("button", { name: "Save growth check" }));
  expect(onAdd.mock.calls[0][0]).toMatchObject({ weightGrams: 3520 });
  expect(getWeightEntry()).toBe("kg");
  expect(window.localStorage.getItem("numalog-weight-entry-v1")).toBe("kg");
  cleanup();

  renderSheet({});
  expect(unitButton("kg").getAttribute("aria-checked")).toBe("true");
});

test("flipping with a number typed carries it across, never changing the weight", () => {
  renderSheet({});
  fireEvent.change(weight(), { target: { value: "3520" } });
  fireEvent.click(unitButton("kg"));
  expect(weight().value).toBe("3.52");
  fireEvent.click(unitButton("g"));
  expect(weight().value).toBe("3520");
});

test("editing in kilograms shows kilograms and keeps an untouched weight exactly", () => {
  setWeightEntry("kg");
  const entry = growth(3333);
  const { onUpdate } = renderSheet({ sheet: "edit", editingActivity: entry, activities: [entry] });
  expect(weight().value).toBe("3.333");
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(onUpdate.mock.calls[0][0]).toMatchObject({ weightGrams: 3333 });
});

test("a kilogram weight out of range is refused in kilograms", () => {
  setWeightEntry("kg");
  const { onAdd } = renderSheet({});
  fireEvent.change(weight(), { target: { value: "45" } });
  fireEvent.click(screen.getByRole("button", { name: "Save growth check" }));
  expect(onAdd).not.toHaveBeenCalled();
  expect(screen.getByText("Enter a weight between 0.5 and 30 kg.")).toBeTruthy();
});

test("pounds have no kg | g: the toggle is metric only", () => {
  setUnits("us");
  setWeightEntry("kg");
  const { onAdd } = renderSheet({});
  expect(screen.queryByRole("radio", { name: "kg" })).toBeNull();
  fireEvent.change(weight(), { target: { value: "7.7" } });
  fireEvent.click(screen.getByRole("button", { name: "Save growth check" }));
  expect(onAdd.mock.calls[0][0].weightGrams).toBeCloseTo(3493, -1);
});

test("the conversions leave empty and nonsense to the validator", () => {
  expect(kgDraftToGrams("")).toBe("");
  expect(kgDraftToGrams("3.5")).toBe("3500");
  expect(convertWeightDraft("", "kg")).toBe("");
  expect(convertWeightDraft("3500", "kg")).toBe("3.5");
  expect(convertWeightDraft("3.5", "g")).toBe("3500");
});
