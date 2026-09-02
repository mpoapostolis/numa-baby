// The offer of a second phone, made at 3am.
//
// Not a dialog: a card, at the top of Today, with a way to say no that is
// the same size as the way to say yes. At this hour a modal is an assault.
// It is shown once in the life of this phone (domain/nightAlone.ts decides
// when), because an offer that comes back at 3am is nagging.

import { Users, X } from "lucide-react";
import { Button } from "./ui/button";

export function NightHelp({ name, onInvite, onDismiss }: { name: string; onInvite: () => void; onDismiss: () => void }) {
  const who = name.trim() || "your baby";
  return (
    <section className="night-help" aria-labelledby="night-help-heading">
      <span className="action-icon" aria-hidden="true"><Users size={18} /></span>
      <div className="night-help-copy">
        <h2 id="night-help-heading">You have done a few of these alone</h2>
        <p>
          The other parent’s phone can hold the same log — so whoever wakes up
          next already knows when {who} last fed, without asking you.
        </p>
      </div>
      <div className="night-help-actions">
        <Button onClick={onInvite}>Add their phone</Button>
        <Button variant="ghost" aria-label="Not now" onClick={onDismiss}>
          <X size={16} aria-hidden="true" /> Not now
        </Button>
      </div>
    </section>
  );
}
