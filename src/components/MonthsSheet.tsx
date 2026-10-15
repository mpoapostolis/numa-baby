// A keepsake: a page for each month-birthday, a photo and a note.
//
// Asked for from the feedback box by a parent who saved the app before the
// birth: "a monthly milestone note for our baby, and upload their pictures in
// profile or just a monthly photo". Each month is one entry in the log
// (type "month", id "month-N"), so it syncs and backs up like everything
// else and two parents writing the same month end up with one page. It is
// not care: it never reaches a total, a chart or the timeline.
//
// It opens as an album, not a ledger: the month the family is living in now
// as a large card, the earlier ones as a grid of photos. An empty month is a
// page waiting, not a chore — no "you haven't" anywhere. Called "Monthly
// photos", the parents' own words: "Months" with a calendar read as
// appointments.

import "../styles/screens/keepsake.css";
import { useEffect, useId, useRef, useState } from "react";
import { Camera, Images } from "lucide-react";
import { Button } from "./ui/button";
import { DialogFooter } from "./ui/dialog";
import { Field, FieldLabel } from "./ui/field";
import { InputGroup, InputGroupTextarea } from "./ui/input-group";
import { LogDialogHeader, SheetForm } from "./fields";
import { PhotoField } from "./PhotoField";
import { usePhoto } from "../hooks/usePhoto";
import { useCloseOnBack } from "../hooks/useCloseOnBack";
import { MonthSlot, MONTHS_KEPT, monthBirthdayOf, monthEntryId, monthLabel, monthSlots } from "../domain/months";
import { monthsReached } from "../domain/keepsakes";
import { NOTE_MAX_LENGTH } from "../domain/activitySchema";
import { resolvePhotoSave } from "../domain/photoSave";
import { Activity, Profile } from "../domain/types";
import { forgetPhoto, sharePhoto } from "../lib/photos";

const longDate = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" });
const longDateYear = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

/** "Tuesday, September 15", with the year when it is not this one. */
function dayName(value: Date, now: number) {
  return (value.getFullYear() === new Date(now).getFullYear() ? longDate : longDateYear).format(value);
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** "Jun 15" this year, "Jun 15, 2025" otherwise. */
function shortDate(value: Date, now: number) {
  const sameYear = value.getFullYear() === new Date(now).getFullYear();
  return value.toLocaleDateString("en", sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
}

/** "Mia is 4 months old today." / "Mia turned 4 months on Tuesday, September 15." */
function turned(who: string, slot: MonthSlot, now: number) {
  const label = monthLabel(slot.month);
  if (sameDay(slot.date, new Date(now))) return `${who} is ${label} old today.`;
  return `${who} turned ${label} on ${dayName(slot.date, now)}.`;
}

/** A month's photo — or, without one, a camera and "No photo yet", which no
    one reads as a photo that failed to load. */
function MonthMedia({ photo, className }: { photo: string | undefined; className: string }) {
  const url = usePhoto(photo);
  return (
    <span className={url ? className : `${className} is-empty`} aria-hidden="true">
      {url ? (
        <img src={url} alt="" loading="lazy" decoding="async" />
      ) : (
        <span className="months-no-photo"><Camera size={22} />No photo yet</span>
      )}
    </span>
  );
}

function MonthEditor({
  who,
  slot,
  entry,
  now,
  onUpsert,
  onDone,
}: {
  who: string;
  slot: MonthSlot;
  entry: Activity | undefined;
  now: number;
  onUpsert: (activity: Activity) => boolean;
  onDone: () => void;
}) {
  const noteId = useId();
  const titleRef = useRef<HTMLHeadingElement | null>(null);
  // The page that replaced the album: focus its title (announced, and no
  // keyboard thrown up unasked), from the top of the sheet.
  useEffect(() => {
    const title = titleRef.current;
    title?.closest(".bottom-sheet")?.scrollTo?.({ top: 0 });
    title?.focus({ preventScroll: true });
  }, []);
  const [note, setNote] = useState(entry?.note ?? "");
  const [photo, setPhoto] = useState(entry?.photo);
  const [photoBusy, setPhotoBusy] = useState(false);
  // The photo this page opened with; the live one may change while it is open.
  const [openedPhoto] = useState(entry?.photo);
  // The note too. Compared with the live one instead, a note the other
  // parent wrote meanwhile turned Done into Save, and Save wrote this
  // page's empty note over theirs.
  const [openedNote] = useState((entry?.note ?? "").trim());
  const noteTouched = note.trim() !== openedNote;

  function save() {
    // Untouched, the note stays whatever it is now (the other parent may
    // have just written one).
    const trimmed = (noteTouched ? note.trim() : entry?.note ?? "").slice(0, NOTE_MAX_LENGTH);
    // Untouched, the photo stays whatever it is now (the other parent may
    // have just added one); changed, only the replaced one is let go of.
    const plan = resolvePhotoSave({ opened: openedPhoto, draft: photo, live: entry?.photo });
    const next: Activity = {
      id: monthEntryId(slot.month),
      type: "month",
      month: slot.month,
      // The month-birthday — but never ahead of now: on the day itself, a
      // note written at nine is not "later today".
      startedAt: new Date(Math.min(slot.date.getTime(), now)).toISOString(),
      ...(trimmed ? { note: trimmed } : {}),
      ...(plan.photo ? { photo: plan.photo } : {}),
    };
    if (!onUpsert(next)) return;
    // Only on Save does a photo leave this phone.
    if (plan.share) void sharePhoto(plan.share);
    if (plan.forget) void forgetPhoto(plan.forget);
    onDone();
  }

  return (
    <SheetForm onSubmit={save}>
      <LogDialogHeader
        icon={<Images />}
        tone="glyph-growth"
        eyebrow={`${who}’s monthly photos`}
        title={monthLabel(slot.month)}
        description={turned(who, slot, now)}
        titleRef={titleRef}
      />
      <PhotoField
        variant="hero"
        label="Photo"
        addLabel="Add a photo"
        photoId={photo}
        onChange={setPhoto}
        onBusyChange={setPhotoBusy}
      />
      <Field className="note-field">
        <FieldLabel htmlFor={noteId}>Note <span className="optional-label">Optional</span></FieldLabel>
        <InputGroup>
          <InputGroupTextarea
            id={noteId}
            value={note}
            maxLength={NOTE_MAX_LENGTH}
            rows={4}
            placeholder="A first smile, a new sound, how the nights are going…"
            onChange={(event) => setNote(event.target.value)}
          />
        </InputGroup>
      </Field>
      {/* The sheet's own sticky footer — but Back returns to the album, it
          does not close the sheet. */}
      <DialogFooter>
        <Button type="button" variant="ghost" className="sheet-cancel" onClick={onDone}>Back</Button>
        {/* Looking back through the album is not editing it: nothing
            changed, nothing to save. */}
        {!noteTouched && photo === openedPhoto ? (
          <Button type="button" className="primary-button sheet-primary" disabled={photoBusy} onClick={onDone}>Done</Button>
        ) : (
          <Button type="submit" className="primary-button sheet-primary" disabled={photoBusy}>Save</Button>
        )}
      </DialogFooter>
    </SheetForm>
  );
}

export function MonthsSheet({
  profile,
  months,
  now,
  onUpsert,
  initialMonth,
  onOpenProfile,
}: {
  profile: Profile;
  months: Activity[];
  now: number;
  onUpsert: (activity: Activity) => boolean;
  /** Open straight on this month — from the month-birthday card. */
  initialMonth?: number;
  /** For a baby with no date of birth yet: the way to add one. */
  onOpenProfile?: () => void;
}) {
  const [open, setOpen] = useState<number | null>(initialMonth ?? null);
  // Back from a month returns focus to that month in the album.
  const [returnTo, setReturnTo] = useState<number | null>(null);
  const album = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (open !== null || returnTo === null) return;
    album.current?.querySelector<HTMLElement>(`[data-focus-key="month-${returnTo}"]`)?.focus();
  }, [open, returnTo]);
  // Android back from a month returns to the album, as the on-screen Back does.
  useCloseOnBack(open !== null, () => setOpen(null));

  const slots = monthSlots(profile.birthDate, now);
  const byMonth = new Map(months.filter((m) => m.month).map((m) => [m.month as number, m]));
  const who = profile.name.trim() || "Your baby";
  const editing = slots.find((slot) => slot.month === open);
  const openMonth = (month: number) => {
    setReturnTo(month);
    setOpen(month);
  };

  if (editing) {
    return <MonthEditor who={who} slot={editing} entry={byMonth.get(editing.month)} now={now} onUpsert={onUpsert} onDone={() => setOpen(null)} />;
  }

  const header = (
    <LogDialogHeader
      icon={<Images />}
      tone="glyph-growth"
      eyebrow="Monthly photos"
      title={`${who}’s monthly photos`}
      description="A photo and a note each month. Only your family sees them."
    />
  );

  if (!profile.birthDate) {
    return (
      <div className="sheet-form sheet-list">
        {header}
        <div className="empty-state months-empty">
          <Images aria-hidden="true" />
          <p>Add {profile.name.trim() ? `${profile.name.trim()}’s` : "the"} date of birth and each month‑birthday gets its own page.</p>
          {onOpenProfile && (
            <Button type="button" variant="outline" data-initial-focus="" onClick={onOpenProfile}>Add date of birth</Button>
          )}
        </div>
      </div>
    );
  }

  const [current, ...earlier] = slots;
  // Past the second year the album has no new pages: the two-year page is
  // the last one, not "this month".
  const pastAlbum = current?.month === MONTHS_KEPT && (monthsReached(profile.birthDate, now) ?? 0) > MONTHS_KEPT;
  const first = monthBirthdayOf(profile.birthDate, 1);
  const next = current && current.month < MONTHS_KEPT ? monthBirthdayOf(profile.birthDate, current.month + 1) : null;

  return (
    <div className="sheet-form sheet-list" ref={album}>
      {header}

      {!current ? (
        // Before the first month-birthday: the first page, waiting.
        <div className="months-now is-waiting" tabIndex={-1} data-initial-focus="">
          <span className="months-now-media is-empty" aria-hidden="true"><span className="months-numeral">1</span></span>
          <span className="months-now-copy">
            <span className="t-label">First page</span>
            <strong>1 month</strong>
            <small>{first ? `${who}’s first month‑birthday is ${dayName(first, now)}. ` : ""}Its page opens here that morning.</small>
          </span>
        </div>
      ) : (
        (() => {
          const entry = byMonth.get(current.month);
          return (
            <button
              type="button"
              className="months-now"
              data-focus-key={`month-${current.month}`}
              data-initial-focus=""
              onClick={() => openMonth(current.month)}
            >
              <MonthMedia photo={entry?.photo} className="months-now-media" />
              <span className="months-now-copy">
                <span className="t-label">{pastAlbum ? "Last page" : "This month"}</span>
                <strong>{monthLabel(current.month)}</strong>
                <small>{turned(who, current, now)}</small>
                {entry?.note && <span className="months-now-note">{entry.note}</span>}
                {/* Says what a tap does, photo or not: the card is the way in. */}
                <span className="months-invite">
                  <Camera size={14} aria-hidden="true" />{" "}
                  {entry?.photo ? "Change photo or note" : pastAlbum ? "Add a photo" : "Add this month’s photo"}
                </span>
              </span>
            </button>
          );
        })()
      )}

      {next && (
        <p className="months-next t-meta">
          {who} turns {monthLabel(current!.month + 1)}{" "}
          {sameDay(next, new Date(now + 86_400_000)) ? "tomorrow" : `on ${dayName(next, now)}`} — a new page opens then.
        </p>
      )}

      {earlier.length > 0 && (
        <section className="months-earlier" aria-labelledby="months-earlier">
          <h3 className="t-label" id="months-earlier">Earlier</h3>
          {/* An album: the photos large, two to a row, so the months can be
              seen side by side. A month without one shows its number. */}
          <ul className="months-grid">
            {earlier.map((slot) => {
              const entry = byMonth.get(slot.month);
              return (
                <li key={slot.month}>
                  <button type="button" className="month-tile" data-focus-key={`month-${slot.month}`} onClick={() => openMonth(slot.month)}>
                    <MonthMedia photo={entry?.photo} className="month-tile-media" />
                    <span className="month-tile-copy">
                      <strong>{monthLabel(slot.month)}</strong>
                      <small>{shortDate(slot.date, now)}</small>
                      {entry?.note && <span className="month-tile-note">{entry.note}</span>}
                    </span>
                    {entry?.photo && <span className="sr-only">, with a photo</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
