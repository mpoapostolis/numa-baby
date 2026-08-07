import { useEffect, useState } from "react";

// Shared render clocks. Both tick only while the tab is visible and re-sync
// immediately on visibilitychange, so a phone waking from sleep never shows a
// stale "last fed 2m ago" while the interval catches up.

export function useMinuteClock() {
  const [minuteClock, setMinuteClock] = useState(Date.now);

  useEffect(() => {
    const update = () => setMinuteClock(Date.now());
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") update();
    }, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return minuteClock;
}

// One-second variant for the live elapsed readout on ActiveTimerCard.
export function useSecondClock() {
  const [secondClock, setSecondClock] = useState(Date.now);

  useEffect(() => {
    const update = () => setSecondClock(Date.now());
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") update();
    }, 1_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return secondClock;
}
