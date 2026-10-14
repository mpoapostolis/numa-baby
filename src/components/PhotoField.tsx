// A photo on an entry, a month, or the baby's profile.
//
// Choosing one compresses it (lib/photos.ts) and keeps it on this phone only.
// Nothing leaves the phone from here: the form that owns the field shares the
// new photo, and lets go of the old one, when it is SAVED — so a parent who
// picks a picture and then cancels has sent nothing anywhere.
//
// Four shapes, one behaviour:
//   compact — the 3am nappy log: a single quiet "Add a photo" until one is
//             chosen, so the quick log stays a quick log.
//   default — a thumbnail beside Change / Remove (editing an entry).
//   hero    — a month's page, where the photo IS the point: full width.
//   avatar  — the baby profile: the round crop the header will show.

import "../styles/screens/keepsake.css";
import { useEffect, useId, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import { Field, FieldDescription, FieldError, FieldLabel } from "./ui/field";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";
import { BabyFace } from "./illustrations";
import { compressPhoto, deleteLocalPhoto, newPhotoId, putLocalPhoto } from "../lib/photos";
import { usePhoto } from "../hooks/usePhoto";
import { useCloseOnBack } from "../hooks/useCloseOnBack";
import { STORAGE_KEY } from "../hooks/useTrackerStore";

/** Is a photo id written anywhere in the saved log or profile? */
function isReferenced(id: string) {
  try {
    return (window.localStorage.getItem(STORAGE_KEY) ?? "").includes(id);
  } catch {
    return true; // Cannot tell: keep it.
  }
}

export function PhotoField({
  label,
  photoId,
  onChange,
  hint,
  onBusyChange,
  variant = "default",
  addLabel = "Add a photo",
}: {
  label: string;
  photoId: string | undefined;
  onChange: (photoId: string | undefined) => void;
  hint?: string;
  /** True while a chosen photo is still being prepared: the form holds its
      Save until then, or the photo would be lost on the way. */
  onBusyChange?: (busy: boolean) => void;
  variant?: "default" | "compact" | "hero" | "avatar";
  /** The pick button's words when there is no photo yet. */
  addLabel?: string;
}) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const url = usePhoto(photoId);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [viewing, setViewing] = useState(false);
  // Spoken, not shown: a screen reader hears "Preparing photo…" and then
  // "Photo added", which the picture itself tells a sighted parent.
  const [status, setStatus] = useState("");
  // Back closes the full-size photo, not the sheet under it.
  useCloseOnBack(viewing, () => setViewing(false));

  // Photos picked HERE, this time. One picked over another, or left behind
  // when the sheet closes without Save, is not kept on the phone for ever.
  const picked = useRef(new Set<string>());
  // Still on screen? A sheet closed while a photo was being prepared must not
  // leave that photo behind on the phone, kept for nothing.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const mine = picked.current;
    return () => {
      mounted.current = false;
      for (const id of mine) {
        // A moment later: a Save that closes the sheet has written by then.
        window.setTimeout(() => {
          if (!isReferenced(id)) void deleteLocalPhoto(id);
        }, 1_500);
      }
    };
  }, []);

  async function choose(file: File | undefined) {
    if (!file || busy) return;
    setBusy(true);
    onBusyChange?.(true);
    setFailed(false);
    setStatus("Preparing photo…");
    try {
      const blob = await compressPhoto(file);
      const id = newPhotoId();
      await putLocalPhoto(id, blob);
      if (!mounted.current) {
        void deleteLocalPhoto(id);
        return;
      }
      // Picked over another picked in this same sitting: that one is gone.
      if (photoId && picked.current.has(photoId)) {
        picked.current.delete(photoId);
        void deleteLocalPhoto(photoId);
      }
      picked.current.add(id);
      onChange(id);
      setStatus("Photo added");
    } catch {
      setFailed(true);
      setStatus("");
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  function remove() {
    onChange(undefined);
    setStatus("Photo removed");
    // The button that had focus is gone with the photo: the picker takes it.
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }

  const pickWords = busy ? "Preparing…" : photoId ? "Change photo" : addLabel;
  const showLabel = variant !== "compact" || Boolean(photoId);
  const showHint = Boolean(hint) && (variant !== "compact" || Boolean(photoId));
  const classes = ["photo-field", `is-${variant}`, photoId ? "has-photo" : ""].filter(Boolean).join(" ");

  const input = (
    <input
      id={inputId}
      ref={inputRef}
      className="sr-only"
      type="file"
      accept="image/*"
      aria-label={photoId ? "Change photo" : addLabel}
      aria-disabled={busy || undefined}
      onChange={(event) => {
        void choose(event.target.files?.[0]);
        // Choosing the same file twice must still fire a change.
        event.target.value = "";
      }}
    />
  );

  return (
    <Field className={classes}>
      {showLabel && (
        <FieldLabel htmlFor={inputId}>
          {label} {variant !== "hero" && <span className="optional-label">Optional</span>}
        </FieldLabel>
      )}

      {variant === "hero" && !photoId ? (
        // A month with no photo yet: the whole frame is the button.
        <label className="photo-drop" htmlFor={inputId} aria-busy={busy || undefined}>
          <Camera size={24} aria-hidden="true" />
          <span>{busy ? "Preparing…" : addLabel}</span>
          <small>Camera or gallery</small>
        </label>
      ) : (
        <div className="photo-field-row">
          {variant === "avatar" && !photoId && (
            // The face that the photo will replace, in the circle it will fill.
            <span className="photo-thumb is-placeholder" aria-hidden="true"><BabyFace size={40} /></span>
          )}
          {photoId && (
            <button
              type="button"
              className="photo-thumb"
              disabled={!url}
              aria-label={url ? "View photo full size" : "Photo not on this phone yet"}
              onClick={() => setViewing(true)}
            >
              {url ? <img src={url} alt="" /> : <Camera size={18} aria-hidden="true" />}
            </button>
          )}
          <label className="photo-pick" htmlFor={inputId} aria-busy={busy || undefined}>
            <Camera size={16} aria-hidden="true" />
            {pickWords}
          </label>
          {photoId && !busy && (
            // Said in words: a bare bin beside "Change photo" read as a way
            // to delete something bigger.
            <Button type="button" variant="ghost" className="photo-remove" aria-label="Remove photo" onClick={remove}>
              <Trash2 size={16} aria-hidden="true" /> Remove
            </Button>
          )}
        </div>
      )}
      {input}

      <span className="sr-only" role="status">{status}</span>
      {failed && <FieldError>That photo could not be prepared on this phone — try another one.</FieldError>}
      {!failed && photoId && url === null && (
        <FieldDescription>This photo hasn’t reached this phone yet.</FieldDescription>
      )}
      {!failed && showHint && url !== null && <FieldDescription>{hint}</FieldDescription>}

      {url && (
        <Dialog open={viewing} onOpenChange={setViewing}>
          <DialogContent className="photo-viewer sm:max-w-2xl" aria-describedby={undefined}>
            <DialogTitle className="sr-only">{label}</DialogTitle>
            <img src={url} alt={label} />
          </DialogContent>
        </Dialog>
      )}
    </Field>
  );
}
