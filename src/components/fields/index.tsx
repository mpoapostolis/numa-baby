import { useEffect, useId, useRef } from "react";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "../ui/field";
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

export function TimeField({
  value,
  onChange,
  label = "When",
  description,
  inputRef,
  error = false,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  description?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  error?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <Field className="time-field" data-invalid={error || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput id={id} ref={inputRef} autoFocus={autoFocus} data-initial-focus={autoFocus ? "" : undefined} type="datetime-local" value={value} max={localDateInput(new Date())} aria-invalid={error} aria-describedby={error ? "sheet-error" : undefined} onChange={(event) => onChange(event.target.value)} />
      </InputGroup>
      {description && <FieldDescription>{description}</FieldDescription>}
    </Field>
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
