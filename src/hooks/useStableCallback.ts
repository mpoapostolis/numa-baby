import { useCallback, useLayoutEffect, useRef } from "react";

// A handler whose identity never changes but whose body is always the latest
// render's. The store and sync hooks hand out fresh closures every render
// (they read live refs, so that is fine for them), which meant every screen
// they fed re-rendered on every App render — a minute tick, a toast, a sync
// status flip — because a new function is a new prop. Wrapping the handlers
// once here is what lets React.memo on the screens mean anything.
export function useStableCallback<Args extends unknown[], Result>(
  handler: (...args: Args) => Result,
): (...args: Args) => Result {
  const latest = useRef(handler);
  useLayoutEffect(() => {
    latest.current = handler;
  });
  return useCallback((...args: Args) => latest.current(...args), []);
}
