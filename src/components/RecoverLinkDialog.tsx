// A recovery link, tapped on a phone that already holds a log.
//
// This used to be a four-second toast ("recovery links are for a fresh
// phone") — the link's one moment of attention spent on a dead end, with
// the parent none the wiser that the link itself was still good. But a
// recovery tap on a data-holding phone is not a mistake to wave off: it is
// the same merge-or-adopt decision every other join surface gets, so it
// gets the same real dialog. Cancel spends nothing — the token stays
// unused server-side and this phone keeps everything exactly as it was.

import "../styles/screens/recovery.css";
import { useState } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "./ui/dialog";
import { track } from "../domain/analytics";
import { FamilySync } from "../hooks/useFamilySync";

export default function RecoverLinkDialog({
  token,
  familySync,
  onRecovered,
  onClosed,
}: {
  token: string;
  familySync: FamilySync;
  /** The log is on its way. An empty phone uses this to leave onboarding. */
  onRecovered?: () => void;
  onClosed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const count = familySync.localEntryCount();

  async function redeem(discardLocal: boolean) {
    setBusy(true);
    const outcome = await familySync.emailRedeem(token, "This phone", { discardLocal });
    track(count === 0 ? "magic_link_redeemed" : "recover_link_on_data_phone", { outcome: outcome ?? "failed", discardLocal });
    setBusy(false);
    // Success or failure, the moment is over: success pulls the log in
    // underneath, failure already toasted its honest reason.
    if (outcome === "recovered") {
      onRecovered?.();
      onClosed();
    }
  }

  // An EMPTY phone used to redeem the link the moment the page loaded, with
  // no tap at all. Mail scanners and link previewers open links in browsers
  // that run JavaScript — and such a browser became a paired device holding
  // the family's whole log, while the parent's own tap got "already used".
  // Nothing is minted until a person presses the button.
  if (count === 0) {
    return (
      <Dialog open onOpenChange={(next) => { if (!next && !busy) onClosed(); }}>
        <DialogContent className="merge-choice" onOpenAutoFocus={(event) => event.preventDefault()}>
          <DialogTitle>Restore your log on this phone?</DialogTitle>
          <DialogDescription>
            Your recovery link brings your cloud log onto this phone. Nothing
            happens until you tap Restore — if this isn’t your phone, just close this.
          </DialogDescription>
          <DialogFooter className="merge-choice-actions">
            <Button disabled={busy} onClick={() => void redeem(false)}>
              Restore my log here
            </Button>
            <Button variant="ghost" disabled={busy} onClick={onClosed}>
              Cancel — the link stays unused
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open onOpenChange={(next) => { if (!next && !busy) onClosed(); }}>
      <DialogContent className="merge-choice" onOpenAutoFocus={(event) => event.preventDefault()}>
        <DialogTitle>Restore here? This phone has {count} {count === 1 ? "entry" : "entries"} of its own</DialogTitle>
        <DialogDescription>
          Your recovery link brings your cloud log onto this phone. Choose what
          happens to the entries already here — nothing in the cloud is deleted
          either way.
        </DialogDescription>
        <DialogFooter className="merge-choice-actions">
          <Button disabled={busy} onClick={() => void redeem(false)}>
            Merge them into my cloud log
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => void redeem(true)}>
            Take the cloud log only — discard these
          </Button>
          <Button variant="ghost" disabled={busy} onClick={onClosed}>
            Cancel — the link stays unused
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
