import { Baby, Check, Droplet, Heart, Milk, Minus, Moon, Pill, Plus, Thermometer, Trash2, Utensils, Weight } from "lucide-react";
import { useId, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./ui/alert-dialog";
import { Button } from "./ui/button";
import { ButtonGroup, ButtonGroupText } from "./ui/button-group";
import { DialogFooter } from "./ui/dialog";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "./ui/field";
import { InputGroup, InputGroupInput } from "./ui/input-group";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
import { activityTitle } from "../domain/activityDisplay";
import { DEFAULT_BOTTLE_ML, numericFieldProps } from "../domain/activitySchema";
import {
  MeasurementName,
  bottleDraftToMl,
  bottlePresets as presetsFor,
  bottleStepper,
  formatVolume,
  formatWeight,
  measurementPlaceholder,
  measurementToMetric,
  metricToMeasurementDraft,
  mlToBottleDraft,
  usMeasurementError,
  usMeasurementProps,
  useUnits,
} from "../domain/units";
import { makeId } from "../domain/id";
import { formatTime, formatTimelineDay, localDateInput } from "../domain/time";
import { DraftErrorField, validateDraft } from "../domain/validate";
import { NOTE_MAX_LENGTH } from "../domain/activitySchema";
import { Activity, DiaperKind, FeedingMode, Profile, Sheet } from "../domain/types";
import { ActivityGlyph } from "./ActivityGlyph";
import { TemperatureAdvice } from "./TemperatureAdvice";
import {
  FormError,
  LogDialogHeader,
  NoteField,
  SheetForm,
  TimeField,
  UnitField,
} from "./fields";


// A failed save carries the field it belongs to, so only that field is
// painted invalid and receives focus.
type SheetError = { message: string; field: DraftErrorField };

// Every value a sheet form can edit, owned by LogSheet itself. The component
// is mounted with a key per open, so these initialisers re-run every time a
// sheet opens — a stale amount can never leak from an abandoned edit.
type SheetDraft = {
  bottleAmount: string;
  milkType: "formula" | "expressed";
  note: string;
  weightGrams: string;
  lengthCm: string;
  headCm: string;
  temperatureC: string;
  logTime: string;
  endTime: string;
  nursingSide: "left" | "right" | "both";
  medicineName: string;
  doseText: string;
  foodText: string;
  nursingEntryMode: "timer" | "manual";
  diaperKind: DiaperKind;
};

// Module scope: the initial draft reads the clock once per open, which the
// render-purity analysis would reject inline in a useState initialiser.
function initialSheetDraft(
  sheet: Exclude<Sheet, null>,
  editing: Activity | null,
  nursingMode: "timer" | "manual",
  lastBottle: Activity | undefined,
  units: ReturnType<typeof useUnits>,
): SheetDraft {
  const now = new Date();
  const base: SheetDraft = {
    // Seed from the last saved bottle, clamped to the stepper's own range.
    // In US mode every draft string is in display units — what the person
    // typed is what the field shows — and crosses to metric once, on save.
    bottleAmount: mlToBottleDraft(Math.min(400, Math.max(10, lastBottle?.amount ?? DEFAULT_BOTTLE_ML)), units),
    milkType: lastBottle?.milkType ?? "formula",
    note: "",
    weightGrams: "",
    lengthCm: "",
    headCm: "",
    temperatureC: "",
    logTime: localDateInput(now),
    endTime: "",
    nursingSide: "left",
    medicineName: "",
    doseText: "",
    foodText: "",
    nursingEntryMode: "timer",
    diaperKind: "wet",
  };
  if (editing) {
    return {
      ...base,
      // The bottle seeds are gated on the type — editing a diaper must not
      // carry a bottle amount into the draft.
      bottleAmount: editing.type === "bottle" ? mlToBottleDraft(editing.amount ?? DEFAULT_BOTTLE_ML, units) : base.bottleAmount,
      milkType: editing.type === "bottle" ? editing.milkType ?? "formula" : base.milkType,
      note: editing.note ?? "",
      weightGrams: editing.weightGrams ? metricToMeasurementDraft("weightGrams", editing.weightGrams, units) : "",
      lengthCm: editing.lengthCm ? metricToMeasurementDraft("lengthCm", editing.lengthCm, units) : "",
      headCm: editing.headCm ? metricToMeasurementDraft("headCm", editing.headCm, units) : "",
      temperatureC: editing.temperatureC ? String(editing.temperatureC) : "",
      logTime: localDateInput(new Date(editing.startedAt)),
      endTime: editing.endedAt ? localDateInput(new Date(editing.endedAt)) : "",
      nursingSide: editing.side ?? "left",
      medicineName: editing.medicine ?? "",
      foodText: editing.food ?? "",
      doseText: editing.dose ?? "",
      diaperKind: editing.diaperKind ?? "wet",
    };
  }
  if (sheet === "nursing" && nursingMode === "manual") {
    // "Add past session" opens straight in manual mode: a 15-minute session
    // ending now, matching what switching to Manual inside the sheet seeds.
    return {
      ...base,
      nursingEntryMode: "manual",
      endTime: localDateInput(now),
      logTime: localDateInput(new Date(now.getTime() - 15 * 60_000)),
    };
  }
  return base;
}

type LogSheetProps = {
  sheet: Exclude<Sheet, null>;
  editingActivity: Activity | null;
  initialNursingMode: "timer" | "manual";
  lastBottle: Activity | undefined;
  activeNursing: Activity | undefined;
  activities: Activity[];
  babyAgeMonths: number | null;
  profile: Profile;
  onAdd: (activity: Activity, message: string) => boolean;
  onUpdate: (activity: Activity) => boolean;
  onRemove: (activity: Activity) => boolean;
  onSaveProfile: (profile: Profile) => boolean;
  onClose: () => void;
  showToast: (message: string) => void;
};

export function LogSheet({
  sheet,
  editingActivity,
  initialNursingMode,
  lastBottle,
  activeNursing,
  activities,
  babyAgeMonths,
  profile,
  onAdd,
  onUpdate,
  onRemove,
  onSaveProfile,
  onClose,
  showToast,
}: LogSheetProps) {
  const editing = sheet === "edit" ? editingActivity : null;
  const units = useUnits();
  const stepper = bottleStepper(units);
  const presets = presetsFor(units);
  // Growth fields: metric props straight from the schema, or the same bounds
  // through the same conversion the values take.
  const measureProps = (name: MeasurementName) =>
    units === "metric" ? numericFieldProps(name) : usMeasurementProps(name);
  // The crossing for measurements, plus the error text in the units the
  // person is actually typing — a US-mode refusal that talks about grams
  // would read as nonsense.
  function metricGrowthDraft() {
    return {
      weightGrams: measurementToMetric("weightGrams", draft.weightGrams, units),
      lengthCm: measurementToMetric("lengthCm", draft.lengthCm, units),
      headCm: measurementToMetric("headCm", draft.headCm, units),
    };
  }
  function localiseError(outcome: SheetError) {
    if (units === "us" && (outcome.field === "weightGrams" || outcome.field === "lengthCm" || outcome.field === "headCm")) {
      return { ...outcome, message: usMeasurementError(outcome.field) };
    }
    return outcome;
  }
  const [draft, setDraft] = useState<SheetDraft>(() =>
    initialSheetDraft(sheet, editing, initialNursingMode, lastBottle, units),
  );
  const [formError, setFormError] = useState<SheetError | null>(null);
  // One ref per failable field, so the error can land focus on the exact
  // input it names instead of whichever field happened to hold the ref.
  const startRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);
  const weightRef = useRef<HTMLInputElement>(null);
  const lengthRef = useRef<HTMLInputElement>(null);
  const headRef = useRef<HTMLInputElement>(null);
  const temperatureRef = useRef<HTMLInputElement>(null);
  const isTimed = editing
    ? editing.type === "nursing" || editing.type === "burp" || editing.type === "sleep"
    : false;

  function patch(partial: Partial<SheetDraft>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  function showFormError(error: SheetError) {
    setFormError(error);
    const refs: Record<DraftErrorField, React.RefObject<HTMLInputElement | null>> = {
      start: startRef,
      end: endRef,
      amount: amountRef,
      weightGrams: weightRef,
      lengthCm: lengthRef,
      headCm: headRef,
      temperatureC: temperatureRef,
    };
    window.requestAnimationFrame(() => refs[error.field].current?.focus());
  }

  function changeNursingEntryMode(mode: "timer" | "manual") {
    setFormError(null);
    const ended = new Date();
    setDraft((current) => ({
      ...current,
      nursingEntryMode: mode,
      // "Both" only exists for a finished session; switching back to a live
      // timer must not leave a side selected that the timer cannot start on.
      nursingSide: mode === "timer" && current.nursingSide === "both" ? "left" : current.nursingSide,
      endTime: mode === "manual" ? localDateInput(ended) : "",
      logTime: localDateInput(mode === "manual" ? new Date(ended.getTime() - 15 * 60_000) : ended),
    }));
  }

  function saveBottle() {
    // Clamp to the storage schema's own bounds — persisting an amount that
    // isValidActivity rejects would strand the whole store behind recovery.
    const outcome = validateDraft(
      // The one crossing: the display-units draft becomes millilitres here,
      // and everything below — validation, storage, sync — stays metric.
      { type: "bottle", start: draft.logTime, amount: bottleDraftToMl(draft.bottleAmount, units), note: draft.note },
      { clampTime: true, clampAmount: true },
    );
    if (!outcome.ok) return;
    const entry: Activity = {
      id: makeId(),
      type: "bottle",
      startedAt: outcome.value.startedAt,
      amount: outcome.value.amount,
      milkType: draft.milkType,
      note: outcome.value.note,
    };
    if (onAdd(entry, `${formatVolume(outcome.value.amount ?? 0, units)} bottle saved`)) onClose();
  }

  function saveNursing() {
    if (draft.nursingEntryMode === "timer" && activeNursing) {
      showFormError({ message: "A nursing timer is already running. Stop it before starting another.", field: "start" });
      return;
    }
    const outcome = validateDraft(
      {
        type: "nursing",
        start: draft.logTime,
        end: draft.nursingEntryMode === "manual" ? draft.endTime : undefined,
        note: draft.note,
      },
      { requireEnd: draft.nursingEntryMode === "manual" },
    );
    if (!outcome.ok) {
      showFormError(outcome);
      return;
    }

    const entry: Activity = {
      id: makeId(),
      type: "nursing",
      startedAt: outcome.value.startedAt,
      endedAt: outcome.value.endedAt,
      side: draft.nursingSide,
      note: outcome.value.note,
    };
    const sideLabel =
      draft.nursingSide === "both" ? "Both sides" : draft.nursingSide === "left" ? "Left" : "Right";
    const message = draft.nursingEntryMode === "manual" ? `${sideLabel} nursing saved` : `${sideLabel} timer started`;
    if (onAdd(entry, message)) onClose();
  }

  // A sleep that already happened. Until now the only way to record one was
  // to have pressed a button while it started — so a parent who realised at
  // six that the baby went down at ten had nowhere to put the night that had
  // just happened, which is most nights.
  function saveSleep() {
    const outcome = validateDraft(
      { type: "sleep", start: draft.logTime, end: draft.endTime, note: draft.note },
      { requireEnd: true },
    );
    if (!outcome.ok) {
      showFormError(outcome);
      return;
    }
    const entry: Activity = {
      id: makeId(),
      type: "sleep",
      startedAt: outcome.value.startedAt,
      endedAt: outcome.value.endedAt,
      note: outcome.value.note,
    };
    if (onAdd(entry, "Sleep saved")) onClose();
  }

  // What was given, and when. Nothing here checks a dose or suggests one:
  // paediatric dosing depends on weight and on the specific preparation, and an
  // app that guessed at it would be dangerous in exactly the situation it is
  // meant to help with. The value is the timestamp — "has she already had it,
  // and did you give it or did I" is the question two exhausted people in one
  // house get wrong.
  function saveMedicine() {
    const name = draft.medicineName.trim();
    if (!name) {
      showFormError({ message: "Which medicine was it?", field: "start" });
      return;
    }
    const outcome = validateDraft({ type: "medicine", start: draft.logTime, note: draft.note });
    if (!outcome.ok) {
      showFormError(outcome);
      return;
    }
    const entry: Activity = {
      id: makeId(),
      type: "medicine",
      startedAt: outcome.value.startedAt,
      medicine: name.slice(0, NOTE_MAX_LENGTH),
      dose: draft.doseText.trim().slice(0, NOTE_MAX_LENGTH) || undefined,
      note: outcome.value.note,
    };
    if (onAdd(entry, `${name} logged`)) onClose();
  }

  function saveSolid() {
    const food = draft.foodText.trim();
    if (!food) {
      showFormError({ message: "What did they eat?", field: "start" });
      return;
    }
    const outcome = validateDraft({ type: "solid", start: draft.logTime, note: draft.note });
    if (!outcome.ok) {
      showFormError(outcome);
      return;
    }
    const entry: Activity = {
      id: makeId(),
      type: "solid",
      startedAt: outcome.value.startedAt,
      food: food.slice(0, NOTE_MAX_LENGTH),
      note: outcome.value.note,
    };
    if (onAdd(entry, `${food} logged`)) onClose();
  }

  function saveDiaper(kind: DiaperKind) {
    const outcome = validateDraft({ type: "diaper", start: draft.logTime, note: draft.note }, { clampTime: true });
    if (!outcome.ok) return;
    const entry: Activity = {
      id: makeId(),
      type: "diaper",
      diaperKind: kind,
      startedAt: outcome.value.startedAt,
      note: outcome.value.note,
    };
    if (onAdd(entry, `${kind === "both" ? "Wet + dirty" : kind === "dirty" ? "Dirty" : "Wet"} diaper saved`)) onClose();
  }

  function saveGrowth() {
    const outcome = validateDraft(
      { type: "growth", start: draft.logTime, ...metricGrowthDraft(), note: draft.note },
      { clampTime: true },
    );
    if (!outcome.ok) {
      showFormError(localiseError(outcome));
      return;
    }

    const entry: Activity = {
      id: makeId(),
      type: "growth",
      startedAt: outcome.value.startedAt,
      weightGrams: outcome.value.weightGrams,
      lengthCm: outcome.value.lengthCm,
      headCm: outcome.value.headCm,
      note: outcome.value.note,
    };
    if (onAdd(entry, `${formatWeight(outcome.value.weightGrams ?? 0, units)} saved`)) onClose();
  }

  function saveHealthNote() {
    const outcome = validateDraft(
      { type: "health", start: draft.logTime, temperatureC: draft.temperatureC, note: draft.note },
      { clampTime: true },
    );
    if (!outcome.ok) {
      showFormError(outcome);
      return;
    }

    const entry: Activity = {
      id: makeId(),
      type: "health",
      startedAt: outcome.value.startedAt,
      temperatureC: outcome.value.temperatureC,
      note: outcome.value.note,
    };
    if (onAdd(entry, outcome.value.temperatureC === undefined ? "Health note saved" : "Temperature saved")) onClose();
  }

  function saveEditedActivity() {
    if (!editing) return;
    const timed =
      editing.type === "sleep" || editing.type === "nursing" || editing.type === "burp";
    const outcome = validateDraft(
      {
        type: editing.type,
        start: draft.logTime,
        end: timed ? draft.endTime : undefined,
        amount: draft.bottleAmount.trim() === "" ? undefined : bottleDraftToMl(draft.bottleAmount, units),
        ...metricGrowthDraft(),
        temperatureC: draft.temperatureC,
        note: draft.note,
      },
      { allowEqualEnd: true },
    );
    if (!outcome.ok) {
      showFormError(localiseError(outcome));
      return;
    }

    const next: Activity = {
      ...editing,
      startedAt: outcome.value.startedAt,
      endedAt: timed ? outcome.value.endedAt : undefined,
      note: outcome.value.note,
    };

    if (
      (next.type === "nursing" || next.type === "burp" || next.type === "sleep") &&
      !next.endedAt &&
      activities.some(
        (activity) => activity.type === next.type && !activity.endedAt && activity.id !== next.id,
      )
    ) {
      showFormError({ message: `Another ${next.type} timer is already running. Stop it first.`, field: "end" });
      return;
    }

    if (next.type === "bottle") {
      next.amount = outcome.value.amount;
      next.milkType = draft.milkType;
    }
    if (next.type === "nursing") next.side = draft.nursingSide;
    if (next.type === "diaper") next.diaperKind = draft.diaperKind;
    if (next.type === "growth") {
      next.weightGrams = outcome.value.weightGrams;
      next.lengthCm = outcome.value.lengthCm;
      next.headCm = outcome.value.headCm;
    }
    if (next.type === "health") next.temperatureC = outcome.value.temperatureC;
    if (next.type === "solid") {
      const food = draft.foodText.trim();
      if (!food) {
        showFormError({ message: "What did they eat?", field: "start" });
        return;
      }
      next.food = food.slice(0, NOTE_MAX_LENGTH);
    }

    if (!onUpdate(next)) return;
    onClose();
    showToast(`${activityTitle(next)} updated`);
  }

  return (
    <>
      {sheet === "bottle" && (
        <SheetForm onSubmit={saveBottle}>
          <LogDialogHeader icon={<Milk />} eyebrow="Quick log" title="Bottle" description="Record the amount now; adjust details only if needed." />
          <Field className="amount-field">
            <FieldLabel>Amount</FieldLabel>
            <ButtonGroup className="amount-control" aria-label="Bottle amount">
              <Button type="button" variant="outline" aria-label="Decrease amount" disabled={Number(draft.bottleAmount) <= stepper.min} onClick={() => setDraft((current) => ({ ...current, bottleAmount: String(Math.max(stepper.min, (Number(current.bottleAmount) || stepper.min) - stepper.step)) }))}><Minus /></Button>
              <ButtonGroupText role="status" aria-live="polite" aria-atomic="true"><strong>{draft.bottleAmount}</strong><span>{stepper.unit}</span></ButtonGroupText>
              <Button type="button" variant="outline" aria-label="Increase amount" disabled={Number(draft.bottleAmount) >= stepper.max} onClick={() => setDraft((current) => ({ ...current, bottleAmount: String(Math.min(stepper.max, (Number(current.bottleAmount) || 0) + stepper.step)) }))}><Plus /></Button>
            </ButtonGroup>
            <ToggleGroup type="single" value={draft.bottleAmount} className="preset-row" aria-label="Preset amounts" onValueChange={(value) => value && patch({ bottleAmount: value })}>
              {presets.map((amount, index) => {
                const focused = amount === Number(draft.bottleAmount) || (index === 0 && !presets.includes(Number(draft.bottleAmount)));
                return <ToggleGroupItem autoFocus={focused} data-initial-focus={focused ? "" : undefined} value={String(amount)} aria-label={`${amount} ${stepper.unit}`} key={amount}>{amount}</ToggleGroupItem>;
              })}
            </ToggleGroup>
          </Field>
          <Field className="choice-field">
            <FieldLabel>Milk</FieldLabel>
            <ToggleGroup type="single" value={draft.milkType} className="segmented" aria-label="Milk type" onValueChange={(value) => value && patch({ milkType: value as "formula" | "expressed" })}>
              <ToggleGroupItem value="formula">Formula<Check className="choice-check" /></ToggleGroupItem>
              <ToggleGroupItem value="expressed">Breast milk<Check className="choice-check" /></ToggleGroupItem>
            </ToggleGroup>
          </Field>
          <TimeField value={draft.logTime} onChange={(value) => patch({ logTime: value })} />
          <NoteField value={draft.note} onChange={(value) => patch({ note: value })} />
          <DialogFooter><Button type="submit" className="primary-button sheet-primary">Save {draft.bottleAmount} {stepper.unit}</Button></DialogFooter>
        </SheetForm>
      )}

      {sheet === "nursing" && (
        <SheetForm onSubmit={saveNursing}>
          <LogDialogHeader icon={<Heart />} eyebrow="Nursing" title="Log a nursing session" description="Start a live timer or add a completed session." />
          <Field className="choice-field">
            <FieldLabel>Entry method</FieldLabel>
            <ToggleGroup
              type="single"
              value={draft.nursingEntryMode}
              className="segmented"
              aria-label="Nursing entry method"
              onValueChange={(value) => value && changeNursingEntryMode(value as "timer" | "manual")}
            >
              <ToggleGroupItem autoFocus={draft.nursingEntryMode === "timer"} data-initial-focus={draft.nursingEntryMode === "timer" ? "" : undefined} value="timer">Timer<Check className="choice-check" /></ToggleGroupItem>
              <ToggleGroupItem autoFocus={draft.nursingEntryMode === "manual"} data-initial-focus={draft.nursingEntryMode === "manual" ? "" : undefined} value="manual">Past session<Check className="choice-check" /></ToggleGroupItem>
            </ToggleGroup>
          </Field>
          <Field className="nursing-side-field">
            <FieldLabel>Side</FieldLabel>
            <ToggleGroup type="single" value={draft.nursingSide} className="side-grid" aria-label="Nursing side" onValueChange={(value) => value && patch({ nursingSide: value as "left" | "right" | "both" })}>
              <ToggleGroupItem value="left"><span className="side-letter">L</span><span className="choice-copy"><strong>Left</strong></span><Check className="choice-check" /></ToggleGroupItem>
              <ToggleGroupItem value="right"><span className="side-letter">R</span><span className="choice-copy"><strong>Right</strong></span><Check className="choice-check" /></ToggleGroupItem>
              {/* Only for a session that has already finished. A live timer
                  starts on one side by definition; a feed that used both is
                  something you know afterwards, and it is one feed, not two. */}
              {draft.nursingEntryMode === "manual" && (
                <ToggleGroupItem value="both"><span className="side-letter">LR</span><span className="choice-copy"><strong>Both</strong></span><Check className="choice-check" /></ToggleGroupItem>
              )}
            </ToggleGroup>
          </Field>
          {draft.nursingEntryMode === "timer" ? (
            <TimeField value={draft.logTime} label="Started" inputRef={startRef} error={formError?.field === "start"} onChange={(value) => { patch({ logTime: value }); setFormError(null); }} />
          ) : (
            <div className="measurement-row nursing-time-row">
              <TimeField value={draft.logTime} label="Started" inputRef={startRef} error={formError?.field === "start"} onChange={(value) => { patch({ logTime: value }); setFormError(null); }} />
              <TimeField value={draft.endTime} label="Ended" inputRef={endRef} error={formError?.field === "end"} onChange={(value) => { patch({ endTime: value }); setFormError(null); }} />
            </div>
          )}
          <NoteField value={draft.note} onChange={(value) => patch({ note: value })} />
          <FormError message={formError?.message ?? null} />
          <DialogFooter>
            <p className="sheet-footer-note">{draft.nursingEntryMode === "timer" ? "The timer stays active if you close the app." : "This session saves straight to your timeline."}</p>
            <Button type="submit" className="primary-button sheet-primary">
              {draft.nursingEntryMode === "timer"
                ? `Start ${draft.nursingSide} timer`
                : draft.nursingSide === "both"
                  ? "Save session"
                  : `Save ${draft.nursingSide} session`}
            </Button>
          </DialogFooter>
        </SheetForm>
      )}

      {sheet === "sleep" && (
        <SheetForm onSubmit={saveSleep}>
          <LogDialogHeader
            icon={<Moon />}
            eyebrow="Past sleep"
            title="Add a sleep"
            description="A stretch that has already finished — the night you meant to log at the time."
          />
          <div className="measurement-row nursing-time-row">
            <TimeField
              value={draft.logTime}
              label="Fell asleep"
              inputRef={startRef}
              error={formError?.field === "start"}
              onChange={(value) => { patch({ logTime: value }); setFormError(null); }}
            />
            <TimeField
              value={draft.endTime}
              label="Woke up"
              inputRef={endRef}
              error={formError?.field === "end"}
              onChange={(value) => { patch({ endTime: value }); setFormError(null); }}
            />
          </div>
          <NoteField value={draft.note} onChange={(value) => patch({ note: value })} />
          <FormError message={formError?.message ?? null} />
          <DialogFooter>
            <p className="sheet-footer-note">A stretch that crosses midnight is counted whole, on the evening it began.</p>
            <Button type="submit" className="primary-button sheet-primary">Save sleep</Button>
          </DialogFooter>
        </SheetForm>
      )}

      {sheet === "medicine" && (
        <SheetForm onSubmit={saveMedicine}>
          <LogDialogHeader
            icon={<Pill />}
            eyebrow="Medicine"
            title="Log a dose"
            description="So the next person knows it has already been given."
          />
          <Field className="medicine-field">
            <FieldLabel htmlFor="medicine-name">What was given</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="medicine-name"
                autoFocus
                data-initial-focus
                value={draft.medicineName}
                maxLength={NOTE_MAX_LENGTH}
                placeholder="Vitamin D drops, paracetamol…"
                onChange={(event) => { patch({ medicineName: event.target.value }); setFormError(null); }}
              />
            </InputGroup>
          </Field>
          <Field className="medicine-field">
            <FieldLabel htmlFor="medicine-dose">How much <span className="optional-label">Optional</span></FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="medicine-dose"
                value={draft.doseText}
                maxLength={NOTE_MAX_LENGTH}
                placeholder="2.5 ml, one drop…"
                onChange={(event) => patch({ doseText: event.target.value })}
              />
            </InputGroup>
            <FieldDescription>
              Written down exactly as you gave it. This app never suggests a dose — that comes from
              the label or your doctor.
            </FieldDescription>
          </Field>
          <TimeField value={draft.logTime} inputRef={startRef} error={formError?.field === "start"} onChange={(value) => { patch({ logTime: value }); setFormError(null); }} />
          <NoteField value={draft.note} onChange={(value) => patch({ note: value })} />
          <FormError message={formError?.message ?? null} />
          <DialogFooter><Button type="submit" className="primary-button sheet-primary">Save dose</Button></DialogFooter>
        </SheetForm>
      )}

      {sheet === "solid" && (
        <SheetForm onSubmit={saveSolid}>
          <LogDialogHeader
            icon={<Utensils />}
            eyebrow="Solids"
            title="Log a food"
            description="What went in, and roughly when — tastes count."
          />
          <Field className="medicine-field">
            <FieldLabel htmlFor="solid-food">What did they eat?</FieldLabel>
            <InputGroup>
              <InputGroupInput
                id="solid-food"
                autoFocus
                data-initial-focus
                value={draft.foodText}
                maxLength={NOTE_MAX_LENGTH}
                placeholder="Banana, carrot purée, rice cereal…"
                onChange={(event) => { patch({ foodText: event.target.value }); setFormError(null); }}
              />
            </InputGroup>
            <FieldDescription>
              A record of firsts and reactions, not a nutrition score. Note anything unusual —
              a rash or vomiting after a new food is worth telling your doctor about.
            </FieldDescription>
          </Field>
          <TimeField value={draft.logTime} inputRef={startRef} error={formError?.field === "start"} onChange={(value) => { patch({ logTime: value }); setFormError(null); }} />
          <NoteField value={draft.note} onChange={(value) => patch({ note: value })} placeholder="How it went — loved it, spat it out, small rash…" />
          <FormError message={formError?.message ?? null} />
          <DialogFooter><Button type="submit" className="primary-button sheet-primary">Save food</Button></DialogFooter>
        </SheetForm>
      )}

      {sheet === "diaper" && (
        <SheetForm onSubmit={() => saveDiaper(draft.diaperKind)}>
          <LogDialogHeader icon={<Droplet />} eyebrow="Quick log" title="Diaper" description="Choose the closest match and save." />
          <Field className="choice-field">
            <FieldLabel>Diaper type</FieldLabel>
            <ToggleGroup type="single" value={draft.diaperKind} className="diaper-grid" aria-label="Diaper type" onValueChange={(value) => value && patch({ diaperKind: value as DiaperKind })}>
              <ToggleGroupItem autoFocus data-initial-focus value="wet"><Droplet size={22} /><strong>Wet</strong><Check className="choice-check" /></ToggleGroupItem>
              <ToggleGroupItem value="dirty"><span className="dot-icon" aria-hidden="true">●</span><strong>Dirty</strong><Check className="choice-check" /></ToggleGroupItem>
              <ToggleGroupItem value="both"><span className="both-icon" aria-hidden="true"><Droplet size={18} />●</span><strong>Both</strong><Check className="choice-check" /></ToggleGroupItem>
            </ToggleGroup>
          </Field>
          <TimeField value={draft.logTime} onChange={(value) => patch({ logTime: value })} />
          <NoteField value={draft.note} onChange={(value) => patch({ note: value })} />
          <DialogFooter><Button type="submit" className="primary-button sheet-primary">Save {draft.diaperKind === "both" ? "wet + dirty" : draft.diaperKind} diaper</Button></DialogFooter>
        </SheetForm>
      )}

      {sheet === "growth" && (
        <SheetForm onSubmit={saveGrowth}>
          <LogDialogHeader icon={<Weight />} eyebrow="Growth check" title="Add measurement" description="Weight now, length and head if you have them." />
          <FieldGroup className="measurement-fields">
            <UnitField {...measureProps("weightGrams")} value={draft.weightGrams} inputRef={weightRef} autoFocus invalid={formError?.field === "weightGrams"} onChange={(value) => { patch({ weightGrams: value }); setFormError(null); }} placeholder={measurementPlaceholder("weightGrams", units)} className="measurement-primary" />
            <div className="measurement-row">
              <UnitField {...measureProps("lengthCm")} optional value={draft.lengthCm} inputRef={lengthRef} invalid={formError?.field === "lengthCm"} onChange={(value) => { patch({ lengthCm: value }); setFormError(null); }} placeholder={measurementPlaceholder("lengthCm", units)} />
              <UnitField {...measureProps("headCm")} optional value={draft.headCm} inputRef={headRef} invalid={formError?.field === "headCm"} onChange={(value) => { patch({ headCm: value }); setFormError(null); }} placeholder={measurementPlaceholder("headCm", units)} />
            </div>
          </FieldGroup>
          <TimeField value={draft.logTime} onChange={(value) => patch({ logTime: value })} />
          <NoteField value={draft.note} onChange={(value) => patch({ note: value })} placeholder="Clinic, home scale, or anything useful" />
          <p className="sheet-advice">Measure consistently and use the trend as context for your paediatrician.</p>
          <FormError message={formError?.message ?? null} />
          <DialogFooter><Button type="submit" className="primary-button sheet-primary">Save growth check</Button></DialogFooter>
        </SheetForm>
      )}

      {sheet === "health" && (
        <SheetForm onSubmit={saveHealthNote}>
          <LogDialogHeader icon={<Thermometer />} eyebrow="Health log" title="Temperature or note" description="Keep a time-stamped note you can refer back to." />
          <UnitField {...numericFieldProps("temperatureC")} optional value={draft.temperatureC} inputRef={temperatureRef} autoFocus invalid={formError?.field === "temperatureC"} onChange={(value) => { patch({ temperatureC: value }); setFormError(null); }} placeholder="36.7" />
          <TemperatureAdvice value={draft.temperatureC} ageMonths={babyAgeMonths} />
          <TimeField value={draft.logTime} onChange={(value) => patch({ logTime: value })} />
          <NoteField value={draft.note} onChange={(value) => { patch({ note: value }); setFormError(null); }} placeholder="Medicine, spit-up, rash, question for the doctor…" />
          <FormError message={formError?.message ?? null} />
          <DialogFooter><Button type="submit" className="primary-button sheet-primary">Save health log</Button></DialogFooter>
        </SheetForm>
      )}

      {sheet === "edit" && editing && (
        <SheetForm onSubmit={saveEditedActivity}>
          <LogDialogHeader
            icon={<ActivityGlyph type={editing.type} />}
            eyebrow="Edit log"
            title={activityTitle(editing)}
            description={`${formatTimelineDay(editing.startedAt)} at ${formatTime(editing.startedAt)}`}
            tone={`glyph-${editing.type}`}
          />

          {editing.type === "bottle" && (
            <>
              <Field className="amount-field">
                <UnitField
                  label="Amount"
                  unit={stepper.unit}
                  min={stepper.min}
                  max={stepper.max}
                  step={stepper.step}
                  value={draft.bottleAmount}
                  inputRef={amountRef}
                  autoFocus
                  invalid={formError?.field === "amount"}
                  onChange={(value) => { patch({ bottleAmount: value }); setFormError(null); }}
                  className="measurement-primary"
                />
                <ToggleGroup type="single" value={draft.bottleAmount} className="preset-row" aria-label="Preset amounts" onValueChange={(value) => { if (value) patch({ bottleAmount: value }); setFormError(null); }}>
                  {presets.map((amount) => <ToggleGroupItem value={String(amount)} aria-label={`${amount} ${stepper.unit}`} key={amount}>{amount}</ToggleGroupItem>)}
                </ToggleGroup>
              </Field>
              <Field className="choice-field">
                <FieldLabel>Milk</FieldLabel>
                <ToggleGroup type="single" value={draft.milkType} className="segmented" aria-label="Milk type" onValueChange={(value) => value && patch({ milkType: value as "formula" | "expressed" })}>
                  <ToggleGroupItem value="formula">Formula<Check className="choice-check" /></ToggleGroupItem>
                  <ToggleGroupItem value="expressed">Breast milk<Check className="choice-check" /></ToggleGroupItem>
                </ToggleGroup>
              </Field>
            </>
          )}

          {editing.type === "nursing" && (
            <Field className="nursing-side-field">
              <FieldLabel>Side</FieldLabel>
              <ToggleGroup type="single" value={draft.nursingSide} className="side-grid" aria-label="Nursing side" onValueChange={(value) => value && patch({ nursingSide: value as "left" | "right" | "both" })}>
                <ToggleGroupItem autoFocus data-initial-focus value="left"><span className="side-letter">L</span><span className="choice-copy"><strong>Left</strong></span><Check className="choice-check" /></ToggleGroupItem>
                <ToggleGroupItem value="right"><span className="side-letter">R</span><span className="choice-copy"><strong>Right</strong></span><Check className="choice-check" /></ToggleGroupItem>
              </ToggleGroup>
            </Field>
          )}

          {editing.type === "diaper" && (
            <Field className="choice-field">
              <FieldLabel>Diaper type</FieldLabel>
              <ToggleGroup type="single" value={draft.diaperKind} className="diaper-grid" aria-label="Diaper type" onValueChange={(value) => value && patch({ diaperKind: value as DiaperKind })}>
                <ToggleGroupItem autoFocus data-initial-focus value="wet"><Droplet size={22} /><strong>Wet</strong><Check className="choice-check" /></ToggleGroupItem>
                <ToggleGroupItem value="dirty"><span className="dot-icon" aria-hidden="true">●</span><strong>Dirty</strong><Check className="choice-check" /></ToggleGroupItem>
                <ToggleGroupItem value="both"><span className="both-icon" aria-hidden="true"><Droplet size={18} />●</span><strong>Both</strong><Check className="choice-check" /></ToggleGroupItem>
              </ToggleGroup>
            </Field>
          )}

          {editing.type === "growth" && (
            <FieldGroup className="measurement-fields">
              <UnitField {...measureProps("weightGrams")} value={draft.weightGrams} inputRef={weightRef} autoFocus invalid={formError?.field === "weightGrams"} onChange={(value) => { patch({ weightGrams: value }); setFormError(null); }} className="measurement-primary" />
              <div className="measurement-row">
                <UnitField {...measureProps("lengthCm")} optional value={draft.lengthCm} inputRef={lengthRef} invalid={formError?.field === "lengthCm"} onChange={(value) => { patch({ lengthCm: value }); setFormError(null); }} />
                <UnitField {...measureProps("headCm")} optional value={draft.headCm} inputRef={headRef} invalid={formError?.field === "headCm"} onChange={(value) => { patch({ headCm: value }); setFormError(null); }} />
              </div>
            </FieldGroup>
          )}

          {editing.type === "health" && (
            <>
              <UnitField {...numericFieldProps("temperatureC")} optional value={draft.temperatureC} inputRef={temperatureRef} autoFocus invalid={formError?.field === "temperatureC"} onChange={(value) => { patch({ temperatureC: value }); setFormError(null); }} placeholder="36.7" />
              <TemperatureAdvice value={draft.temperatureC} ageMonths={babyAgeMonths} />
            </>
          )}

          <div className={isTimed ? "measurement-row edit-time-row" : ""}>
            <TimeField value={draft.logTime} label={isTimed ? "Started" : "When"} autoFocus={editing.type === "sleep"} inputRef={startRef} error={formError?.field === "start"} onChange={(value) => { patch({ logTime: value }); setFormError(null); }} />
            {isTimed && <TimeField value={draft.endTime} label="Ended" description="Leave empty if still going." inputRef={endRef} error={formError?.field === "end"} onChange={(value) => { patch({ endTime: value }); setFormError(null); }} />}
          </div>
          <NoteField value={draft.note} onChange={(value) => { patch({ note: value }); setFormError(null); }} />
          <FormError message={formError?.message ?? null} />

          <AlertDialog>
            <div className="edit-danger">
              <AlertDialogTrigger asChild>
                <Button type="button" variant="ghost"><Trash2 size={17} /> Delete this log</Button>
              </AlertDialogTrigger>
            </div>
            <AlertDialogContent className="delete-dialog">
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {activityTitle(editing)}?</AlertDialogTitle>
                <AlertDialogDescription>
                  {formatTimelineDay(editing.startedAt)} at {formatTime(editing.startedAt)}. You can undo immediately after deletion.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep log</AlertDialogCancel>
                <AlertDialogAction className="confirm-remove" onClick={() => {
                  if (onRemove(editing)) onClose();
                }}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <DialogFooter><Button type="submit" className="primary-button sheet-primary">Save changes</Button></DialogFooter>
        </SheetForm>
      )}

      {sheet === "profile" && (
        <ProfileForm
          profile={profile}
          onChange={onSaveProfile}
          onDone={onClose}
        />
      )}
    </>
  );
}

function ProfileForm({ profile, onChange, onDone }: { profile: Profile; onChange: (profile: Profile) => boolean; onDone: () => void }) {
  const [draft, setDraft] = useState(profile);
  const nameId = useId();
  const birthDateId = useId();
  return (
    <SheetForm onSubmit={() => {
      if (onChange({ ...draft, name: draft.name.trim() || "Baby" })) onDone();
    }}>
      <LogDialogHeader icon={<Baby />} eyebrow="Keep it personal" title="Baby profile" description="Used only in this browser to personalise your tracker." />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={nameId}>Name</FieldLabel>
          <InputGroup><InputGroupInput id={nameId} autoFocus data-initial-focus maxLength={80} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Baby’s name" /></InputGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor={birthDateId}>Date of birth</FieldLabel>
          <InputGroup><InputGroupInput id={birthDateId} type="date" value={draft.birthDate} max={localDateInput(new Date()).slice(0, 10)} onChange={(event) => setDraft({ ...draft, birthDate: event.target.value })} /></InputGroup>
        </Field>
        <Field>
          <FieldLabel>Girl or boy</FieldLabel>
          <ToggleGroup type="single" value={draft.sex ?? "skip"} className="segmented three-way" aria-label="Girl or boy" onValueChange={(value) => value && setDraft({ ...draft, sex: value === "girl" || value === "boy" ? value : undefined })}>
            <ToggleGroupItem value="girl">Girl<Check className="choice-check" /></ToggleGroupItem>
            <ToggleGroupItem value="boy">Boy<Check className="choice-check" /></ToggleGroupItem>
            <ToggleGroupItem value="skip">Skip<Check className="choice-check" /></ToggleGroupItem>
          </ToggleGroup>
          <FieldDescription>Used only for the growth guide’s reference ranges.</FieldDescription>
        </Field>
        <Field>
          <FieldLabel>How are you feeding?</FieldLabel>
          <ToggleGroup type="single" value={draft.feedingMode} className="segmented three-way" aria-label="Feeding method" onValueChange={(value) => value && setDraft({ ...draft, feedingMode: value as FeedingMode })}>
            {(["breast", "bottle", "mixed"] as FeedingMode[]).map((mode) => <ToggleGroupItem key={mode} value={mode}>{mode[0].toUpperCase() + mode.slice(1)}<Check className="choice-check" /></ToggleGroupItem>)}
          </ToggleGroup>
          <FieldDescription>This changes which quick actions are shown.</FieldDescription>
        </Field>
      </FieldGroup>
      <DialogFooter><Button type="submit" className="primary-button sheet-primary">Save profile</Button></DialogFooter>
    </SheetForm>
  );
}
