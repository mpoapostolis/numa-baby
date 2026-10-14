/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { VaccinesSheet } from "@/components/VaccinesSheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Activity } from "@/domain/types";

// Asked for from the feedback box: "a section for vaccinations/immunizations
// — one where we can get in public health center and vaccines/boosters that
// are in private hospitals/clinics. We can log the schedule and the vaccines
// we have for that day."

const NOW = new Date(2026, 9, 14, 9, 0).getTime();
const stamped = new Date(NOW - 86_400_000).toISOString();

beforeEach(() => {
  // jsdom does no layout; forms scroll to their error and to the top.
  Element.prototype.scrollIntoView = () => {};
  Element.prototype.scrollTo = () => {};
});
afterEach(() => cleanup());

function setup(vaccines: Activity[] = []) {
  const onAdd = vi.fn((entry: Activity, message: string) => Boolean(entry && message));
  const onUpdate = vi.fn((entry: Activity, message: string, undo?: () => void) => Boolean(entry && message) || Boolean(undo));
  const onRemove = vi.fn((entry: Activity, message: string) => Boolean(entry && message));
  render(
    <Dialog open>
      <DialogContent>
        <VaccinesSheet name="Mia" vaccines={vaccines} now={NOW} onAdd={onAdd} onUpdate={onUpdate} onRemove={onRemove} />
      </DialogContent>
    </Dialog>,
  );
  return { onAdd, onUpdate, onRemove };
}

const textbox = (name: RegExp) => screen.getByRole("textbox", { name }) as HTMLInputElement;
const dateInput = () => document.querySelector<HTMLInputElement>('input[type="date"]')!;

test("a vaccine given today is logged with where it was given", () => {
  const { onAdd } = setup();
  fireEvent.click(screen.getByRole("button", { name: "Record a vaccine" }));
  fireEvent.change(textbox(/^Vaccine/), { target: { value: "BCG" } });
  fireEvent.change(textbox(/^Dose/), { target: { value: "1st dose" } });
  fireEvent.click(screen.getByRole("radio", { name: /Private clinic/ }));
  fireEvent.click(screen.getByRole("button", { name: "Save vaccine" }));

  const [saved, message] = onAdd.mock.calls[0];
  expect(saved).toMatchObject({ type: "vaccine", vaccine: "BCG", dose: "1st dose", place: "private" });
  expect(saved.planned).toBeUndefined();
  expect(new Date(saved.startedAt).getTime()).toBeLessThanOrEqual(NOW);
  expect(message).toBe("BCG · 1st dose saved");
});

test("a vaccine on the schedule is kept as planned, its date apart from the entry's", () => {
  const { onAdd } = setup();
  fireEvent.click(screen.getByRole("button", { name: "Add appointment" }));
  fireEvent.change(textbox(/^Vaccine/), { target: { value: "Pentavalent" } });
  fireEvent.change(textbox(/^Dose/), { target: { value: "2nd dose" } });
  fireEvent.change(dateInput(), { target: { value: "2026-11-20" } });
  fireEvent.click(screen.getByRole("radio", { name: /Public health center/ }));
  fireEvent.click(screen.getByRole("button", { name: "Save appointment" }));

  const saved = onAdd.mock.calls[0][0];
  expect(saved).toMatchObject({ type: "vaccine", vaccine: "Pentavalent", planned: true, due: "2026-11-20", place: "public" });
  // The entry is stamped now; entries dated ahead are discarded on load.
  expect(new Date(saved.startedAt).getTime()).toBeLessThanOrEqual(NOW);
});

test("the schedule comes first, soonest first, and a dose due today is given in one tap", () => {
  const { onUpdate } = setup([
    { id: "late", type: "vaccine", vaccine: "MMR", planned: true, due: "2027-04-01", startedAt: stamped },
    { id: "soon", type: "vaccine", vaccine: "Pentavalent", dose: "2nd dose", planned: true, due: "2026-10-14", place: "public", startedAt: stamped },
    { id: "week", type: "vaccine", vaccine: "PCV", dose: "2nd dose", planned: true, due: "2026-10-18", startedAt: stamped },
    { id: "done", type: "vaccine", vaccine: "BCG", startedAt: stamped },
  ]);
  const text = document.body.textContent ?? "";
  expect(text.indexOf("Pentavalent")).toBeLessThan(text.indexOf("MMR"));
  expect(text.indexOf("MMR")).toBeLessThan(text.indexOf("BCG"));
  // Days or months away: no Mark given to mis-tap at 3am — only on the day,
  // or once it is late.
  expect(screen.queryByRole("button", { name: /Mark MMR/ })).toBeNull();
  expect(screen.queryByRole("button", { name: /Mark PCV/ })).toBeNull();

  fireEvent.click(screen.getByRole("button", { name: "Mark Pentavalent, 2nd dose, as given today" }));
  const [given, message, undo] = onUpdate.mock.calls[0];
  expect(given).toMatchObject({ id: "soon", vaccine: "Pentavalent", dose: "2nd dose", place: "public" });
  expect(given.planned).toBeUndefined();
  expect(given.due).toBeUndefined();
  expect(message).toBe("Pentavalent · 2nd dose given today");
  expect(typeof undo).toBe("function");
});

test("a missed appointment stays planned — the date passing does not make it given", () => {
  setup([{ id: "missed", type: "vaccine", vaccine: "Rotavirus", planned: true, due: "2026-10-01", startedAt: new Date(NOW - 30 * 86_400_000).toISOString() }]);
  expect(document.body.textContent).toContain("13 days late");
});

test("a date still to come under 'Record a vaccine' is questioned, not quietly made today", () => {
  const { onAdd } = setup();
  fireEvent.click(screen.getByRole("button", { name: "Record a vaccine" }));
  fireEvent.change(textbox(/^Vaccine/), { target: { value: "MMR" } });
  fireEvent.change(dateInput(), { target: { value: "2026-10-20" } });
  fireEvent.click(screen.getByRole("button", { name: "Save vaccine" }));
  expect(onAdd).not.toHaveBeenCalled();
  expect(document.body.textContent).toContain("still to come");
});

test("logging a dose that waits on the schedule gives THAT one, rather than a copy", () => {
  const { onAdd, onUpdate } = setup([
    { id: "pcv2", type: "vaccine", vaccine: "PCV", dose: "2nd dose", planned: true, due: "2026-10-11", startedAt: stamped },
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Record a vaccine" }));
  fireEvent.change(textbox(/^Vaccine/), { target: { value: "pcv" } });
  fireEvent.change(textbox(/^Dose/), { target: { value: "2nd dose" } });
  fireEvent.click(screen.getByRole("button", { name: "Save vaccine" }));
  expect(onAdd).not.toHaveBeenCalled();
  expect(onUpdate.mock.calls[0][0]).toMatchObject({ id: "pcv2" });
  expect(onUpdate.mock.calls[0][0].planned).toBeUndefined();
});

test("a vaccine given before is one tap, with the next dose counted", () => {
  setup([{ id: "p1", type: "vaccine", vaccine: "Pentavalent", dose: "1st dose", place: "public", startedAt: stamped }]);
  fireEvent.click(screen.getByRole("button", { name: "Record a vaccine" }));
  fireEvent.click(screen.getByRole("button", { name: /^Pentavalent/ }));
  expect(textbox(/Or type the name/).value).toBe("Pentavalent");
  expect(textbox(/^Dose/).value).toBe("2nd dose");
});

test("the card opens with focus on its main action, in the thumb's reach", () => {
  setup();
  expect(screen.getByRole("button", { name: "Record a vaccine" }).hasAttribute("data-initial-focus")).toBe(true);
});

// Dose is optional, so two entries without one are "the same dose" — and a
// booking a month away must not be taken off the schedule by it.
test("a dose logged today does not take an appointment that is weeks away", () => {
  const { onAdd, onUpdate } = setup([
    { id: "nov", type: "vaccine", vaccine: "Pentavalent", planned: true, due: "2026-11-14", startedAt: stamped },
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Record a vaccine" }));
  fireEvent.change(textbox(/^Vaccine/), { target: { value: "Pentavalent" } });
  fireEvent.click(screen.getByRole("button", { name: "Save vaccine" }));
  expect(onUpdate).not.toHaveBeenCalled();
  expect(onAdd.mock.calls[0][0]).toMatchObject({ vaccine: "Pentavalent" });
});

test("an earlier dose filled in afterwards does not take today's appointment", () => {
  const { onAdd, onUpdate } = setup([
    { id: "due", type: "vaccine", vaccine: "Pentavalent", planned: true, due: "2026-10-13", startedAt: new Date(NOW - 60_000).toISOString() },
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Record a vaccine" }));
  fireEvent.change(textbox(/^Vaccine/), { target: { value: "Pentavalent" } });
  fireEvent.change(dateInput(), { target: { value: "2026-08-10" } });
  fireEvent.click(screen.getByRole("button", { name: "Save vaccine" }));
  expect(onUpdate).not.toHaveBeenCalled();
  expect(onAdd).toHaveBeenCalled();
});

// "Next dose of" offers what is still to arrange: not a dose already on the
// card as an appointment, and not a vaccine with no next dose.
test("next-dose chips leave out a dose already booked and a vaccine given at birth", () => {
  setup([
    { id: "p1", type: "vaccine", vaccine: "Pentavalent", dose: "1st dose", startedAt: stamped },
    { id: "p2", type: "vaccine", vaccine: "Pentavalent", dose: "2nd dose", planned: true, due: "2026-11-20", startedAt: stamped },
    { id: "r1", type: "vaccine", vaccine: "Rotavirus", dose: "1st dose", startedAt: stamped },
    { id: "b", type: "vaccine", vaccine: "BCG", dose: "At birth", startedAt: stamped },
  ]);
  fireEvent.click(screen.getByRole("button", { name: "Add appointment" }));
  const chips = screen.getByRole("group", { name: "Next dose of" }).textContent ?? "";
  expect(chips).toContain("Rotavirus");
  expect(chips).not.toContain("Pentavalent");
  expect(chips).not.toContain("BCG");
});

// Nothing chosen until a parent chooses: last time's place is not assumed.
test("where it was given starts unchosen", () => {
  const { onAdd } = setup([{ id: "x", type: "vaccine", vaccine: "BCG", place: "public", startedAt: stamped }]);
  fireEvent.click(screen.getByRole("button", { name: "Record a vaccine" }));
  fireEvent.change(textbox(/Or type the name|^Vaccine/), { target: { value: "MMR" } });
  fireEvent.click(screen.getByRole("button", { name: "Save vaccine" }));
  expect(onAdd.mock.calls[0][0].place).toBeUndefined();
});
