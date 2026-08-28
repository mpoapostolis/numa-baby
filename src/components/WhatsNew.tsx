// The "what changed" card.
//
// Not a modal: this app exists to be tapped once at 3am, and a parent holding
// a hungry baby should never have to dismiss a release note first. It sits at
// the top of Today, reads in about five seconds, and goes away for good when
// dismissed.
//
// A fresh install never sees it — everything is new to someone who just
// arrived, so the marker is stored silently instead (see App).

import { Sparkles, X } from "lucide-react";
import { Button } from "./ui/button";
import { Release } from "../domain/changelog";

type WhatsNewProps = {
  releases: Release[];
  onDismiss: () => void;
};

export function WhatsNew({ releases, onDismiss }: WhatsNewProps) {
  if (releases.length === 0) return null;
  // Several releases can pile up for someone who was away; their items read
  // as one list, because "what changed since I last looked" is one question.
  // Capped hard at three: this card sits above the logging tiles, and a wall
  // of release notes between a parent and the Bottle button is exactly the
  // thing this app exists not to be.
  const all = releases.flatMap((release) => release.items);
  const items = all.slice(0, 3);
  const extra = all.length - items.length;

  return (
    <section className="whats-new" aria-labelledby="whats-new-heading">
      <span className="whats-new-icon" aria-hidden="true"><Sparkles size={16} /></span>
      <div className="whats-new-copy">
        <span className="t-label">New since you were last here</span>
        <h2 id="whats-new-heading" className="whats-new-title">{releases[0].title}</h2>
        <ul className="whats-new-list">
          {items.map((item) => <li key={item}>{item}</li>)}
        </ul>
        {extra > 0 && (
          <p className="whats-new-more">and {extra} more {extra === 1 ? "change" : "changes"}</p>
        )}
      </div>
      <Button
        variant="ghost"
        className="whats-new-dismiss"
        aria-label="Dismiss what's new"
        onClick={onDismiss}
      >
        <X size={16} aria-hidden="true" />
      </Button>
    </section>
  );
}
