import {
  Baby,
  Check,
  Clock,
  Droplet,
  Heart,
  Milk,
  Minus,
  Pencil,
  Plus,
  Thermometer,
  Trash2,
  Weight,
} from "lucide-react";
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
import { makeId } from "../domain/id";
import { formatTime, formatTimelineDay, localDateInput } from "../domain/time";
import { validateDraft } from "../domain/validate";
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

const bottlePresets = [60, 90, 120, 150];

// Every value a sheet form can edit, owned by LogSheet itself. The component
// is mounted with a key per open, so these initialisers re-run every time a
// sheet opens — a stale amount can never leak from an abandoned edit.
type SheetDraft = {
  bottleAmount: number;
  milkType: "formula" | "expressed";
  note: string;
  weightGrams: string;
  lengthCm: string;
  headCm: string;
  temperatureC: string;
  logTime: string;
  endTime: string;
  nursingSide: "left" | "right";
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
): SheetDraft {
  const now = new Date();
  const base: SheetDraft = {
    // Seed from the last saved bottle, clamped to the stepper's own range.
    bottleAmount: Math.min(400, Math.max(10, lastBottle?.amount ?? DEFAULT_BOTTLE_ML)),
    milkType: lastBottle?.milkType ?? "formula",
    note: "",
    weightGrams: "",
    lengthCm: "",
    headCm: "",
    temperatureC: "",
    logTime: localDateInput(now),
    endTime: "",
    nursingSide: "left",
    nursingEntryMode: "timer",
    diaperKind: "wet",
  };
  if (editing) {
    return {
      ...base,
      // The bottle seeds are gated on the type — editing a diaper must not
      // carry a bottle amount into the draft.
      bottleAmount: editing.type === "bottle" ? editing.amount ?? DEFAULT_BOTTLE_ML : base.bottleAmount,
      milkType: editing.type === "bottle" ? editing.milkType ?? "formula" : base.milkType,
      note: editing.note ?? "",
      weightGrams: editing.weightGrams ? String(editing.weightGrams) : "",
      lengthCm: editing.lengthCm ? String(editing.lengthCm) : "",
      headCm: editing.headCm ? String(editing.headCm) : "",
      temperatureC: editing.temperatureC ? String(editing.temperatureC) : "",
      logTime: localDateInput(new Date(editing.startedAt)),
      endTime: editing.endedAt ? localDateInput(new Date(editing.endedAt)) : "",
      nursingSide: editing.side ?? "left",
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
  const [draft, setDraft] = useState<SheetDraft>(() =>
    initialSheetDraft(sheet, editing, initialNursingMode, lastBottle),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const invalidFieldRef = useRef<HTMLInputElement>(null);
  const isTimed = editing ? editing.type === "nursing" || editing.type === "sleep" : false;

  function patch(partial: Partial<SheetDraft>) {
    setDraft((current) => ({ ...current, ...partial }));
  }

  function showFormError(message: string) {
    setFormError(message);
    window.requestAnimationFrame(() => invalidFieldRef.current?.focus());
  }

  function changeNursingEntryMode(mode: "timer" | "manual") {
    setFormError(null);
    const ended = new Date();
    setDraft((current) => ({
      ...current,
      nursingEntryMode: mode,
      endTime: mode === "manual" ? localDateInput(ended) : "",
      logTime: localDateInput(mode === "manual" ? new Date(ended.getTime() - 15 * 60_000) : ended),
    }));
  }

  function saveBottle() {
    // Clamp to the storage schema's own bounds — persisting an amount that
    // isValidActivity rejects would strand the whole store behind recovery.
    const outcome = validateDraft(
      { type: "bottle", start: draft.logTime, amount: draft.bottleAmount, note: draft.note },
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
    if (onAdd(entry, `${outcome.value.amount} ml bottle saved`)) onClose();
  }

  function saveNursing() {
    if (draft.nursingEntryMode === "timer" && activeNursing) {
      showFormError("A nursing timer is already running. Stop it before starting another.");
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
      showFormError(outcome.message);
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
    const sideLabel = draft.nursingSide === "left" ? "Left" : "Right";
    const message = draft.nursingEntryMode === "manual" ? `${sideLabel} nursing saved` : `${sideLabel} timer started`;
    if (onAdd(entry, message)) onClose();
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
      { type: "growth", start: draft.logTime, weightGrams: draft.weightGrams, lengthCm: draft.lengthCm, headCm: draft.headCm, note: draft.note },
      { clampTime: true },
    );
    if (!outcome.ok) {
      showFormError(outcome.message);
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
    if (onAdd(entry, `${((outcome.value.weightGrams ?? 0) / 1_000).toFixed(2)} kg saved`)) onClose();
  }

  function saveHealthNote() {
    const outcome = validateDraft(
      { type: "health", start: draft.logTime, temperatureC: draft.temperatureC, note: draft.note },
      { clampTime: true },
    );
    if (!outcome.ok) {
      showFormError(outcome.message);
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
    const timed = editing.type === "sleep" || editing.type === "nursing";
    const outcome = validateDraft(
      {
        type: editing.type,
        start: draft.logTime,
        end: timed ? draft.endTime : undefined,
        amount: draft.bottleAmount,
        weightGrams: draft.weightGrams,
        lengthCm: draft.lengthCm,
        headCm: draft.headCm,
        temperatureC: draft.temperatureC,
        note: draft.note,
      },
      { allowEqualEnd: true },
    );
    if (!outcome.ok) {
      showFormError(outcome.message);
      return;
    }

    const next: Activity = {
      ...editing,
      startedAt: outcome.value.startedAt,
      endedAt: timed ? outcome.value.endedAt : undefined,
      note: outcome.value.note,
    };

    if (
      (next.type === "nursing" || next.type === "sleep") &&
      !next.endedAt &&
      activities.some(
        (activity) => activity.type === next.type && !activity.endedAt && activity.id !== next.id,
      )
    ) {
      showFormError(`Another ${next.type} timer is already running. Stop it first.`);
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
              <Button type="button" variant="outline" aria-label="Decrease amount" onClick={() => setDraft((current) => ({ ...current, bottleAmount: Math.max(10, current.bottleAmount - 10) }))}><Minus /></Button>
              <ButtonGroupText><strong>{draft.bottleAmount}</strong><span>ml</span></ButtonGroupText>
              <Button type="button" variant="outline" aria-label="Increase amount" onClick={() => setDraft((current) => ({ ...current, bottleAmount: Math.min(400, current.bottleAmount + 10) }))}><Plus /></Button>
            </ButtonGroup>
          </Field>
          <ToggleGroup type="single" value={String(draft.bottleAmount)} className="preset-row" aria-label="Preset amounts" onValueChange={(value) => value && patch({ bottleAmount: Number(value) })}>
            {bottlePresets.map((amount, index) => <ToggleGroupItem autoFocus={index === 0} data-initial-focus={index === 0 ? "" : undefined} value={String(amount)} aria-label={`${amount} millilitres`} key={amount}>{amount}</ToggleGroupItem>)}
          </ToggleGroup>
          <Field className="choice-field">
            <FieldLabel>Milk</FieldLabel>
            <ToggleGroup type="single" value={draft.milkType} className="segmented" aria-label="Milk type" onValueChange={(value) => value && patch({ milkType: value as "formula" | "expressed" })}>
              <ToggleGroupItem value="formula">Formula<Check className="choice-check" /></ToggleGroupItem>
              <ToggleGroupItem value="expressed">Breast milk<Check className="choice-check" /></ToggleGroupItem>
            </ToggleGroup>
          </Field>
          <TimeField value={draft.logTime} onChange={(value) => patch({ logTime: value })} />
          <NoteField value={draft.note} onChange={(value) => patch({ note: value })} />
          <DialogFooter><Button type="submit" className="primary-button sheet-primary">Save {draft.bottleAmount} ml</Button></DialogFooter>
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
              className="segmented nursing-mode"
              aria-label="Nursing entry method"
              onValueChange={(value) => value && changeNursingEntryMode(value as "timer" | "manual")}
            >
              <ToggleGroupItem autoFocus={draft.nursingEntryMode === "timer"} data-initial-focus={draft.nursingEntryMode === "timer" ? "" : undefined} value="timer">
                <span className="choice-icon"><Clock /></span>
                <span className="choice-copy"><strong>Timer</strong><small>Starts now</small></span>
                <Check className="choice-check" />
              </ToggleGroupItem>
              <ToggleGroupItem autoFocus={draft.nursingEntryMode === "manual"} data-initial-focus={draft.nursingEntryMode === "manual" ? "" : undefined} value="manual">
                <span className="choice-icon"><Pencil /></span>
                <span className="choice-copy"><strong>Manual</strong><small>Past session</small></span>
                <Check className="choice-check" />
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>
          <Field className="nursing-side-field">
            <FieldLabel>Side</FieldLabel>
            <ToggleGroup type="single" value={draft.nursingSide} className="side-grid" aria-label="Nursing side" onValueChange={(value) => value && patch({ nursingSide: value as "left" | "right" })}>
              <ToggleGroupItem value="left"><span className="side-letter">L</span><span className="choice-copy"><strong>Left side</strong><small>Left breast</small></span><Check className="choice-check" /></ToggleGroupItem>
              <ToggleGroupItem value="right"><span className="side-letter">R</span><span className="choice-copy"><strong>Right side</strong><small>Right breast</small></span><Check className="choice-check" /></ToggleGroupItem>
            </ToggleGroup>
          </Field>
          {draft.nursingEntryMode === "timer" ? (
            <TimeField value={draft.logTime} label="Started" inputRef={invalidFieldRef} error={Boolean(formError)} onChange={(value) => { patch({ logTime: value }); setFormError(null); }} />
          ) : (
            <div className="measurement-row nursing-time-row">
              <TimeField value={draft.logTime} label="Started" inputRef={invalidFieldRef} error={Boolean(formError)} onChange={(value) => { patch({ logTime: value }); setFormError(null); }} />
              <TimeField value={draft.endTime} label="Ended" error={Boolean(formError)} onChange={(value) => { patch({ endTime: value }); setFormError(null); }} />
            </div>
          )}
          <NoteField value={draft.note} onChange={(value) => patch({ note: value })} />
          <FormError message={formError} />
          <DialogFooter>
            <p className="sheet-footer-note">{draft.nursingEntryMode === "timer" ? "The timer stays active if you close the app." : "The completed session will be added directly to the timeline."}</p>
            <Button type="submit" className="primary-button sheet-primary">
              {draft.nursingEntryMode === "timer" ? `Start ${draft.nursingSide} timer` : `Save ${draft.nursingSide} session`}
            </Button>
          </DialogFooter>
        </SheetForm>
      )}

      {sheet === "diaper" && (
        <SheetForm onSubmit={() => saveDiaper(draft.diaperKind)}>
          <LogDialogHeader icon={<Droplet />} eyebrow="Quick log" title="What was it?" description="Choose the closest match and save." />
          <Field className="choice-field">
            <FieldLabel>Diaper type</FieldLabel>
            <ToggleGroup type="single" value={draft.diaperKind} className="diaper-grid" aria-label="Diaper type" onValueChange={(value) => value && patch({ diaperKind: value as DiaperKind })}>
              <ToggleGroupItem autoFocus data-initial-focus value="wet"><Droplet size={22} /><strong>Wet</strong><Check className="choice-check" /></ToggleGroupItem>
              <ToggleGroupItem value="dirty"><span className="dot-icon">●</span><strong>Dirty</strong><Check className="choice-check" /></ToggleGroupItem>
              <ToggleGroupItem value="both"><span className="both-icon"><Droplet size={18} />●</span><strong>Both</strong><Check className="choice-check" /></ToggleGroupItem>
            </ToggleGroup>
          </Field>
          <TimeField value={draft.logTime} onChange={(value) => patch({ logTime: value })} />
          <NoteField value={draft.note} onChange={(value) => patch({ note: value })} />
          <DialogFooter><Button type="submit" className="primary-button sheet-primary">Save {draft.diaperKind === "both" ? "wet + dirty" : draft.diaperKind} diaper</Button></DialogFooter>
        </SheetForm>
      )}

      {sheet === "growth" && (
        <SheetForm onSubmit={saveGrowth}>
          <LogDialogHeader icon={<Weight />} eyebrow="Growth check" title="Add measurement" description="Record measurements consistently to make the trend useful." />
          <FieldGroup className="measurement-fields">
            <UnitField {...numericFieldProps("weightGrams")} value={draft.weightGrams} inputRef={invalidFieldRef} autoFocus invalid={Boolean(formError)} onChange={(value) => { patch({ weightGrams: value }); setFormError(null); }} placeholder="3500" className="measurement-primary" />
            <div className="measurement-row">
              <UnitField {...numericFieldProps("lengthCm")} optional value={draft.lengthCm} onChange={(value) => patch({ lengthCm: value })} placeholder="51.5" />
              <UnitField {...numericFieldProps("headCm")} optional value={draft.headCm} onChange={(value) => patch({ headCm: value })} placeholder="35.1" />
            </div>
          </FieldGroup>
          <TimeField value={draft.logTime} onChange={(value) => patch({ logTime: value })} />
          <NoteField value={draft.note} onChange={(value) => patch({ note: value })} placeholder="Clinic, home scale, or anything useful" />
          <p className="sheet-advice">Measure consistently and use the trend as context for your paediatrician.</p>
          <FormError message={formError} />
          <DialogFooter><Button type="submit" className="primary-button sheet-primary">Save growth check</Button></DialogFooter>
        </SheetForm>
      )}

      {sheet === "health" && (
        <SheetForm onSubmit={saveHealthNote}>
          <LogDialogHeader icon={<Thermometer />} eyebrow="Health log" title="Temperature or note" description="Keep a time-stamped note you can refer back to." />
          <UnitField {...numericFieldProps("temperatureC")} optional value={draft.temperatureC} inputRef={invalidFieldRef} autoFocus invalid={Boolean(formError)} onChange={(value) => { patch({ temperatureC: value }); setFormError(null); }} placeholder="36.7" />
          <TemperatureAdvice value={draft.temperatureC} ageMonths={babyAgeMonths} />
          <NoteField value={draft.note} onChange={(value) => patch({ note: value })} placeholder="Medicine, spit-up, rash, question for the doctor…" />
          <TimeField value={draft.logTime} onChange={(value) => patch({ logTime: value })} />
          <FormError message={formError} />
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
              <UnitField {...numericFieldProps("amount")} value={draft.bottleAmount} inputRef={invalidFieldRef} autoFocus invalid={Boolean(formError)} onChange={(value) => { patch({ bottleAmount: Number(value) }); setFormError(null); }} className="measurement-primary" />
              <ToggleGroup type="single" value={String(draft.bottleAmount)} className="preset-row" aria-label="Preset amounts" onValueChange={(value) => { if (value) patch({ bottleAmount: Number(value) }); setFormError(null); }}>
                {bottlePresets.map((amount) => <ToggleGroupItem value={String(amount)} aria-label={`${amount} millilitres`} key={amount}>{amount}</ToggleGroupItem>)}
              </ToggleGroup>
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
            <ToggleGroup type="single" value={draft.nursingSide} className="side-grid" aria-label="Nursing side" onValueChange={(value) => value && patch({ nursingSide: value as "left" | "right" })}>
              <ToggleGroupItem autoFocus data-initial-focus value="left"><span className="side-letter">L</span><span className="choice-copy"><strong>Left side</strong><small>Left breast</small></span><Check className="choice-check" /></ToggleGroupItem>
              <ToggleGroupItem value="right"><span className="side-letter">R</span><span className="choice-copy"><strong>Right side</strong><small>Right breast</small></span><Check className="choice-check" /></ToggleGroupItem>
            </ToggleGroup>
          )}

          {editing.type === "diaper" && (
            <ToggleGroup type="single" value={draft.diaperKind} className="diaper-grid" aria-label="Diaper type" onValueChange={(value) => value && patch({ diaperKind: value as DiaperKind })}>
              <ToggleGroupItem autoFocus data-initial-focus value="wet"><Droplet size={22} /><strong>Wet</strong><Check className="choice-check" /></ToggleGroupItem>
              <ToggleGroupItem value="dirty"><span className="dot-icon">●</span><strong>Dirty</strong><Check className="choice-check" /></ToggleGroupItem>
              <ToggleGroupItem value="both"><span className="both-icon"><Droplet size={18} />●</span><strong>Both</strong><Check className="choice-check" /></ToggleGroupItem>
            </ToggleGroup>
          )}

          {editing.type === "growth" && (
            <FieldGroup className="measurement-fields">
              <UnitField {...numericFieldProps("weightGrams")} value={draft.weightGrams} inputRef={invalidFieldRef} autoFocus invalid={Boolean(formError)} onChange={(value) => { patch({ weightGrams: value }); setFormError(null); }} className="measurement-primary" />
              <div className="measurement-row">
                <UnitField {...numericFieldProps("lengthCm")} optional value={draft.lengthCm} onChange={(value) => { patch({ lengthCm: value }); setFormError(null); }} />
                <UnitField {...numericFieldProps("headCm")} optional value={draft.headCm} onChange={(value) => { patch({ headCm: value }); setFormError(null); }} />
              </div>
            </FieldGroup>
          )}

          {editing.type === "health" && (
            <>
              <UnitField {...numericFieldProps("temperatureC")} optional value={draft.temperatureC} inputRef={invalidFieldRef} autoFocus invalid={Boolean(formError)} onChange={(value) => { patch({ temperatureC: value }); setFormError(null); }} placeholder="36.7" />
              <TemperatureAdvice value={draft.temperatureC} ageMonths={babyAgeMonths} />
            </>
          )}

          <div className={isTimed ? "measurement-row edit-time-row" : ""}>
            <TimeField value={draft.logTime} label={isTimed ? "Started" : "When"} autoFocus={editing.type === "sleep"} inputRef={editing.type === "sleep" || editing.type === "nursing" || editing.type === "diaper" ? invalidFieldRef : undefined} error={Boolean(formError)} onChange={(value) => { patch({ logTime: value }); setFormError(null); }} />
            {isTimed && <TimeField value={draft.endTime} label="Ended (leave empty if running)" error={Boolean(formError)} onChange={(value) => { patch({ endTime: value }); setFormError(null); }} />}
          </div>
          <NoteField value={draft.note} onChange={(value) => { patch({ note: value }); setFormError(null); }} />
          <FormError message={formError} />
          <DialogFooter><Button type="submit" className="primary-button sheet-primary">Save changes</Button></DialogFooter>

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
