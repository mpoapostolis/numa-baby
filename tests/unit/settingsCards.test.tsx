/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FamilySyncCard } from "@/components/FamilySyncCard";
import { FamilyPairing } from "@/domain/familyPairing";
import { Profile } from "@/domain/types";
import { FamilySync } from "@/hooks/useFamilySync";
import SettingsScreen from "@/screens/SettingsScreen";
import { stubBrowser } from "./appHarness";

const profile: Profile = { name: "Mia", birthDate: "2026-09-01", feedingMode: "mixed" };
const NOW = new Date(2026, 9, 14, 13, 0).getTime();

function fakeFamilySync(pairing: FamilyPairing | null, deviceCount: number | null): FamilySync {
  return {
    pairing,
    status: { phase: "idle", lastSyncAt: null, deviceCount },
    createFamily: vi.fn(async () => true),
    createInvite: vi.fn(async () => ({ code: "123456", expiresAt: new Date(NOW + 15 * 60_000).toISOString() })),
    joinFamily: vi.fn(async () => true),
    syncNow: vi.fn(async () => true),
    googleProtect: vi.fn(),
    googleUnprotect: vi.fn(),
    googleProbe: vi.fn(),
    googleContinue: vi.fn(),
    localEntryCount: vi.fn(() => 0),
    emailProtect: vi.fn(),
    emailRedeem: vi.fn(),
    recoveryEmail: vi.fn(async () => null),
    leaveFamily: vi.fn(),
    listDevices: vi.fn(async () => []),
    revokeDevice: vi.fn(async () => true),
  } as unknown as FamilySync;
}

beforeEach(() => {
  window.localStorage.clear();
  stubBrowser();
  // Vite defines this at build time; the suite has no build.
  vi.stubGlobal("__APP_VERSION__", "test");
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// "These now arrive with the app closed", and right under it "Around 14:30,
// if this app is still open" — a parent could keep the screen on all night
// for a reminder the server was already holding.
describe("the reminder rows in Settings", () => {
  function settings(pushArmed: boolean) {
    const noop = () => {};
    render(
      <SettingsScreen
        profile={profile}
        themeChoice="system"
        reminders={{ feedEnabled: true, feedIntervalMinutes: 180, diaperEnabled: true, diaperIntervalMinutes: 120 }}
        notificationPermission="granted"
        feedReminderTargetAt={NOW + 90 * 60_000}
        diaperReminderTargetAt={NOW + 60 * 60_000}
        pushArmed={pushArmed}
        minuteClock={NOW}
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
        familySync={fakeFamilySync(null, null)}
        entryCount={0}
      />,
    );
    return {
      feed: document.getElementById("feed-reminder-status")!.textContent,
      diaper: document.getElementById("diaper-reminder-status")!.textContent,
    };
  }

  it("does not ask for the app to stay open once the server holds the reminder", () => {
    const { feed, diaper } = settings(true);
    expect(feed).toMatch(/^Around \S+$/);
    expect(diaper).toMatch(/^Around \S+$/);
  });

  it("still says so when only the open app can ring it", () => {
    const { feed, diaper } = settings(false);
    expect(feed).toMatch(/^Around \S+, if this app is still open$/);
    expect(diaper).toMatch(/^Around \S+, if this app is still open$/);
  });
});

// A family of one — created for the cloud backup — tapped "Show invite code"
// and lost Sync now and Leave family: "Done" only appeared once a partner
// had joined, so the code view had no way out.
describe("the invite code in a one-phone family", () => {
  const pairing = { familyId: "fam", token: "tok", deviceId: "dev", deviceLabel: "Mia’s tracker" } as FamilyPairing;

  it("can be put away again with Back", async () => {
    const familySync = fakeFamilySync(pairing, 1);
    render(<FamilySyncCard familySync={familySync} profile={profile} entryCount={3} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Show invite code" }));
    });
    expect(document.querySelector(".family-code")!.textContent).toBe("123456");
    expect(screen.queryByRole("button", { name: "Sync now" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(document.querySelector(".family-code")).toBeNull();
    expect(screen.getByRole("button", { name: "Sync now" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Leave family" })).toBeTruthy();
  });

  it("says Done once the other phone has joined", async () => {
    const familySync = fakeFamilySync(pairing, 1);
    const view = render(<FamilySyncCard familySync={familySync} profile={profile} entryCount={3} />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Show invite code" }));
    });
    view.rerender(<FamilySyncCard familySync={{ ...familySync, status: { ...familySync.status, deviceCount: 2 } }} profile={profile} entryCount={3} />);
    expect(screen.getByRole("button", { name: "Done" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });
});
