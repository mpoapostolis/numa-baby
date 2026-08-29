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

import { ArrowLeftRight, Download } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "./ui/dialog";
import { handoffSendUrl, moveTarget } from "../domain/handoff";
import { isIosStandalone } from "../domain/platform";
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

export function MoveBanner({ paired, onDownloadBackup }: {
  paired: boolean;
  onDownloadBackup: () => void;
}) {
  const [target] = useState(() => moveTarget(window.location.origin));
  const [hidden, setHidden] = useState(dismissedRecently);
  // Inside the installed iOS app the handoff link is a trap: the new address
  // opens INSIDE this app's storage partition, the entries land where no
  // later install can see them, and closing the page brings the person right
  // back here — a loop that moves nothing. See domain/platform.ts.
  const [trapped] = useState(isIosStandalone);
  const [explaining, setExplaining] = useState(false);
  if (!target || hidden) return null;

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
              track("move_banner_accepted", { trapped });
              if (trapped) setExplaining(true);
              else window.location.href = handoffSendUrl(window.location.origin, target);
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

      {trapped && (
        <Dialog open={explaining} onOpenChange={setExplaining}>
          <DialogContent>
            <DialogTitle>Moving from the installed app</DialogTitle>
            <DialogDescription>
              An installed app keeps its entries locked inside itself, so a link
              can’t carry them out — the page you saw open was writing into a
              copy nothing else can read.
              {paired
                ? " The good way: Family Sync is on, so your entries are already in the cloud. Open numalog.app in your browser, tap “Join with a code”, and mint the code here in Settings → Family Sync."
                : " The way that works: download a backup file below, open numalog.app in your browser, and choose “Restore a backup”. Everything comes across, and nothing here is touched."}
            </DialogDescription>
            <DialogFooter>
              <Button onClick={() => { track("move_backup_downloaded"); onDownloadBackup(); }}>
                <Download /> Download backup
              </Button>
              <Button variant="ghost" onClick={() => setExplaining(false)}>Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
