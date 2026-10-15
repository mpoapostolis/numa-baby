/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ComponentProps, useState } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { LogSheet } from "@/components/LogSheet";
import { TimeField } from "@/components/fields";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { localDateInput } from "@/domain/time";
import { setUnits } from "@/domain/units";
import { Activity, ActivityType } from "@/domain/types";

// The log sheets' own forms: what a tap fills in, what an edit keeps, and
// which field an error points at.

beforeEach(() => {
  // jsdom does no layout; the error line scrolls itself into view.
  Element.prototype.scrollIntoView = () => {};
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

type SheetProps = ComponentProps<typeof LogSheet>;

function renderSheet(props: Partial<SheetProps>) {
  const onAdd = vi.fn((entry: Activity, message: string) => Boolean(entry && message));
  const onUpdate = vi.fn((entry: Activity) => Boolean(entry));
  const base: SheetProps = {
    sheet: "edit",
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
  const ui = (next: Partial<SheetProps>) => (
    <Dialog open>
      <DialogContent>
        <LogSheet {...base} {...next} />
      </DialogContent>
    </Dialog>
  );
  const view = render(ui(props));
  return { onAdd, onUpdate, rerender: (next: Partial<SheetProps>) => view.rerender(ui({ ...props, ...next })) };
}

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const input = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement;

// --- Medicines given before -------------------------------------------------

const givenBefore: Activity[] = [
  { id: "p", type: "medicine", medicine: "Paracetamol", dose: "2.5 ml", startedAt: minutesAgo(300) },
  { id: "d", type: "medicine", medicine: "Vitamin D", startedAt: minutesAgo(60) },
];

test("tapping a medicine with no amount does not keep the last one's amount", () => {
  const { onAdd } = renderSheet({ sheet: "medicine", activities: givenBefore });
  fireEvent.click(screen.getByRole("button", { name: /^Paracetamol/ }));
  expect(input(/How much/).value).toBe("2.5 ml");
  fireEvent.click(screen.getByRole("button", { name: /^Vitamin D/ }));
  expect(input(/How much/).value).toBe("");

  fireEvent.click(screen.getByRole("button", { name: "Save dose" }));
  const saved = onAdd.mock.calls[0][0];
  expect(saved).toMatchObject({ type: "medicine", medicine: "Vitamin D" });
  expect(saved.dose).toBeUndefined();
});

test("an amount typed by hand stays when the medicine is picked after it", () => {
  const { onAdd } = renderSheet({ sheet: "medicine", activities: givenBefore });
  fireEvent.change(input(/How much/), { target: { value: "3 drops" } });
  fireEvent.click(screen.getByRole("button", { name: /^Vitamin D/ }));
  fireEvent.click(screen.getByRole("button", { name: "Save dose" }));
  expect(onAdd.mock.calls[0][0]).toMatchObject({ medicine: "Vitamin D", dose: "3 drops" });
});

// --- A missing name points at the name ----------------------------------------

test("a medicine saved with no name marks the name field, not the time", async () => {
  const entry: Activity = { id: "m", type: "medicine", medicine: "Vitamin D", dose: "4 drops", startedAt: minutesAgo(30) };
  const { onUpdate } = renderSheet({ editingActivity: entry, activities: [entry] });
  fireEvent.change(input("What was given"), { target: { value: " " } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  expect(onUpdate).not.toHaveBeenCalled();
  expect(screen.getByText("Which medicine was it?")).toBeTruthy();
  expect(input("What was given").getAttribute("aria-invalid")).toBe("true");
  expect(input("When").getAttribute("aria-invalid")).toBe("false");
  await waitFor(() => expect(document.activeElement).toBe(input("What was given")));
});

test("a food saved with no name marks the food field", () => {
  const { onAdd } = renderSheet({ sheet: "solid" });
  fireEvent.click(screen.getByRole("button", { name: "Save food" }));
  expect(onAdd).not.toHaveBeenCalled();
  expect(input("What did they eat?").getAttribute("aria-invalid")).toBe("true");
  expect(input("When").getAttribute("aria-invalid")).toBe("false");
});

// --- Daily routine ticks --------------------------------------------------------

test("a routine tick's name is edited as its name, and cannot be saved empty", () => {
  const tick: Activity = { id: "r", type: "routine", routineId: "vitamin-d", note: "Vitamin D", startedAt: minutesAgo(30) };
  const { onUpdate } = renderSheet({ editingActivity: tick, activities: [tick] });
  expect(input("What was done").value).toBe("Vitamin D");
  expect(screen.queryByLabelText(/^Note/)).toBeNull();

  fireEvent.change(input("What was done"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(onUpdate).not.toHaveBeenCalled();
  expect(screen.getByText("What was done?")).toBeTruthy();
  expect(input("What was done").getAttribute("aria-invalid")).toBe("true");

  fireEvent.change(input("What was done"), { target: { value: "Vitamin D drops" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(onUpdate.mock.calls[0][0]).toMatchObject({ id: "r", routineId: "vitamin-d", note: "Vitamin D drops" });
});

// --- What an edit keeps ---------------------------------------------------------

test("an entry of a type this build does not know keeps its end time when edited", () => {
  // As tummy time was for the build before it: timed, but not known here.
  const future: Activity = {
    id: "f",
    type: "future" as ActivityType,
    startedAt: minutesAgo(40),
    endedAt: minutesAgo(28),
  };
  const { onUpdate } = renderSheet({ editingActivity: future, activities: [future] });
  fireEvent.change(screen.getByLabelText(/^Note/), { target: { value: "Happy on the mat" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(onUpdate.mock.calls[0][0]).toMatchObject({ id: "f", note: "Happy on the mat", endedAt: future.endedAt });
});

test("a timer stopped on the other phone while its edit sheet is open stays stopped", () => {
  const sleep: Activity = { id: "s", type: "sleep", startedAt: minutesAgo(40) };
  const { onUpdate, rerender } = renderSheet({ editingActivity: sleep, activities: [sleep] });
  expect(input("Ended").value).toBe("");

  // The other parent taps Wake up; it arrives over the sync.
  const stoppedAt = new Date().toISOString();
  rerender({ activities: [{ ...sleep, endedAt: stoppedAt, updatedAt: stoppedAt }] });
  expect(input("Ended").value).toBe(localDateInput(new Date(stoppedAt)));

  fireEvent.change(input("Started"), { target: { value: localDateInput(new Date(Date.now() - 35 * 60_000)) } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(onUpdate.mock.calls[0][0].endedAt).toBeDefined();
});

test("an end typed by this parent wins over one arriving from the other phone", () => {
  const sleep: Activity = { id: "s", type: "sleep", startedAt: minutesAgo(40) };
  const { onUpdate, rerender } = renderSheet({ editingActivity: sleep, activities: [sleep] });
  const typed = localDateInput(new Date(Date.now() - 10 * 60_000));
  fireEvent.change(input("Ended"), { target: { value: typed } });
  rerender({ activities: [{ ...sleep, endedAt: new Date().toISOString() }] });
  expect(input("Ended").value).toBe(typed);
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(onUpdate.mock.calls[0][0].endedAt).toBe(new Date(typed).toISOString());
});

// --- A pump's edit -------------------------------------------------------------

const pumped: Activity = { id: "p", type: "pump", side: "both", amount: 120, startedAt: minutesAgo(40), endedAt: minutesAgo(22) };
const checked = (name: RegExp) => screen.getByRole("radio", { name }).getAttribute("aria-checked") === "true";

test("a pump's edit has its side, its amount, and a start and an end it must keep", () => {
  const { onUpdate } = renderSheet({ editingActivity: pumped, activities: [pumped] });
  expect(checked(/Both/)).toBe(true);
  expect(input(/^Amount/).value).toBe("120");
  expect(input("Started").value).toBe(localDateInput(new Date(pumped.startedAt)));
  expect(input("Ended").value).toBe(localDateInput(new Date(pumped.endedAt!)));
  // A span, never a timer: it cannot be left running.
  expect(screen.queryByText("Leave empty if still going.")).toBeNull();

  fireEvent.change(input("Ended"), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
  expect(onUpdate).not.toHaveBeenCalled();
  expect(screen.getByText("The end time must be after the start and not in the future.")).toBeTruthy();
  expect(input("Ended").getAttribute("aria-invalid")).toBe("true");
});

test("an amount cleared from a pump goes, and a new side is kept", () => {
  const showToast = vi.fn();
  const { onUpdate } = renderSheet({ editingActivity: pumped, activities: [pumped], showToast });
  fireEvent.change(input(/^Amount/), { target: { value: "" } });
  fireEvent.click(screen.getByRole("radio", { name: /Left/ }));
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

  const saved = onUpdate.mock.calls[0][0];
  expect(saved).toMatchObject({ id: "p", type: "pump", side: "left" });
  expect(saved.endedAt).toBe(new Date(localDateInput(new Date(pumped.endedAt!))).toISOString());
  // Not measured is no key at all, never 0.
  expect("amount" in saved).toBe(false);
  expect(showToast).toHaveBeenCalledWith("Pumping updated");
});

test("a note-only edit on US units keeps a pump's amount exact", () => {
  // 120 ml shows as 4.1 oz, and 4.1 oz is 121 ml: the untouched amount must
  // not make that round trip.
  setUnits("us");
  try {
    const { onUpdate } = renderSheet({ editingActivity: pumped, activities: [pumped] });
    expect(input(/^Amount/).value).toBe("4.1");
    fireEvent.change(screen.getByLabelText(/^Note/), { target: { value: "Evening, after the feed" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onUpdate.mock.calls[0][0]).toMatchObject({ amount: 120, note: "Evening, after the feed" });
  } finally {
    setUnits("metric");
  }
});

// --- The quick time chips -------------------------------------------------------

function QuickTime() {
  const [value, setValue] = useState(() => localDateInput(new Date()));
  return <TimeField quick value={value} onChange={setValue} />;
}

test("'Now' on a sheet left open still means now", async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 15, 9, 0));
  render(<QuickTime />);
  expect(input("When").value).toBe("2026-10-15T09:00");

  // Twenty minutes with the phone locked; "Now" is still the lit chip.
  vi.setSystemTime(new Date(2026, 9, 15, 9, 20));
  await act(async () => fireEvent.click(screen.getByRole("radio", { name: "Now" })));
  expect(input("When").value).toBe("2026-10-15T09:20");
  expect(screen.getByRole("radio", { name: "Now" }).getAttribute("aria-checked")).toBe("true");
});
