import { useEffect, useRef } from "react";

// The Android back gesture, taught to close the sheet rather than the app.
//
// A bottom sheet is a screen to the person looking at it, so back should take
// them off it. The browser disagrees: nothing was navigated, so back pops the
// app's own history — and in a `display: standalone` install that history is
// empty, so the whole app closes. A parent who opened the wrong form and
// swiped back lost the app, mid-feed.
//
// The trick is to give back something to pop. Opening a sheet pushes one
// entry; the gesture consumes it and we close the sheet instead. Closing the
// sheet any other way takes that entry back off, so the history never grows a
// tail of phantom steps to walk through.

export function useCloseOnBack(open: boolean, onClose: () => void) {
  const pushed = useRef(false);
  // Held in a ref so the popstate listener is bound once rather than on every
  // render an inline arrow causes. Written in an effect, never during render.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (open && !pushed.current) {
      pushed.current = true;
      window.history.pushState({ numaSheet: true }, "");
      return;
    }
    if (!open && pushed.current) {
      // Closed by the X, by Escape, or by saving. Remove our entry so back
      // still means "the thing before this app", not "nothing happens twice".
      // The flag is cleared FIRST: history.back() fires popstate, and the
      // handler below must see that this pop was ours and ignore it.
      pushed.current = false;
      window.history.back();
    }
  }, [open]);

  useEffect(() => {
    const onPop = () => {
      if (!pushed.current) return;
      pushed.current = false;
      close.current();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
}
