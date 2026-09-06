// The card that says, in Greek, that the app speaks Greek.
//
// Written in Greek on purpose, and not through t(): it renders only on a
// phone whose owner reads Greek and is looking at an English app, so this is
// the one sentence they can read without help — putting it through the
// English dictionary would show it to them in the language they are stuck
// in. Dressed like its backup and reminder siblings, same stack, same shape,
// same "not now".

import { Languages } from "lucide-react";
import { Button } from "./ui/button";
import { setLanguageChoice } from "../i18n";
import { track } from "../domain/analytics";

export function LanguageNudgeCard({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="banner-stack">
      <div className="backup-nudge tone-info" role="status" lang="el">
        <span className="backup-nudge-icon" aria-hidden="true"><Languages /></span>
        <div className="backup-nudge-copy">
          <strong>Το Numalog μιλάει πλέον ελληνικά</strong>
          <small>Όλη η εφαρμογή, μαζί με τις υπενθυμίσεις και τις εικόνες που μοιράζεστε. Αλλάζει και από τις Ρυθμίσεις όποτε θέλετε.</small>
        </div>
        <div className="backup-nudge-actions">
          <Button onClick={() => { track("language_changed", { language: "el", from: "banner" }); setLanguageChoice("el"); }}>
            Ελληνικά
          </Button>
          <Button variant="ghost" onClick={onDismiss}>Όχι τώρα</Button>
        </div>
      </div>
    </div>
  );
}
