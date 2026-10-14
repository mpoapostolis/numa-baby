import { useEffect, useState } from "react";

/** After a miss, look again: the other parent's entry can arrive over sync a
    moment before its photo has finished uploading (or while they are still
    in a tunnel). Cheap when there is nothing to find — a family that does not
    share its log makes no request at all. */
const RETRY_MS = [15_000, 60_000, 180_000, 600_000];

/**
 * A photo id as something to show:
 * - a URL once it is here (this phone's copy, or the other phone's, fetched
 *   once and kept);
 * - undefined while it is still being looked for — say nothing yet;
 * - null once it cannot be had (never reached this phone), so a screen can
 *   say so instead of showing an empty box for ever.
 */
export function usePhoto(id: string | undefined): string | null | undefined {
  const [found, setFound] = useState<{ id: string; url: string | null } | null>(null);
  useEffect(() => {
    if (!id) return;
    let alive = true;
    let made: string | null = null;
    let timer: number | undefined;
    // The look the schedule would make next; past the schedule, the last.
    let upNext = RETRY_MS.length;
    // One look at a time: coming back to the app during a download must not
    // start a second one (and make a second URL that is never let go of).
    let looking = false;
    const attempt = (tries: number) => {
      looking = true;
      // The photo code is loaded only when there is a photo to show: most
      // phones open the app with none, and the boot bundle is budgeted.
      void import("../lib/photos")
        .then(({ fetchPhoto }) => fetchPhoto(id))
        .finally(() => {
          looking = false;
        })
        .then((blob) => {
          if (!alive || made) return;
          if (!blob) {
            if (tries < RETRY_MS.length) {
              upNext = tries + 1;
              timer = window.setTimeout(() => attempt(upNext), RETRY_MS[tries]);
            } else setFound({ id, url: null });
            return;
          }
          made = URL.createObjectURL(blob);
          setFound({ id, url: made });
        });
    };
    attempt(0);
    // Past the last retry, coming back to the app looks once more: the avatar
    // in the header is mounted all day and would never see a late upload.
    const onVisible = () => {
      if (document.hidden || made || looking) return;
      // Coming back looks at once — and, mid-schedule, keeps the looks left.
      window.clearTimeout(timer);
      attempt(upNext);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(timer);
      if (made) URL.revokeObjectURL(made);
    };
  }, [id]);
  if (!id) return null;
  return found?.id === id ? found.url : undefined;
}
