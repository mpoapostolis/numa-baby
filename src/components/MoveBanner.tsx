// "We moved" — shown only at the app's OLD address, only once there is a log
// worth moving, and only because the tap genuinely takes everything along.
//
// The reason it gives is the true one: numalog.app is an address the app
// owns, and the workers.dev one is borrowed from Cloudflare's shared space.
// Borrowed addresses are the ones that change under you, and this app keeps
// a family's whole record under whichever address it runs on.
//
// Dismissal is remembered for two weeks, not forever: the old address will
// keep working for as long as anyone is on it, but a parent who taps "Later"
// in a hallway at 3am has not made a decision about where their data lives.

import { ArrowLeftRight } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { handoffSendUrl, moveTarget } from "../domain/handoff";
import { isStandalone } from "../domain/platform";
import { track } from "../domain/analytics";

const DISMISSED_KEY = "numalog-move-dismissed-v1";
export const MOVED_KEY = "numalog-moved-v1";
const DISMISS_DAYS = 14;

function dismissedRecently(): boolean {
  try {
    // A completed move silences this for good — offering to move a log that
    // has already been walked across reads as "did it not work?".
    if (window.localStorage.getItem(MOVED_KEY)) return true;
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_DAYS * 24 * 3600_000;
  } catch {
    return false;
  }
}

export function MoveBanner() {
  const [target] = useState(() => moveTarget(window.location.origin));
  const [hidden, setHidden] = useState(dismissedRecently);
  // Not inside the installed app, ever: there is no honest one-tap move from
  // in there (see domain/platform.ts), and a banner that opens a page which
  // moves nothing is worse than no banner. Installed users who want to move
  // have the backup path in Settings, which works everywhere.
  const [installed] = useState(isStandalone);
  if (!target || hidden || installed) return null;

  return (
    <div className="banner-stack">
      <div className="debug-banner move-banner" role="status">
        <span>
          <ArrowLeftRight />
          <span>
            <strong>Numalog has a new home: numalog.app</strong>
            <small>
              Its own permanent address, instead of one borrowed from a hosting
              provider. One tap moves your whole log — nothing here is deleted,
              and this address keeps working.
            </small>
          </span>
        </span>
        <div className="move-banner-actions">
          <Button
            size="sm"
            onClick={() => {
              track("move_banner_accepted");
              window.location.href = handoffSendUrl(window.location.origin, target);
            }}
          >
            Move my log
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              track("move_banner_dismissed");
              setHidden(true);
              try {
                window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
              } catch {
                // Session state above still hides it.
              }
            }}
          >
            Later
          </Button>
        </div>
      </div>

    </div>
  );
}
