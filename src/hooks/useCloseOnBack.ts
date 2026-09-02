import { useEffect, useRef } from "react";

// The Android back gesture, taught to close the sheet rather than the app.
//
// A bottom sheet is a screen to the person looking at it, so back should take
// them off it. The browser disagrees: nothing was navigated, so back pops the
// app's own history — and in a `display: standalone` install that history is
// empty, so the whole app closes. A parent who opened the wrong form and
// swiped back lost the app, mid-feed.
//
// The trick is to give back something to pop. Opening a surface pushes one
// entry; the gesture consumes it and we close the surface instead. Closing
// the surface any other way takes that entry back off, so the history never
// grows a tail of phantom steps to walk through.
//
// Several surfaces use this at once — the log sheet, the Sounds panel, the
// feedback form, the news, and "which tab am I on". They form a stack, and
// ONE listener answers a pop by closing the surface on top, so a gesture
// never closes the sheet and leaves the tab in the same breath. A surface
// that unmounts while it holds an entry (a dialog rendered only while open)
// gives the entry back on its way out, or the stack would be left with a
// phantom on top that swallowed every later gesture.

type Entry = { token: symbol; close: () => void };

const stack: Entry[] = [];
// Pops this module caused itself (history.back() after a programmatic close)
// must not be answered as gestures.
let ownPops = 0;
let listening = false;

function onPop() {
  if (ownPops > 0) {
    ownPops -= 1;
    return;
  }
  const top = stack.pop();
  top?.close();
}

function listen() {
  if (listening) return;
  listening = true;
  window.addEventListener("popstate", onPop);
}

function release(token: symbol) {
  const at = stack.findIndex((entry) => entry.token === token);
  if (at < 0) return;
  stack.splice(at, 1);
  ownPops += 1;
  window.history.back();
}

export function useCloseOnBack(open: boolean, onClose: () => void) {
  const token = useRef(Symbol("close-on-back"));
  // Held in a ref so the stack entry always calls the latest handler rather
  // than the one an earlier render captured. Written in an effect, never
  // during render.
  const close = useRef(onClose);
  useEffect(() => {
    close.current = onClose;
  }, [onClose]);

  useEffect(() => {
    listen();
    const held = stack.some((entry) => entry.token === token.current);
    if (open && !held) {
      stack.push({ token: token.current, close: () => close.current() });
      window.history.pushState({ numaSheet: true }, "");
      return;
    }
    // Closed by the X, by Escape, or by saving. Remove our entry so back
    // still means "the thing before this app", not "nothing happens twice".
    if (!open && held) release(token.current);
  }, [open]);

  // Unmounted while open — a dialog that is rendered only while it is open
  // closes exactly this way. Give the entry back.
  useEffect(() => {
    const mine = token.current;
    return () => release(mine);
  }, []);
}
