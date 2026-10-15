/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { LogSheet } from "@/components/LogSheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Profile } from "@/domain/types";
import { stubBrowser } from "./appHarness";

// The profile sheet never shows the routine list, so it must never write an
// old copy of it back: the other parent may add "Vitamin D" while this sheet
// is open, and Save profile used to quietly take it away again.

beforeEach(() => {
  stubBrowser();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function sheet(profile: Profile, onSaveProfile: (profile: Profile) => boolean) {
  return (
    <Dialog open>
      <DialogContent>
        <LogSheet
          sheet="profile"
          editingActivity={null}
          initialNursingMode="timer"
          lastBottle={undefined}
          activeNursing={undefined}
          activities={[]}
          babyAgeMonths={1}
          profile={profile}
          onAdd={() => true}
          onUpdate={() => true}
          onRemove={() => true}
          onSaveProfile={onSaveProfile}
          onClose={() => {}}
          showToast={() => {}}
          monthEntries={[]}
          vaccineEntries={[]}
          onUpsert={() => true}
        />
      </DialogContent>
    </Dialog>
  );
}

test("saving the profile keeps a routine the other parent added while the sheet was open", async () => {
  const opened: Profile = { name: "Mia", birthDate: "2026-09-01", feedingMode: "mixed", routines: [{ id: "bath", label: "Bath" }] };
  const onSaveProfile = vi.fn(() => true);
  const { rerender } = render(sheet(opened, onSaveProfile));
  await screen.findByLabelText("Name");

  // A pull adopts the partner's newer profile underneath the open sheet.
  const pulled: Profile = { ...opened, routines: [{ id: "bath", label: "Bath" }, { id: "vitamin-d", label: "Vitamin D" }] };
  rerender(sheet(pulled, onSaveProfile));

  fireEvent.change(screen.getByLabelText("Name"), { target: { value: "Mia Rose" } });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Save profile" })));

  expect(onSaveProfile).toHaveBeenCalledTimes(1);
  const saved = (onSaveProfile.mock.calls[0] as unknown as [Profile])[0];
  expect(saved.name).toBe("Mia Rose");
  expect(saved.routines).toEqual(pulled.routines);
});
