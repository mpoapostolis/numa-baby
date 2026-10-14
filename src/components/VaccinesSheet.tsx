// The health card: what was given, and what is next.
//
// Asked for from the feedback box: "a section for vaccinations/immunizations
// — one where we can get in public health center and vaccines/boosters that
// are in private hospitals/clinics. We can log the schedule and the vaccines
// we have for that day."
//
// The app records what the parents tell it, like a medicine: it carries no
// national schedule and gives no advice — that would need a verified source
// per country, and the health center's own card is the authority. It counts
// doses ("2nd" after "1st"); it never says when one is due.
//
// A planned vaccine is an entry stamped when it was PLANNED, with the
// appointment in `due`: anything dated two days ahead is discarded on load,
// by this build and by older ones. And "given" is never worked out from the
// date — a missed appointment stays planned, marked late, until a parent
// says it was given.

import "../styles/screens/keepsake.css";
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronRight, Plus, Syringe, Trash2 } from "lucide-react";
import { Button } from "./ui/button";
import { DialogFooter } from "./ui/dialog";
import { Field, FieldLabel } from "./ui/field";
import { InputGroup, InputGroupInput } from "./ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { FormError, LogDialogHeader, NoteField, SheetForm } from "./fields";
import { useCloseOnBack } from "../hooks/useCloseOnBack";
import { NOTE_MAX_LENGTH } from "../domain/activitySchema";
import { makeId } from "../domain/id";
import { localDateInput } from "../domain/time";
import { Activity } from "../domain/types";
import { dueLabel, dueSoon, vaccineLabel } from "../domain/vaccines";
import { nextDose } from "../domain/vaccineDoses";

type Place = "public" | "private";
type Seed = { vaccine?: string; dose?: string; place?: Place };
type Mode = { kind: "given" | "planned"; editing?: Activity; seed?: Seed };

const PLACES: { key: Place; label: string; short: string }[] = [
  { key: "public", label: "Public health center", short: "Health center" },
  { key: "private", label: "Private clinic", short: "Private clinic" },
];
const DOSES = ["1st", "2nd", "3rd", "Booster"];

function placeShort(place: unknown) {
  return PLACES.find((p) => p.key === place)?.short;
}

function isPlace(value: unknown): value is Place {
  return value === "public" || value === "private";
}

function dueDate(due: string) {
  return new Date(`${due}T12:00:00`);
}

/** "Jun 28" this year, "Jun 28, 2025" otherwise. */
function shortDate(value: Date, now: number) {
  const sameYear = value.getFullYear() === new Date(now).getFullYear();
  return value.toLocaleDateString("en", sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

/** YYYY-MM-DD of a local day. */
function dayInput(day: Date) {
  return localDateInput(day).slice(0, 10);
}

/** Due soon enough to have just been given: late, or within the week. */
function VaccineForm({
  mode,
  vaccines,
  now,
  onSave,
  onDelete,
  onBack,
  onPick,
}: {
  mode: Mode;
  vaccines: Activity[];
  now: number;
  onSave: (entry: Activity) => boolean;
  onDelete?: () => void;
  onBack: () => void;
  onPick: (planned: Activity) => void;
}) {
  const editing = mode.editing;
  const marking = mode.kind === "given" && Boolean(editing?.planned);
  const creating = !editing;
  const nameId = useId();
  const doseId = useId();
  const dateId = useId();
  const whereId = useId();
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  const nameRef = useRef<HTMLInputElement | null>(null);
  const dueRef = useRef<HTMLInputElement | null>(null);
  const givenRef = useRef<HTMLInputElement | null>(null);

  // The view that replaced the list: focus its title (announced, and no
  // keyboard thrown up unasked), from the top of the sheet.
  useEffect(() => {
    const title = titleRef.current;
    title?.closest(".bottom-sheet")?.scrollTo?.({ top: 0 });
    title?.focus({ preventScroll: true });
  }, []);

  const [name, setName] = useState(editing?.vaccine ?? mode.seed?.vaccine ?? "");
  const [dose, setDose] = useState(editing?.dose ?? mode.seed?.dose ?? "");
  const [place, setPlace] = useState<Place | undefined>(
    // Nothing chosen until a parent chooses: a private-clinic dose saved as
    // the health center because that was last time is the mistake to avoid.
    isPlace(editing?.place) ? editing.place : mode.seed?.place,
  );
  // Recorded by the day, as the card does. Marking a planned dose as given
  // starts from today, not from its due date.
  const [given, setGiven] = useState(dayInput(new Date(editing && !editing.planned ? editing.startedAt : now)));
  const [due, setDue] = useState(editing?.due ?? "");
  const [note, setNote] = useState(editing?.note ?? "");
  const [error, setError] = useState<{ field: "name" | "due" | "given"; message: string } | null>(null);

  // Doses already on the card, one chip per vaccine, newest first: picking
  // one is a tap, spelled the same as last time, the next dose counted.
  const previous: Activity[] = [];
  const sameName = (a?: string, b?: string) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
  for (const v of [...vaccines].filter((v) => !v.planned && v.vaccine).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1))) {
    if (!previous.some((p) => sameName(p.vaccine, v.vaccine))) previous.push(v);
  }
  // Only a next dose that is still to arrange: not one already on the card
  // as an appointment, and not a vaccine that has no next dose (at birth).
  const nextDoses = previous.filter((v) =>
    nextDose(v.dose) && !vaccines.some((p) => p.planned && sameName(p.vaccine, v.vaccine) && sameName(p.dose, nextDose(v.dose))),
  );
  // Late first, then the soonest.
  const fromSchedule = creating && mode.kind === "given"
    ? vaccines.filter((v) => v.planned && dueSoon(v, now)).sort((a, b) => (a.due! < b.due! ? -1 : 1))
    : [];

  function fail(field: "name" | "due" | "given", message: string) {
    setError({ field, message });
    const ref = field === "name" ? nameRef : field === "due" ? dueRef : givenRef;
    window.requestAnimationFrame(() => ref.current?.focus());
  }

  function save() {
    const vaccine = name.trim().slice(0, 80);
    if (!vaccine) return fail("name", "Which vaccine?");
    const entry: Activity = {
      ...(editing ?? {}),
      id: editing?.id ?? makeId(),
      type: "vaccine",
      vaccine,
      startedAt: editing?.startedAt ?? new Date(now).toISOString(),
    };
    delete entry.planned;
    delete entry.due;
    delete entry.dose;
    delete entry.place;
    delete entry.note;
    if (dose.trim()) entry.dose = dose.trim().slice(0, 40);
    if (place) entry.place = place;
    if (note.trim()) entry.note = note.trim().slice(0, NOTE_MAX_LENGTH);
    if (mode.kind === "planned") {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return fail("due", "When is it due?");
      entry.planned = true;
      entry.due = due;
    } else {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(given)) return fail("given", "When was it given?");
      // A date still to come is an appointment, not a dose given: say so,
      // rather than quietly saving it as given today.
      if (given > dayInput(new Date(now))) return fail("given", "That date is still to come — add it with Add appointment.");
      // Midday on that day; today, now — never a moment ahead of the clock.
      const midday = new Date(`${given}T12:00:00`).getTime();
      entry.startedAt = new Date(Math.min(midday, now)).toISOString();
    }
    if (onSave(entry)) onBack();
  }

  const label = editing ? vaccineLabel(editing) : "";
  const where = placeShort(editing?.place);
  const header = marking && editing?.due
    ? { eyebrow: "Mark as given", title: label, description: `Was due ${dueLabel(editing.due, now).inline}${where ? ` · ${where}` : ""}` }
    : editing?.planned && editing.due
      ? { eyebrow: "Planned", title: label, description: `Due ${dueLabel(editing.due, now).inline}${where ? ` · ${where}` : ""}` }
      : editing
        ? { eyebrow: "Given", title: label, description: `${shortDate(new Date(editing.startedAt), now)}${where ? ` · ${where}` : ""}` }
        : mode.kind === "planned"
          ? { eyebrow: "Vaccines", title: "Add appointment", description: "The next date from the health center or clinic card." }
          : { eyebrow: "Vaccines", title: "Record a vaccine", description: "One the baby has had — as written on the card." };
  const saveLabel = marking ? "Save as given" : editing ? "Save changes" : mode.kind === "planned" ? "Save appointment" : "Save vaccine";

  const givenShortcuts = [
    { key: "today", label: "Today", value: dayInput(new Date(now)) },
    { key: "yesterday", label: "Yesterday", value: dayInput(new Date(now - 86_400_000)) },
    // A late dose was most likely given on the appointment day itself.
    ...(marking && editing?.due && dueLabel(editing.due, now).overdue
      ? [{ key: "due", label: `On ${shortDate(dueDate(editing.due), now)}`, value: editing.due }]
      : []),
  ];

  return (
    <SheetForm onSubmit={save}>
      <LogDialogHeader icon={<Syringe />} tone="glyph-medicine" eyebrow={header.eyebrow} title={header.title} description={header.description} titleRef={titleRef} />

      {fromSchedule.length > 0 && (
        <Field className="medicine-field">
          <FieldLabel>Late or this week</FieldLabel>
          <div className="medicine-presets" role="group" aria-label="Late or this week">
            {fromSchedule.map((v) => (
              <button key={v.id} type="button" className="medicine-preset" onClick={() => onPick(v)}>
                <strong>{vaccineLabel(v)}</strong>
                <small>{v.due ? dueLabel(v.due, now).text : ""}</small>
              </button>
            ))}
          </div>
        </Field>
      )}

      {creating && nextDoses.length > 0 && (
        <Field className="medicine-field">
          <FieldLabel>Next dose of</FieldLabel>
          <div className="medicine-presets" role="group" aria-label="Next dose of">
            {nextDoses.map((v) => (
              <button
                key={v.id}
                type="button"
                className={name.trim().toLowerCase() === v.vaccine!.trim().toLowerCase() ? "medicine-preset is-active" : "medicine-preset"}
                onClick={() => {
                  setName(v.vaccine!);
                  setDose(nextDose(v.dose));
                  if (isPlace(v.place)) setPlace(v.place);
                  setError(null);
                }}
              >
                <strong>{v.vaccine}</strong>
                {/* What the tap fills in: the dose after the last one given. */}
                <small>{nextDose(v.dose)}</small>
              </button>
            ))}
          </div>
        </Field>
      )}

      <Field data-invalid={error?.field === "name" || undefined}>
        <FieldLabel htmlFor={nameId}>{nextDoses.length > 0 && creating ? "Or type the name" : "Vaccine"}</FieldLabel>
        <InputGroup>
          <InputGroupInput
            id={nameId}
            ref={nameRef}
            value={name}
            maxLength={80}
            placeholder="e.g. BCG, Pentavalent, MMR"
            aria-invalid={error?.field === "name"}
            aria-describedby={error?.field === "name" ? "sheet-error" : undefined}
            onChange={(event) => { setName(event.target.value); setError(null); }}
          />
        </InputGroup>
      </Field>



      {mode.kind === "planned" && (
        <Field data-invalid={error?.field === "due" || undefined}>
          <FieldLabel htmlFor={dateId}>Date</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id={dateId}
              ref={dueRef}
              type="date"
              value={due}
              min={creating ? localDateInput(new Date(now)).slice(0, 10) : undefined}
              aria-invalid={error?.field === "due"}
              aria-describedby={error?.field === "due" ? "sheet-error" : undefined}
              onChange={(event) => { setDue(event.target.value); setError(null); }}
            />
          </InputGroup>
        </Field>
      )}

      {mode.kind === "given" && (
        <Field data-invalid={error?.field === "given" || undefined}>
          <FieldLabel htmlFor={dateId}>Given on</FieldLabel>
          <InputGroup>
            <InputGroupInput
              id={dateId}
              ref={givenRef}
              type="date"
              value={given}
              max={dayInput(new Date(now))}
              aria-invalid={error?.field === "given"}
              aria-describedby={error?.field === "given" ? "sheet-error" : undefined}
              onChange={(event) => { setGiven(event.target.value); setError(null); }}
            />
          </InputGroup>
          <ToggleGroup
            type="single"
            className="preset-row quick-time"
            aria-label="Given on"
            value={givenShortcuts.find((shortcut) => shortcut.value === given)?.key ?? ""}
            onValueChange={(key) => {
              const shortcut = givenShortcuts.find((candidate) => candidate.key === key);
              if (shortcut) { setGiven(shortcut.value); setError(null); }
            }}
          >
            {givenShortcuts.map((shortcut) => <ToggleGroupItem key={shortcut.key} value={shortcut.key}>{shortcut.label}</ToggleGroupItem>)}
          </ToggleGroup>
        </Field>
      )}


      <Field>
        <FieldLabel id={whereId}>Where <span className="optional-label">Optional</span></FieldLabel>
        {/* Under the date, so both are seen before Save. The app's
            segmented control; a second tap clears it, because "Where" is
            optional. */}
        <ToggleGroup
          type="single"
          value={place ?? ""}
          className="segmented"
          aria-labelledby={whereId}
          onValueChange={(value) => setPlace(isPlace(value) ? value : undefined)}
        >
          {PLACES.map((option) => (
            <ToggleGroupItem key={option.key} value={option.key} aria-label={option.label}>
              {option.short}
              <Check className="choice-check" />
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>

      <Field>
        <FieldLabel htmlFor={doseId}>Dose <span className="optional-label">Optional</span></FieldLabel>
        <InputGroup>
          <InputGroupInput id={doseId} value={dose} maxLength={40} placeholder="1st dose, booster…" onChange={(event) => setDose(event.target.value)} />
        </InputGroup>
        <ToggleGroup
          type="single"
          className="preset-row quick-time"
          aria-label="Dose"
          value={DOSES.find((d) => dose === (d === "Booster" ? d : `${d} dose`)) ?? ""}
          onValueChange={(value) => value && setDose(value === "Booster" ? value : `${value} dose`)}
        >
          {DOSES.map((d) => <ToggleGroupItem key={d} value={d}>{d}</ToggleGroupItem>)}
        </ToggleGroup>
      </Field>

      <NoteField value={note} onChange={setNote} placeholder="Batch number, reaction, next visit…" />
      <FormError message={error?.message ?? null} />

      {onDelete && (
        <div className="edit-danger">
          <Button type="button" variant="ghost" onClick={onDelete}>
            <Trash2 size={17} aria-hidden="true" /> {editing?.planned ? "Remove from the schedule" : "Delete this vaccine"}
          </Button>
        </div>
      )}

      {/* The sheet's own sticky footer; Back returns to the card. */}
      <DialogFooter>
        <Button type="button" variant="ghost" className="sheet-cancel" onClick={onBack}>Back</Button>
        <Button type="submit" className="primary-button sheet-primary">
          {saveLabel}
        </Button>
      </DialogFooter>
    </SheetForm>
  );
}

export function VaccinesSheet({
  name,
  vaccines,
  now,
  onAdd,
  onUpdate,
  onRemove,
}: {
  name: string;
  vaccines: Activity[];
  now: number;
  onAdd: (entry: Activity, message: string) => boolean;
  onUpdate: (entry: Activity, message: string, undo?: () => void) => boolean;
  onRemove: (entry: Activity, message: string) => boolean;
}) {
  const [mode, setMode] = useState<Mode | null>(null);
  // The dose just marked given, for its "Plan the next dose" offer.
  const [justGiven, setJustGiven] = useState<string | null>(null);
  // Back (or Save) returns focus to what opened the form, not to the top.
  const [returnTo, setReturnTo] = useState<string | null>(null);
  const card = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (mode !== null || !returnTo) return;
    card.current?.querySelector<HTMLElement>(`[data-focus-key="${returnTo}"]`)?.focus();
  }, [mode, returnTo]);
  // Android back from a form returns to the card, as the on-screen Back does.
  useCloseOnBack(mode !== null, () => setMode(null));

  const open = (next: Mode, from: string) => {
    setReturnTo(from);
    setMode(next);
  };

  const planned = vaccines.filter((v) => v.planned && v.due).sort((a, b) => (a.due! < b.due! ? -1 : 1));
  const given = vaccines.filter((v) => !v.planned).sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  const late = planned.filter((v) => dueLabel(v.due!, now).overdue).length;
  const who = name.trim();

  function markGiven(v: Activity) {
    const next: Activity = { ...v, startedAt: new Date(now).toISOString() };
    delete next.planned;
    delete next.due;
    if (onUpdate(next, `${vaccineLabel(v)} given today`, () => onUpdate(v, `${vaccineLabel(v)} is back on the schedule`))) {
      setJustGiven(v.id);
      setReturnTo(`open-${v.id}`);
    }
  }

  function saveForm(entry: Activity): boolean {
    const previous = mode?.editing;
    const label = vaccineLabel(entry);
    if (previous) {
      const turnedGiven = Boolean(previous.planned && !entry.planned);
      const ok = onUpdate(
        entry,
        turnedGiven ? `${label} marked as given` : `${label} updated`,
        turnedGiven ? () => onUpdate(previous, `${label} is back on the schedule`) : undefined,
      );
      if (ok && turnedGiven) setJustGiven(entry.id);
      if (ok) setReturnTo(`open-${entry.id}`);
      return ok;
    }
    // Logged as given while the same dose waits on the schedule: that IS the
    // planned one, given — convert it rather than keep a second copy. Only an
    // appointment that is due (late, or within the week — the same ones
    // offered "From the schedule") and that was already on the card that day:
    // an earlier dose filled in afterwards, or one months before its date,
    // must not quietly take an appointment off the schedule.
    if (!entry.planned) {
      const same = (a?: string, b?: string) => (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
      const day = (iso: string) => {
        const at = new Date(iso);
        return at.getFullYear() * 10_000 + (at.getMonth() + 1) * 100 + at.getDate();
      };
      const match = planned.find((p) =>
        dueSoon(p, now) && day(entry.startedAt) >= day(p.startedAt) && same(p.vaccine, entry.vaccine) && same(p.dose, entry.dose),
      );
      if (match) {
        const ok = onUpdate({ ...entry, id: match.id }, `${label} marked as given`, () => onUpdate(match, `${label} is back on the schedule`));
        if (ok) {
          setJustGiven(match.id);
          setReturnTo(`open-${match.id}`);
        }
        return ok;
      }
    }
    const ok = onAdd(entry, entry.planned ? `${label} added to the schedule` : `${label} saved`);
    if (ok) setReturnTo(`open-${entry.id}`);
    return ok;
  }

  if (mode) {
    const existing = mode.editing;
    return (
      <VaccineForm
        key={existing?.id ?? mode.kind}
        mode={mode}
        vaccines={vaccines}
        now={now}
        onSave={saveForm}
        onPick={(v) => setMode({ kind: "given", editing: v })}
        onDelete={existing ? () => {
          const label = vaccineLabel(existing);
          if (onRemove(existing, existing.planned ? `${label} removed from the schedule` : `${label} removed`)) {
            setReturnTo("log");
            setMode(null);
          }
        } : undefined}
        onBack={() => setMode(null)}
      />
    );
  }

  // Counted the way the list shows them: every appointment, late ones too.
  const summary = [
    planned.length > 0 && `${planned.length} appointment${planned.length === 1 ? "" : "s"}${late ? ` (${late} late)` : ""}`,
    given.length > 0 && `${given.length} given`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="sheet-form sheet-list" ref={card}>
      <LogDialogHeader
        icon={<Syringe />}
        tone="glyph-medicine"
        eyebrow="Vaccines"
        title={who ? `${who}’s vaccines` : "Vaccines"}
        description={summary || "As written on the health center or clinic card."}
      />

      <section className="coming-up vaccine-card" aria-labelledby="vaccines-coming">
        <h3 className="t-label" id="vaccines-coming">Appointments</h3>
        <ul>
          {planned.map((v) => {
            const due = dueLabel(v.due!, now);
            return (
              <li key={v.id} className={due.overdue ? "coming-row is-late" : "coming-row"}>
                <button type="button" className="vaccine-open" data-focus-key={`open-${v.id}`} onClick={() => open({ kind: "planned", editing: v }, `open-${v.id}`)}>
                  <span className="log-copy">
                    <strong>{vaccineLabel(v)}</strong>
                    <small>
                      <span className={due.overdue ? "vaccine-when is-late" : "vaccine-when"}>{due.text}</span>
                      {due.days >= -13 && due.days < 14 ? ` · ${shortDate(dueDate(v.due!), now)}` : ""}
                      {placeShort(v.place) ? ` · ${placeShort(v.place)}` : ""}
                    </small>
                  </span>
                  {due.days > 0 && <ChevronRight size={16} className="log-chevron" aria-hidden="true" />}
                </button>
                {/* One tap, home from the clinic — offered only when it could
                    be true: late, or within the week. */}
                {/* One tap, home from the clinic — offered on the day, or once
                    it is late; days ahead, a tap here could only be a slip. */}
                {due.days <= 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    data-focus-key={`mark-${v.id}`}
                    aria-label={`Mark ${v.vaccine}${v.dose ? `, ${v.dose},` : ""} as given today`}
                    onClick={() => markGiven(v)}
                  >
                    Mark given
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
        {planned.length === 0 && (
          <p className="vaccine-card-note t-meta">No appointments yet. Add the next date from the health center or clinic card with Add appointment.</p>
        )}
      </section>

      {given.length > 0 && (
        <section className="coming-up vaccine-card" aria-labelledby="vaccines-given">
          <h3 className="t-label" id="vaccines-given">Given</h3>
          <ul>
            {given.map((v) => (
              <li key={v.id} className={v.id === justGiven ? "coming-row is-new" : "coming-row"}>
                <button type="button" className="vaccine-open" data-focus-key={`open-${v.id}`} onClick={() => open({ kind: "given", editing: v }, `open-${v.id}`)}>
                  <span className="log-copy">
                    <strong>{vaccineLabel(v)}</strong>
                    <small>
                      {shortDate(new Date(v.startedAt), now)}
                      {placeShort(v.place) ? ` · ${placeShort(v.place)}` : ""}
                    </small>
                  </span>
                  <ChevronRight size={16} className="log-chevron" aria-hidden="true" />
                </button>
                {v.id === justGiven && nextDose(v.dose) && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="vaccine-next"
                    onClick={() => open({ kind: "planned", seed: { vaccine: v.vaccine, dose: nextDose(v.dose), place: isPlace(v.place) ? v.place : undefined } }, `open-${v.id}`)}
                  >
                    <Plus size={14} aria-hidden="true" /> Plan the {nextDose(v.dose)}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* The two things a parent comes here to do, side by side and the same
          size: the date on the card, or the dose just given. (The sheet
          closes with its X, or back.) */}
      <DialogFooter className="vaccine-footer">
        <Button type="button" variant="outline" className="sheet-primary" data-focus-key="plan" onClick={() => open({ kind: "planned" }, "plan")}>
          <Plus size={16} aria-hidden="true" /> Add appointment
        </Button>
        <Button type="button" className="primary-button sheet-primary" data-initial-focus="" data-focus-key="log" onClick={() => open({ kind: "given" }, "log")}>
          <Plus size={16} aria-hidden="true" /> Record a vaccine
        </Button>
      </DialogFooter>
    </div>
  );
}
