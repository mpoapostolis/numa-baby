/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { type ComponentProps } from "react";
import { afterEach, beforeEach, describe, expect, it, test, vi } from "vitest";
import { LogSheet } from "@/components/LogSheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { activityDetail } from "@/domain/activityDisplay";
import { Activity } from "@/domain/types";
import {
  bottleStepper,
  formatLength,
  formatTemperature,
  formatVolume,
  formatWeight,
  measurementToMetric,
  ozMilk,
  setUnits,
  usBody,
} from "@/domain/units";
import { setWeightEntry } from "@/domain/weightEntry";
import SettingsScreen from "@/screens/SettingsScreen";
import { stubBrowser } from "./appHarness";

// From the feedback box: "yes i would appreciate if i can choose oz for milk
// amount and cm/kg for measurements". A third choice beside Metric and US:
// the bottle in ounces, the baby in kilograms and centimetres.

beforeEach(() => {
  window.localStorage.clear();
  setUnits("metric");
  setWeightEntry("g");
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  setUnits("metric");
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("the two questions", () => {
  it("milk in ounces on US and Mixed; the baby the American way on US only", () => {
    expect([ozMilk("metric"), ozMilk("us"), ozMilk("mixed")]).toEqual([false, true, true]);
    expect([usBody("metric"), usBody("us"), usBody("mixed")]).toEqual([false, true, false]);
  });

  it("Mixed speaks ounces for milk and metric for everything else", () => {
    expect(formatVolume(120, "mixed")).toBe("4.1 oz");
    expect(bottleStepper("mixed")).toMatchObject({ step: 0.5, unit: "oz" });
    expect(formatWeight(4_200, "mixed")).toBe("4.20 kg");
    expect(formatLength(55, "mixed")).toBe("55 cm");
    expect(formatTemperature(37.2, "mixed")).toBe("37.2 °C");
    // A typed weight is already metric: nothing converts it.
    expect(measurementToMetric("weightGrams", "3500", "mixed")).toBe("3500");
    expect(activityDetail({ id: "b", type: "bottle", amount: 150, milkType: "formula", startedAt: "2026-10-01T08:00:00" }, "mixed")).toContain("5.1 oz");
    expect(activityDetail({ id: "g", type: "growth", weightGrams: 5_480, lengthCm: 58, startedAt: "2026-10-01T08:00:00" }, "mixed")).toContain("5.48 kg");
  });

  it("a phone that chose Mixed opens on Mixed again", async () => {
    window.localStorage.setItem("numalog-units-v1", "mixed");
    vi.resetModules();
    const fresh = await import("@/domain/units");
    expect(fresh.getUnits()).toBe("mixed");
  });
});

test("Settings offers it, and the phone keeps it", () => {
  stubBrowser();
  vi.stubGlobal("__APP_VERSION__", "test");
  const noop = () => {};
  render(
    <SettingsScreen
      profile={{ name: "Mia", birthDate: "2026-09-01", feedingMode: "bottle" }}
      themeChoice="system"
      reminders={{ feedEnabled: false, feedIntervalMinutes: 180, diaperEnabled: false, diaperIntervalMinutes: 120 }}
      notificationPermission="default"
      feedReminderTargetAt={null}
      diaperReminderTargetAt={null}
      pushArmed={false}
      minuteClock={Date.now()}
      onThemeChange={noop}
      onFeedRemindersChange={async () => {}}
      onFeedIntervalChange={noop}
      onDiaperRemindersChange={async () => {}}
      onDiaperIntervalChange={noop}
      onExport={noop}
      onShare={noop}
      onImport={noop}
      onOpenProfile={noop}
      onOpenSheet={noop}
      onRoutinesChange={noop}
      onEraseAll={noop}
      familySync={{ pairing: null, status: { phase: "idle", lastSyncAt: null, deviceCount: null } } as never}
      entryCount={0}
    />,
  );
  const mixed = screen.getByRole("radio", { name: /Mixed/ });
  expect(mixed.textContent).toContain("oz · kg · cm");
  fireEvent.click(mixed);
  expect(mixed.getAttribute("aria-checked")).toBe("true");
  expect(window.localStorage.getItem("numalog-units-v1")).toBe("mixed");
});

describe("in the sheets", () => {
  type SheetProps = ComponentProps<typeof LogSheet>;

  function renderSheet(props: Partial<SheetProps>) {
    const onAdd = vi.fn((entry: Activity, message: string) => Boolean(entry && message));
    const base: SheetProps = {
      sheet: "bottle",
      editingActivity: null,
      initialNursingMode: "timer",
      lastBottle: undefined,
      activeNursing: undefined,
      activities: [],
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
          <LogSheet {...base} {...props} />
        </DialogContent>
      </Dialog>,
    );
    return onAdd;
  }

  beforeEach(() => {
    Element.prototype.scrollIntoView = () => {};
    setUnits("mixed");
  });

  test("the bottle is in ounces, by the half ounce, and kept in millilitres", () => {
    const lastBottle: Activity = { id: "b", type: "bottle", amount: 150, milkType: "formula", startedAt: new Date(Date.now() - 3_600_000).toISOString() };
    const onAdd = renderSheet({ lastBottle, activities: [lastBottle] });
    expect(screen.getByRole("status").textContent).toBe("5oz");
    fireEvent.click(screen.getByRole("button", { name: "Decrease amount" }));
    expect(screen.getByRole("status").textContent).toBe("4.5oz");
    fireEvent.click(screen.getByRole("button", { name: "Save 4.5 oz" }));
    expect(onAdd.mock.calls[0][0]).toMatchObject({ type: "bottle", amount: 133 });
  });

  test("the growth check is in kilograms or grams, and centimetres", () => {
    const onAdd = renderSheet({ sheet: "growth" });
    // The kg | g choice is the metric one, offered here too.
    fireEvent.click(screen.getByRole("radio", { name: "kg" }));
    fireEvent.change(screen.getByLabelText("Weight"), { target: { value: "5.48" } });
    const length = screen.getByLabelText(/^Length/);
    fireEvent.change(length, { target: { value: "58.5" } });
    expect(length.closest("[data-slot='input-group']")?.textContent).toContain("cm");
    fireEvent.click(screen.getByRole("button", { name: "Save growth check" }));
    expect(onAdd.mock.calls[0][0]).toMatchObject({ type: "growth", weightGrams: 5_480, lengthCm: 58.5 });
  });
});
