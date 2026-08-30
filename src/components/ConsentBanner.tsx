// The cookie question, asked once.
//
// Deliberately not a modal and not a wall: a parent who opened this app at
// 4am to log a feed must be able to do exactly that with the banner on
// screen. It sits above the bottom navigation, both answers are equally
// prominent (a "reject" that is harder to find than "accept" is not consent),
// and the choice can be changed later from Settings.

import { ConsentChoice, saveConsent } from "../domain/consent";
import { Button } from "./ui/button";

type ConsentBannerProps = {
  onChoose: (choice: ConsentChoice) => void;
};

export function ConsentBanner({ onChoose }: ConsentBannerProps) {
  function choose(choice: ConsentChoice) {
    saveConsent(choice);
    onChoose(choice);
  }

  // role=region, not dialog: this is deliberately non-modal, never takes
  // focus, and a screen reader hearing "dialog" expects both.
  return (
    <div className="consent-banner" role="region" aria-live="polite" aria-label="Cookie choice">
      <p className="consent-copy">
        Numalog would like to count anonymous page views to see which parts get used.
        Nothing about your baby is ever sent — those entries stay on this device unless you
        turn on Family Sync.
      </p>
      <div className="consent-actions">
        <Button variant="outline" onClick={() => choose("denied")}>No thanks</Button>
        <Button onClick={() => choose("granted")}>Allow</Button>
      </div>
    </div>
  );
}
