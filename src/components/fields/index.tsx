import { useEffect, useId, useRef, useState } from "react";
import { Button } from "../ui/button";
import {
  DialogClose,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "../ui/field";
import { ToggleGroup, ToggleGroupItem } from "../ui/toggle-group";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "../ui/input-group";
import { NOTE_MAX_LENGTH } from "../../domain/activitySchema";
import { localDateInput } from "../../domain/time";

// The shared building blocks every log sheet is assembled from: headers, the
// time/note/measurement fields and the form wrapper.

export function LogDialogHeader({
  icon,
  eyebrow,
  title,
  description,
  tone = "",
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  tone?: string;
}) {
  return (
    <DialogHeader className="log-dialog-header">
      <span className={`sheet-symbol ${tone}`}>{icon}</span>
      <div>
        <span className="dialog-eyebrow">{eyebrow}</span>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </div>
    </DialogHeader>
  );
}

/** "It happened a bit ago" without opening the OS wheel picker. */
const QUICK_OFFSETS = [
  { minutes: 0, label: "Now", spoken: "Now" },
  { minutes: 15, label: "15m ago", spoken: "15 minutes ago" },
  { minutes: 30, label: "30m ago", spoken: "30 minutes ago" },
  { minutes: 60, label: "1h ago", spoken: "1 hour ago" },
];

export function TimeField({
  value,
  onChange,
  label = "When",
  description,
  inputRef,
  error = false,
  autoFocus = false,
  quick = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  description?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  error?: boolean;
  autoFocus?: boolean;
  /** Offer the one-tap offsets under the picker. Single-time create sheets
      only — a paired start/end row has its own meaning of "now". */
  quick?: boolean;
}) {
  const id = useId();
  // Which shortcut is lit. The sheets that offer these open seeded to now,
  // so "Now" starts lit; dialling an exact time by hand clears it, because
  // the row then describes nothing. Held as state rather than derived from
  // the clock: a render that reads the time is not a pure render.
  const [preset, setPreset] = useState("0");
  return (
    <Field className="time-field" data-invalid={error || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput id={id} ref={inputRef} autoFocus={autoFocus} data-initial-focus={autoFocus ? "" : undefined} type="datetime-local" value={value} max={localDateInput(new Date())} aria-invalid={error} aria-describedby={error ? "sheet-error" : undefined} onChange={(event) => { setPreset(""); onChange(event.target.value); }} />
      </InputGroup>
      {quick && (
        <ToggleGroup
          type="single"
          className="preset-row quick-time"
          aria-label="How long ago"
          value={preset}
          onValueChange={(next) => {
            if (!next) return;
            setPreset(next);
            onChange(localDateInput(new Date(Date.now() - Number(next) * 60_000)));
          }}
        >
          {QUICK_OFFSETS.map((offset) => (
            <ToggleGroupItem key={offset.minutes} value={String(offset.minutes)} aria-label={offset.spoken}>
              {offset.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      )}
      {description && <FieldDescription>{description}</FieldDescription>}
    </Field>
  );
}

/**
 * The sticky bottom bar of a log sheet: a way out on the left, Save on the
 * right. The drawer's other exits — the grab strip and the X — both live in
 * the top 160px of a screen the sheet fills, which is nowhere near the thumb
 * of someone holding a baby.
 */
export function SheetFooter({ children }: { children: React.ReactNode }) {
  return (
    <DialogFooter>
      <DialogClose asChild>
        <Button type="button" variant="ghost" className="sheet-cancel">Cancel</Button>
      </DialogClose>
      {children}
    </DialogFooter>
  );
}

export function NoteField({
  value,
  onChange,
  placeholder = "Anything worth remembering",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <Field className="note-field">
      <FieldLabel htmlFor={id}>Note <span className="optional-label">Optional</span></FieldLabel>
      <InputGroup>
        <InputGroupTextarea
        id={id}
        value={value}
        maxLength={NOTE_MAX_LENGTH}
        rows={2}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      </InputGroup>
    </Field>
  );
}

export function UnitField({
  label,
  value,
  onChange,
  unit,
  placeholder,
  min,
  max,
  step,
  optional = false,
  inputRef,
  autoFocus = false,
  invalid = false,
  className = "",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  unit: string;
  placeholder?: string;
  min: number;
  max: number;
  step: number;
  optional?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  autoFocus?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <Field className={`unit-field ${className}`} data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}{optional && <span className="optional-label">Optional</span>}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={id}
          ref={inputRef}
          autoFocus={autoFocus}
          data-initial-focus={autoFocus ? "" : undefined}
          inputMode="decimal"
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-invalid={invalid}
          aria-describedby={invalid ? "sheet-error" : undefined}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
        <InputGroupAddon align="inline-end"><InputGroupText>{unit}</InputGroupText></InputGroupAddon>
      </InputGroup>
    </Field>
  );
}

export function FormError({ message }: { message: string | null }) {
  // The tall sheets (past nursing, timed edits) overflow their scrollport
  // before this ever renders, and it renders at the very bottom — measured
  // fully behind the sticky footer at 375x812. The focused field gets a red
  // ring, but the sentence saying WHAT is wrong was 100% invisible, and
  // nothing scrolled to it: the focus target was already in view, so focus()
  // moved nothing. So the message walks itself into view; the scroll-margin
  // in components.css keeps it clear of the footer it was hiding behind.
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (message) ref.current?.scrollIntoView({ block: "nearest" });
  }, [message]);
  if (!message) return null;
  return <FieldError ref={ref} className="form-error" id="sheet-error">{message}</FieldError>;
}

export function SheetForm({ children, onSubmit }: { children: React.ReactNode; onSubmit: () => void }) {
  return (
    <form
      className="sheet-form"
      // The app validates, not the browser.
      //
      // Every time field carries max={now} so the native picker greys out
      // future dates — a good hint. But a value past that max also fails NATIVE
      // constraint validation, which blocks the submit event outright: the
      // app's own validator never ran, so the careful sentence it would have
      // shown ("the end time must be after the start and not in the future")
      // could never appear. Every sheet in the app refused a future time in
      // silence. The max stays, because it still shapes the picker; the
      // browser just no longer gets to veto the submit before anyone is told
      // why.
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}
