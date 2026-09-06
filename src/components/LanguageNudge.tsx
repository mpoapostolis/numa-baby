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
          <small>Όλη η εφαρμογή, με ένα πάτημα — και από τις Ρυθμίσεις όποτε θέλετε.</small>
          {/* One line of English, for the person this reached by mistake —
              a Greek phone in an English speaker's hand. Nothing changes
              unless they tap the Greek button. */}
          <small lang="en">Numalog now speaks Greek. Tap Ελληνικά to switch — otherwise it stays in English.</small>
        </div>
        <div className="backup-nudge-actions">
          <Button onClick={() => { track("language_changed", { language: "el", from: "banner" }); setLanguageChoice("el"); }}>
            Ελληνικά
          </Button>
          <Button variant="ghost" onClick={onDismiss}>Όχι τώρα · Not now</Button>
        </div>
      </div>
    </div>
  );
}
