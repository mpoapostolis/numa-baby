/** @vitest-environment jsdom */
import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DayRecap } from "@/components/DayRecap";
import { summarizeDay } from "@/domain/daySummary";
import { Activity, Profile } from "@/domain/types";
import { setUnits } from "@/domain/units";
import { activeMilkTarget, parseStoredData, sanitizeProfile } from "@/domain/validate";
import { useActivityStats } from "@/hooks/useActivityStats";
import { STORAGE_KEY, useTrackerStore } from "@/hooks/useTrackerStore";
import InsightsScreen from "@/screens/InsightsScreen";
import { stubBrowser } from "./appHarness";

// From the feedback box: "the required daily average of formula needed is
// 800 ml but my daughter's body can't take it, so her pediatrician only
// required at least 600 ml. Is there a way to change it?"

const base = { name: "Mia", birthDate: "2026-06-15", feedingMode: "bottle" as const };

function blob(profile: object, profileUpdatedAt = "2026-10-01T00:00:00.000Z") {
  return JSON.stringify({ activities: [], profile, profileUpdatedAt, onboardingComplete: true });
}

beforeEach(() => {
  window.localStorage.clear();
  setUnits("metric");
});
afterEach(() => {
  cleanup();
  setUnits("metric");
  vi.restoreAllMocks();
});

describe("on the profile, and between the two phones", () => {
  test("an amount, a removal, or silence", () => {
    expect(sanitizeProfile({ ...base, milkTargetMl: 600 })?.milkTargetMl).toBe(600);
    // 0 is the family going back to the general guide: a real edit.
    expect(sanitizeProfile({ ...base, milkTargetMl: 0 })?.milkTargetMl).toBe(0);
    // Absent is a phone on an older build; nonsense is dropped, the profile kept.
    expect(sanitizeProfile(base)?.milkTargetMl).toBeUndefined();
    expect(sanitizeProfile({ ...base, milkTargetMl: -5 })?.milkTargetMl).toBeUndefined();
    expect(sanitizeProfile({ ...base, milkTargetMl: "600" })?.milkTargetMl).toBeUndefined();
    expect(parseStoredData(blob({ ...base, milkTargetMl: 600 })).profile.milkTargetMl).toBe(600);
    expect(activeMilkTarget({ milkTargetMl: 0 })).toBeUndefined();
    expect(activeMilkTarget({ milkTargetMl: 600 })).toBe(600);
  });

  function store() {
    return renderHook(() => useTrackerStore({ debugMode: false, showToast: () => {}, onNotificationPermission: () => {} }));
  }

  test("a phone on an older build does not erase it by renaming the baby", async () => {
    window.localStorage.setItem(STORAGE_KEY, blob({ ...base, milkTargetMl: 600 }));
    const { result } = store();
    await waitFor(() => expect(result.current.profile.milkTargetMl).toBe(600));
    act(() => {
      result.current.mergeRemote([], { ...base, name: "Mia Rose" } as never, "2026-10-12T00:00:00.000Z");
    });
    expect(result.current.profile).toMatchObject({ name: "Mia Rose", milkTargetMl: 600 });
    // Kept under a newer stamp, so it travels back to the other phone.
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!) as { profileUpdatedAt: string };
    expect(stored.profileUpdatedAt > "2026-10-12T00:00:00.000Z").toBe(true);
  });

  test("going back to the general guide does travel", async () => {
    window.localStorage.setItem(STORAGE_KEY, blob({ ...base, milkTargetMl: 600 }));
    const { result } = store();
    await waitFor(() => expect(result.current.profile.milkTargetMl).toBe(600));
    act(() => {
      result.current.mergeRemote([], { ...base, milkTargetMl: 0 } as never, "2026-10-12T00:00:00.000Z");
    });
    expect(result.current.profile.milkTargetMl).toBe(0);
  });

  test("the amount reaches a phone that had dropped it under the same stamp", async () => {
    window.localStorage.setItem(STORAGE_KEY, blob(base, "2026-10-12T00:00:00.000Z"));
    const { result } = store();
    await waitFor(() => expect(result.current.profile.name).toBe("Mia"));
    act(() => {
      result.current.mergeRemote([], { ...base, milkTargetMl: 600 } as never, "2026-10-12T00:00:00.000Z");
    });
    expect(result.current.profile.milkTargetMl).toBe(600);
  });
});

describe("on Insights", () => {
  const now = new Date(2026, 9, 14, 20, 0).getTime();
  // Four days of 4 × 150 ml: a typical day of 600 ml. 5.2 kg would make the
  // general guide about 780–950 ml.
  const log: Activity[] = [
    ...[1, 2, 3, 4].flatMap((daysAgo) => [6, 10, 14, 18].map((hour) => {
      const at = new Date(2026, 9, 14 - daysAgo, hour);
      return { id: `b-${daysAgo}-${hour}`, type: "bottle" as const, amount: 150, milkType: "formula" as const, startedAt: at.toISOString() };
    })),
    { id: "g", type: "growth", weightGrams: 5_200, startedAt: new Date(2026, 9, 10, 9).toISOString() },
  ];

  function renderInsights(profile: Profile) {
    stubBrowser();
    const onSaveProfile = vi.fn(() => true);
    const { result } = renderHook(() => useActivityStats(log, profile, now));
    render(
      <InsightsScreen
        stats={result.current}
        activities={log}
        profile={profile}
        ageDays={60}
        feedingMode="bottle"
        minuteClock={now}
        onAddGrowth={() => {}}
        onOpenGuide={() => {}}
        onSaveProfile={onSaveProfile}
      />,
    );
    return onSaveProfile;
  }

  test("the general guide offers a place for the paediatrician's amount", () => {
    const onSaveProfile = renderInsights(base);
    expect(screen.getByText("Milk against weight")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Did your paediatrician give a different amount?" }));
    fireEvent.change(screen.getByLabelText("The amount a day your paediatrician gave"), { target: { value: "600" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveProfile).toHaveBeenCalledWith({ ...base, milkTargetMl: 600 });
  });

  test("a number no day can be is refused, not saved", () => {
    const onSaveProfile = renderInsights(base);
    fireEvent.click(screen.getByRole("button", { name: "Did your paediatrician give a different amount?" }));
    fireEvent.change(screen.getByLabelText("The amount a day your paediatrician gave"), { target: { value: "6" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveProfile).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Enter an amount between 25 and 2000 ml.");
  });

  test("in ounces it is typed in ounces and kept in millilitres", () => {
    setUnits("us");
    const onSaveProfile = renderInsights(base);
    fireEvent.click(screen.getByRole("button", { name: "Did your paediatrician give a different amount?" }));
    fireEvent.change(screen.getByLabelText("The amount a day your paediatrician gave"), { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSaveProfile).toHaveBeenCalledWith({ ...base, milkTargetMl: 591 });
  });

  test("once set, it takes the general guide's place, and can be let go of", () => {
    const onSaveProfile = renderInsights({ ...base, milkTargetMl: 600 });
    expect(screen.queryByText("Milk against weight")).toBeNull();
    expect(screen.getByText("Your paediatrician’s amount: 600 ml a day.")).toBeTruthy();
    expect(document.querySelector(".intake-reading")!.textContent).toBe("600ml is your typical day — at or above that amount.");
    fireEvent.click(screen.getByRole("button", { name: "Use the general guide" }));
    expect(onSaveProfile).toHaveBeenCalledWith({ ...base, milkTargetMl: 0 });
  });
});

test("Today shows the day's milk against it", () => {
  const now = new Date(2026, 9, 14, 20, 0).getTime();
  const log: Activity[] = [6, 10, 14].map((hour) => ({ id: `b${hour}`, type: "bottle", amount: 150, startedAt: new Date(2026, 9, 14, hour).toISOString() }));
  render(<DayRecap summary={summarizeDay(log, new Date(now), now)} title="Today" milkTargetMl={600} />);
  expect(screen.getByText("of 600 ml")).toBeTruthy();
});
