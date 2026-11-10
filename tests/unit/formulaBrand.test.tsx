/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "@/App";
import { LogSheet } from "@/components/LogSheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { activityDetail } from "@/domain/activityDisplay";
import { Activity } from "@/domain/types";
import { STORAGE_KEY } from "@/hooks/useTrackerStore";
import { seedLog, stubBrowser } from "./appHarness";

// From the feedback box: "I'm using 2 brands of formula for baby. Will you be
// able to add a portion where I can enter the brand of the formula for that
// specific time?"

const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const bottle = (id: string, minutes: number, extra: Partial<Activity> = {}): Activity =>
  ({ id, type: "bottle", amount: 120, milkType: "formula", startedAt: minutesAgo(minutes), ...extra });

type SheetProps = ComponentProps<typeof LogSheet>;

function renderSheet(props: Partial<SheetProps>) {
  const onAdd = vi.fn((entry: Activity, message: string) => Boolean(entry && message));
  const onUpdate = vi.fn((entry: Activity) => Boolean(entry));
  const base: SheetProps = {
    sheet: "bottle",
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

const brandField = () => screen.getByLabelText(/Formula brand/) as HTMLInputElement;
const save = () => fireEvent.click(screen.getByRole("button", { name: /^Save \d+ ml$/ }));

beforeEach(() => {
  Element.prototype.scrollIntoView = () => {};
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the bottle sheet", () => {
  test("a brand typed in is saved on that bottle", () => {
    const { onAdd } = renderSheet({});
    fireEvent.change(brandField(), { target: { value: "  Brand A  " } });
    save();
    expect(onAdd.mock.calls[0][0]).toMatchObject({ type: "bottle", milkType: "formula", brand: "Brand A" });
  });

  test("no brand is no brand, not an empty one", () => {
    const { onAdd } = renderSheet({});
    save();
    expect("brand" in onAdd.mock.calls[0][0]).toBe(false);
  });

  test("the brands named before are buttons, and the last bottle's is already picked", () => {
    const log = [bottle("a", 300, { brand: "Brand A" }), bottle("b", 60, { brand: "Brand B" })];
    const { onAdd } = renderSheet({ activities: log, lastBottle: log[1] });
    const group = screen.getByRole("group", { name: "Brands used before" });
    const [first, second] = [...group.querySelectorAll("button")];
    expect([first.textContent, second.textContent]).toEqual(["Brand B", "Brand A"]);
    expect(brandField().value).toBe("Brand B");
    expect(first.getAttribute("aria-pressed")).toBe("true");

    fireEvent.click(second);
    expect(brandField().value).toBe("Brand A");
    save();
    expect(onAdd.mock.calls[0][0]).toMatchObject({ brand: "Brand A" });
  });

  test("tapping the picked brand again takes it back", () => {
    const log = [bottle("a", 60, { brand: "Brand A" })];
    const { onAdd } = renderSheet({ activities: log, lastBottle: log[0] });
    fireEvent.click(screen.getByRole("button", { name: "Brand A" }));
    expect(brandField().value).toBe("");
    save();
    expect("brand" in onAdd.mock.calls[0][0]).toBe(false);
  });

  test("breast milk has no brand field, and saves no brand", () => {
    const log = [bottle("a", 60, { brand: "Brand A" })];
    const { onAdd } = renderSheet({ activities: log, lastBottle: log[0] });
    fireEvent.click(screen.getByRole("radio", { name: /Breast milk/ }));
    expect(screen.queryByLabelText(/Formula brand/)).toBeNull();
    save();
    expect(onAdd.mock.calls[0][0]).toMatchObject({ milkType: "expressed" });
    expect("brand" in onAdd.mock.calls[0][0]).toBe(false);
  });
});

describe("editing a bottle", () => {
  test("the brand can be changed, and goes when the bottle becomes breast milk", () => {
    const entry = bottle("a", 60, { brand: "Brand A" });
    const first = renderSheet({ sheet: "edit", editingActivity: entry, activities: [entry] });
    expect(brandField().value).toBe("Brand A");
    fireEvent.change(brandField(), { target: { value: "Brand B" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(first.onUpdate.mock.calls[0][0]).toMatchObject({ id: "a", brand: "Brand B" });
    cleanup();

    const second = renderSheet({ sheet: "edit", editingActivity: entry, activities: [entry] });
    fireEvent.click(screen.getByRole("radio", { name: /Breast milk/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(second.onUpdate.mock.calls[0][0]).toMatchObject({ id: "a", milkType: "expressed" });
    expect("brand" in second.onUpdate.mock.calls[0][0]).toBe(false);
  });

  test("a brand this build cannot read is kept, not erased", () => {
    const entry = { ...bottle("a", 60), brand: { name: "from a newer build" } } as unknown as Activity;
    const { onUpdate } = renderSheet({ sheet: "edit", editingActivity: entry, activities: [entry] });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(onUpdate.mock.calls[0][0].brand).toEqual({ name: "from a newer build" });
  });
});

describe("where the brand shows", () => {
  test("the bottle's line names the brand in place of the word formula", () => {
    expect(activityDetail(bottle("a", 60, { brand: "Brand A" }))).toBe("120 ml · Brand A");
    expect(activityDetail(bottle("a", 60))).toBe("120 ml · formula");
    // Only a formula bottle, and only a string.
    expect(activityDetail(bottle("a", 60, { milkType: "expressed", brand: "Brand A" }))).toBe("120 ml · breast milk");
    expect(activityDetail({ ...bottle("a", 60), brand: 7 } as unknown as Activity)).toBe("120 ml · formula");
  });

  test("the Bottle tile shows it, and its repeat logs the same brand", async () => {
    stubBrowser();
    seedLog([bottle("a", 60, { brand: "Brand A" })]);
    render(<App />);
    const repeat = await screen.findByRole("button", { name: "Log 120 millilitres of Brand A now" }, { timeout: 5_000 });
    expect(repeat.textContent).toContain("120 ml · Brand A");
    fireEvent.click(repeat);
    await waitFor(() => {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).activities as Activity[];
      expect(saved.filter((a) => a.type === "bottle" && a.brand === "Brand A")).toHaveLength(2);
    });
  }, 15_000);
});
