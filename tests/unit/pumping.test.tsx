/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { type ComponentProps } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import App from "@/App";
import { LogSheet } from "@/components/LogSheet";
import { WhatsNew } from "@/components/WhatsNew";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import TimelineScreen from "@/screens/TimelineScreen";
import { STORAGE_KEY } from "@/hooks/useTrackerStore";
import { activityDetail, activityTitle } from "@/domain/activityDisplay";
import { RELEASES } from "@/domain/changelog";
import { isTimedType } from "@/domain/timers";
import { setUnits } from "@/domain/units";
import { Activity, FeedingMode } from "@/domain/types";
import { seedLog, stubBrowser } from "./appHarness";

// Asked for from the feedback box by a mum who pumps with most feeds, but
// not all: how long since the last one, "instead of 15012310 timers". A pump
// is logged when it is done and is never timed — it keeps its own time.

// 15 Oct 2026, 15:00 local, on the minute: a Finished of "now" is exactly
// now, so "Pumped 15m ago" right after a 15-minute pump is exact. Only Date
// is faked; React and the app's intervals keep running on real timers.
const NOW = new Date(2026, 9, 15, 15, 0).getTime();
const MINUTE = 60_000;
const DAY = 1_440 * MINUTE;
const at = (minutesFromNow: number) => new Date(NOW + minutesFromNow * MINUTE).toISOString();

beforeEach(() => {
  stubBrowser();
  vi.useFakeTimers({ toFake: ["Date"], now: NOW });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
  setUnits("metric");
});

/** A family past onboarding, feeding this way, with this log. */
function seed(activities: Activity[], feedingMode: FeedingMode = "mixed") {
  seedLog(activities);
  const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY)!);
  saved.profile.feedingMode = feedingMode;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

const stored = () => JSON.parse(window.localStorage.getItem(STORAGE_KEY)!).activities as Activity[];

/** A finished pump that started this many minutes ago. */
function pump(id: string, startedMinutesAgo: number, minutes: number, extra: Partial<Activity> = {}): Activity {
  return { id, type: "pump", side: "both", startedAt: at(-startedMinutesAgo), endedAt: at(-startedMinutesAgo + minutes), ...extra };
}

const findRow = (name: RegExp) => Array.from(document.querySelectorAll("button")).find((b) => name.test(b.textContent ?? "")) ?? null;

async function rowOnToday(name: RegExp) {
  return waitFor(() => {
    const found = findRow(name);
    if (!found) throw new Error("not on Today yet");
    return found;
  }, { timeout: 5_000 });
}

const pumpingRow = () => rowOnToday(/^Pumping/);

/** Today on screen — the Tummy time row is there for every family. */
const todayShown = () => rowOnToday(/^Tummy time/);

async function logPumpFromToday() {
  // Found before act: inside it, the boot that puts Today on screen waits.
  const row = await pumpingRow();
  await act(async () => fireEvent.click(row));
  const save = await screen.findByRole("button", { name: "Save pump · 15m" });
  await act(async () => fireEvent.click(save));
}

type SheetProps = ComponentProps<typeof LogSheet>;

/** The log sheet on its own, as the App opens it. */
function renderSheet(props: Partial<SheetProps>) {
  const onAdd = vi.fn((entry: Activity, message: string) => Boolean(entry && message));
  const base: SheetProps = {
    sheet: "pump",
    editingActivity: null,
    initialNursingMode: "timer",
    lastBottle: undefined,
    activeNursing: undefined,
    activities: [],
    babyAgeMonths: 1,
    profile: { name: "Mia", birthDate: "2026-09-01", feedingMode: "mixed" },
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
  return { onAdd };
}

const checked = (name: string | RegExp) => screen.getByRole("radio", { name }).getAttribute("aria-checked") === "true";

test.each(["breast", "mixed"] as const)("a %s-feeding family has a Pumping row that opens the pump sheet", async (mode) => {
  seed([], mode);
  render(<App />);
  const row = await pumpingRow();
  expect(row.textContent).toContain("When, how long, how much");
  await act(async () => fireEvent.click(row));
  expect(await screen.findByRole("heading", { name: "Log a pump" })).toBeTruthy();
}, 15_000);

test("saved as it opens: one pump, ended now, started 15 minutes before, both sides, not measured", async () => {
  seed([]);
  render(<App />);
  await logPumpFromToday();

  const pumps = stored().filter((a) => a.type === "pump");
  expect(pumps).toHaveLength(1);
  expect(pumps[0]).toMatchObject({ type: "pump", endedAt: at(0), startedAt: at(-15), side: "both" });
  // Not measured is no amount at all — never 0.
  expect("amount" in pumps[0]).toBe(false);
  expect(await screen.findByText("Pump saved — 15m")).toBeTruthy();
}, 15_000);

test("a preset amount goes on the Save button, and is stored in millilitres in ounces too", () => {
  const metric = renderSheet({});
  // Offered, not picked: nothing is measured until she says so.
  expect(checked("90 ml")).toBe(false);
  fireEvent.click(screen.getByRole("radio", { name: "90 ml" }));
  fireEvent.click(screen.getByRole("button", { name: "Save 90 ml · 15m" }));
  expect(metric.onAdd.mock.calls[0][0]).toMatchObject({ type: "pump", amount: 90 });
  expect(metric.onAdd.mock.calls[0][1]).toBe("Pump saved — 15m · 90 ml");
  cleanup();

  setUnits("us");
  const us = renderSheet({});
  fireEvent.click(screen.getByRole("radio", { name: "3 oz" }));
  fireEvent.click(screen.getByRole("button", { name: "Save 3 oz · 15m" }));
  expect(us.onAdd.mock.calls[0][0]).toMatchObject({ type: "pump", amount: 89 });
});

test("the length and the side start where the last pump's were", () => {
  renderSheet({ activities: [pump("old", 600, 45, { side: "right" }), pump("last", 200, 20, { side: "left" })] });
  expect(checked("20 minutes")).toBe(true);
  expect(checked(/Left/)).toBe(true);
  expect(screen.getByRole("button", { name: "Save pump · 20m" })).toBeTruthy();
  cleanup();

  // A length that is not among the chips brings its own, in order, chosen.
  renderSheet({ activities: [pump("odd", 200, 25)] });
  const chips = screen.getAllByRole("radio", { name: /^\d+ minutes$/ });
  expect(chips.map((chip) => chip.textContent)).toEqual(["10m", "15m", "20m", "25m", "30m", "45m"]);
  expect(checked("25 minutes")).toBe(true);
  expect(checked(/Both/)).toBe(true);
  // And stays there when another length is tapped.
  fireEvent.click(screen.getByRole("radio", { name: "30 minutes" }));
  expect(screen.getByRole("radio", { name: "25 minutes" })).toBeTruthy();
  expect(checked("30 minutes")).toBe(true);
});

test("the row says how long since the last pump began, and what it gave", async () => {
  seed([pump("p", 130, 18, { amount: 120 })]);
  render(<App />);
  expect((await pumpingRow()).textContent).toContain("Pumped 2h 10m ago · 120 ml");
}, 15_000);

test("start to start, like Since last feed: a 15-minute pump just saved was 15 minutes ago", async () => {
  seed([]);
  render(<App />);
  await logPumpFromToday();
  await waitFor(() => expect(findRow(/^Pumping/)?.textContent).toContain("Pumped 15m ago"));
}, 15_000);

test("bottle-only: no row for formula, a row for breast milk or a pump in the last 14 days", async () => {
  const formula: Activity = { id: "f", type: "bottle", amount: 120, milkType: "formula", startedAt: at(-60) };

  seed([formula], "bottle");
  render(<App />);
  await todayShown();
  expect(findRow(/^Pumping/)).toBeNull();
  cleanup();

  seed([formula, { id: "e", type: "bottle", amount: 90, milkType: "expressed", startedAt: new Date(NOW - 3 * DAY).toISOString() }], "bottle");
  render(<App />);
  expect((await pumpingRow()).textContent).toContain("When, how long, how much");
  cleanup();

  seed([formula, pump("recent", 13 * 1_440, 15)], "bottle");
  render(<App />);
  expect((await pumpingRow()).textContent).toContain("Pumped 13d ago");
  cleanup();

  seed([formula, pump("old", 15 * 1_440, 15)], "bottle");
  render(<App />);
  await todayShown();
  expect(findRow(/^Pumping/)).toBeNull();
}, 30_000);

test("a pump is never a timer, and never a feed", async () => {
  expect(isTimedType("pump")).toBe(false);
  seed([{ id: "b", type: "bottle", amount: 120, milkType: "formula", startedAt: at(-60) }]);
  render(<App />);
  await logPumpFromToday();
  await waitFor(() => expect(findRow(/^Pumping/)?.textContent).toContain("Pumped 15m ago"));

  // Nothing to stop, anywhere: no Stop, Done or Wake up, no running row.
  expect(screen.queryAllByRole("button", { name: /^(Stop|Done|Wake up) —/ })).toHaveLength(0);
  expect(document.querySelector(".hearth .timer-row")).toBeNull();
  // Since last feed is still the bottle an hour ago.
  expect(document.querySelector(".hearth-figure")?.textContent).toBe("1h");
  expect(document.querySelector(".hearth-meta")?.textContent).toBe("Bottle · 120 ml");
}, 15_000);

test("while a nursing timer runs, a pump is logged beside it and the timer keeps going", async () => {
  seed([{ id: "n", type: "nursing", side: "left", startedAt: at(-10) }], "breast");
  render(<App />);
  await pumpingRow();
  expect(screen.getByRole("button", { name: "Stop — stop nursing timer" })).toBeTruthy();

  await logPumpFromToday();
  expect(stored().filter((a) => a.type === "pump")).toHaveLength(1);
  expect(stored().find((a) => a.id === "n")?.endedAt).toBeUndefined();
  expect(await screen.findByRole("button", { name: "Stop — stop nursing timer" })).toBeTruthy();
}, 15_000);

test("the Timeline has a Pumping filter after Nursing, and a pump reads amount first, then side and length", () => {
  const entry: Activity = {
    id: "p",
    type: "pump",
    side: "both",
    amount: 90,
    startedAt: new Date(2026, 9, 15, 2, 57).toISOString(),
    endedAt: new Date(2026, 9, 15, 3, 12).toISOString(),
  };
  const feed: Activity = { id: "n", type: "nursing", side: "left", startedAt: at(-90), endedAt: at(-75) };
  expect(activityTitle(entry)).toBe("Pumping");
  // The amount first: the line is cut short on a phone, and at the end it
  // was the amount that became "…". The row shows 02:57 beside it.
  expect(activityDetail(entry)).toBe("90 ml · Both sides · 15m");
  expect(activityDetail({ ...entry, note: "felt low" })).toBe("90 ml · Both sides · 15m · felt low");

  const onFilterChange = vi.fn();
  const timeline = (filter: "all" | "pump") => (
    <TimelineScreen activities={[feed, entry]} minuteClock={NOW} filter={filter} limit={50} onFilterChange={onFilterChange} onShowMore={() => {}} onEdit={() => {}} />
  );
  const view = render(timeline("all"));
  const names = screen.getAllByRole("radio").map((chip) => chip.getAttribute("aria-label"));
  expect(names.indexOf("Show pumping logs")).toBe(names.indexOf("Show nursing logs") + 1);
  fireEvent.click(screen.getByRole("radio", { name: "Show pumping logs" }));
  expect(onFilterChange).toHaveBeenCalledWith("pump");

  view.rerender(timeline("pump"));
  expect(screen.getByRole("radio", { name: "Show pumping logs" }).textContent).toBe("Pumping");
  const rows = screen.getAllByRole("listitem");
  expect(rows).toHaveLength(1);
  expect(rows[0].textContent).toContain("90 ml · Both sides · 15m");
});

test("an amount past 1,000 ml is refused, and the refusal says it can be left empty", () => {
  const { onAdd } = renderSheet({});
  fireEvent.change(screen.getByLabelText(/^Amount/), { target: { value: "2000" } });
  fireEvent.click(screen.getByRole("button", { name: "Save 2000 ml · 15m" }));
  expect(onAdd).not.toHaveBeenCalled();
  expect(screen.getByText("Enter an amount between 1 and 1,000 ml, or leave it empty.")).toBeTruthy();
  expect(screen.getByLabelText(/^Amount/).getAttribute("aria-invalid")).toBe("true");
});

test("a pump edited on a phone from before pumping loses only its length here: amount and side still read", async () => {
  // That build keeps a pump as "Entry", and saves an edit of it — Dad adding
  // a note — with no end. The row comes back to this phone like that.
  const edited: Activity = { ...pump("p", 130, 18, { amount: 120 }), endedAt: undefined, note: "dad's note" };
  expect(activityDetail(edited)).toBe("120 ml · Both sides · dad's note");

  seed([edited]);
  render(<App />);
  expect((await pumpingRow()).textContent).toContain("Pumped 2h 10m ago · 120 ml");
  // Its row in Recent, the only entry there.
  expect(document.querySelector(".recent-list .activity-row")?.textContent).toContain("Pumping120 ml · Both sides · dad's note");
  cleanup();

  // The next pump starts from the last one that still has a length, not
  // from the 15-minute fallback.
  renderSheet({ activities: [pump("whole", 600, 20, { side: "left" }), edited] });
  expect(checked("20 minutes")).toBe(true);
  expect(checked(/Left/)).toBe(true);
}, 15_000);

test("the News card on Today shows every line of the pumping release, the update-both-phones one too", () => {
  // The card shows the first four lines; a fifth is only in the archive.
  const release = RELEASES.find((entry) => entry.id === "2026-10-15.4")!;
  expect(release.items.length).toBeLessThanOrEqual(4);
  render(<WhatsNew releaseIds={[release.id]} onDismiss={() => {}} onAction={() => {}} />);
  fireEvent.click(screen.getByRole("button", { name: /Pumping, and how long since the last one/ }));
  const lines = screen.getAllByRole("listitem").map((line) => line.textContent);
  expect(lines).toEqual(release.items);
  expect(lines.some((line) => line?.includes("Update the app on both phones"))).toBe(true);
});
