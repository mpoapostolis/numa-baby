// What a form does with its photo on Save. Its own module, off the boot path:
// only the lazy sheets (LogSheet, MonthsSheet) need it, and photoRef.ts —
// which every incoming profile and entry passes through — is on it.

/**
 * What a form writes for its photo on Save, what it sends, and what it lets
 * go of. A form holds the photo it OPENED with; meanwhile the other parent
 * may have changed it, and a pull brought that in while the form sat open.
 * - Untouched: the photo is whatever it is now (the partner's change
 *   survives a name- or note-only save), and it is sent again — an older
 *   write elsewhere may have removed it from the bucket.
 * - Changed: the parent's choice wins, and only the photo they replaced is
 *   let go of — never one they never saw.
 */
export function resolvePhotoSave({ opened, draft, live }: { opened?: string; draft?: string; live?: string }): {
  photo: string | undefined;
  share: string | undefined;
  forget: string | undefined;
} {
  if (draft === opened) return { photo: live, share: live, forget: undefined };
  return { photo: draft, share: draft, forget: opened };
}
