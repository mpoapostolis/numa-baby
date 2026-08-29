// The one-time announcement to families that already exist: your log can
// live in the cloud now, guarded by Google or any email, if you want it to.
//
// A modal, once, because this is the feature whose absence has already cost
// one family part of their daughter's first months — it earns the
// interruption exactly once. It never shows over the consent question or an
// open sheet, it quietly retires itself if the family is already protected,
// and "Later" is a real answer: Settings keeps the doors forever.

// Ships with this lazy chunk, not the app shell — the budget rule.
import "../styles/screens/settings.css";
import { useEffect, useState } from "react";
import { CloudUpload } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { ProtectWithGoogle } from "./GoogleRecovery";
import { track } from "../domain/analytics";
import { FamilySync } from "../hooks/useFamilySync";

const SEEN_KEY = "numalog-protect-intro-v1";

function markSeen() {
  try {
    window.localStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Session state still closes it; worst case it shows once more.
  }
}

export function ProtectIntro({ familySync }: { familySync: FamilySync }) {
  const paired = Boolean(familySync.pairing);
  // An unpaired family cannot already be guarded: open on arrival. A paired
  // one might be — stay closed until the status comes back.
  const [open, setOpen] = useState(!paired);

  // Families already guarded never see this — it retires silently.
  useEffect(() => {
    if (!paired) {
      track("protect_intro_shown", { paired: false });
      return;
    }
    let cancelled = false;
    void familySync.recoveryEmail().then((email) => {
      if (cancelled) return;
      if (email) {
        markSeen();
      } else {
        setOpen(true);
        track("protect_intro_shown", { paired: true });
      }
    });
    return () => {
      cancelled = true;
    };
    // Boot-time decision, once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    markSeen();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { track("protect_intro_dismissed"); close(); } }}>
      <DialogContent className="protect-intro">
        <span className="protect-intro-icon" aria-hidden="true"><CloudUpload /></span>
        <DialogTitle>Your log can live in the cloud now</DialogTitle>
        <DialogDescription>
          Until today, everything lived only on this phone — a lost or wiped
          phone meant a lost history. Now, if you want, your log can also be
          protected in the cloud: sign in once with Google or any email, and
          any future phone can get everything back. Optional, free, removable —
          and nothing from your log is ever shared with anyone.
        </DialogDescription>
        <ProtectWithGoogle familySync={familySync} immediate />
        <Button variant="ghost" onClick={() => { track("protect_intro_later"); close(); }}>
          Maybe later — it lives in Settings
        </Button>
      </DialogContent>
    </Dialog>
  );
}
