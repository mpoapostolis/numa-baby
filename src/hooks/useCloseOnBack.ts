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

type Entry = { token: symbol; close: () => void; pushed: boolean };

const stack: Entry[] = [];
// Pops this module caused itself (history.back() after a programmatic close)
// must not be answered as gestures.
let ownPops = 0;
let listening = false;
// Surfaces opened while one of those pops is still on its way — one closed
// and another opened by the same tap (a News button that opens Months). The
// browser goes back AFTER the code that asked, so an entry pushed at once
// would be the one taken away, and the next back gesture would close the
// app. Their entries are pushed once the pop has landed.
let waiting: Entry[] = [];

function pushEntry(entry: Entry) {
  entry.pushed = true;
  window.history.pushState({ numaSheet: true }, "");
}

function onPop() {
  if (ownPops > 0) {
    ownPops -= 1;
    if (ownPops === 0) {
      const ready = waiting.filter((entry) => stack.includes(entry));
      waiting = [];
      ready.forEach(pushEntry);
    }
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

// Entries given back during this task, taken back in one step.
let stepsBack = 0;

function release(token: symbol) {
  const at = stack.findIndex((entry) => entry.token === token);
  if (at < 0) return;
  const [entry] = stack.splice(at, 1);
  // Closed before its entry was ever pushed: there is nothing to take back.
  if (!entry.pushed) {
    waiting = waiting.filter((other) => other !== entry);
    return;
  }
  // Surfaces closed by one tap — a sheet and the month page or vaccine form
  // open inside it — leave in ONE step: Safari folds two history.back()
  // calls made at once into a single step with a single popstate, which
  // would leave a phantom entry behind and swallow the next back gesture.
  // Counted now, so a surface opened in this same moment waits for it.
  if (stepsBack === 0) {
    ownPops += 1;
    queueMicrotask(() => {
      const steps = stepsBack;
      stepsBack = 0;
      window.history.go(-steps);
    });
  }
  stepsBack += 1;
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
      const entry: Entry = { token: token.current, close: () => close.current(), pushed: false };
      stack.push(entry);
      if (ownPops > 0) waiting.push(entry);
      else pushEntry(entry);
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
