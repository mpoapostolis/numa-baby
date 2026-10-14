import { expect, test } from "vitest";
import { resolvePhotoSave } from "@/domain/photoSave";

// A form holds the photo it opened with. Meanwhile the other parent may have
// changed it, and the pull brought that in while the form sat open.

test("a photo the parent did not touch is whatever it is NOW — the partner's change survives", () => {
  expect(resolvePhotoSave({ opened: undefined, draft: undefined, live: "partner-new-photo" })).toEqual({
    photo: "partner-new-photo",
    share: "partner-new-photo",
    forget: undefined,
  });
});

test("a photo the parent changed is theirs, and only the one they replaced is let go of", () => {
  expect(resolvePhotoSave({ opened: "old-photo-1", draft: "new-photo-2", live: "old-photo-1" })).toEqual({
    photo: "new-photo-2",
    share: "new-photo-2",
    forget: "old-photo-1",
  });
});

test("removing the photo removes it, and never touches one the parent never saw", () => {
  expect(resolvePhotoSave({ opened: "old-photo-1", draft: undefined, live: "partner-new-photo" })).toEqual({
    photo: undefined,
    share: undefined,
    forget: "old-photo-1",
  });
});

test("an unchanged photo is sent again, so a stale delete elsewhere cannot leave it dangling", () => {
  expect(resolvePhotoSave({ opened: "same-photo-1", draft: "same-photo-1", live: "same-photo-1" })).toEqual({
    photo: "same-photo-1",
    share: "same-photo-1",
    forget: undefined,
  });
});
