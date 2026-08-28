// The "what changed" card.
//
// Not a modal: this app exists to be tapped once at 3am, and a parent holding
// a hungry baby should never have to dismiss a release note first. It sits at
// the top of Today, reads in about five seconds, and goes away for good when
// dismissed.
//
// A fresh install never sees it — everything is new to someone who just
// arrived, so the marker is stored silently instead (see App).
//
// And it is marked as read the moment it is ON SCREEN, not when the X is
// tapped. Being shown IS being seen; making someone dismiss a notice they
// already read is a second job handed to a person holding a baby.

import { useState } from "react";
import { ChevronDown, Sparkles, X } from "lucide-react";
import { Button } from "./ui/button";
import { Release } from "../domain/changelog";

type WhatsNewProps = {
  releases: Release[];
  onDismiss: () => void;
};

export function WhatsNew({ releases, onDismiss }: WhatsNewProps) {
  const [open, setOpen] = useState(false);
  if (releases.length === 0) return null;
  // Closed, this is one line: the headline, which is written to be the whole
  // story on its own. The detail is a tap away for anyone who wants it. Four
  // paragraphs of release notes unfolded above a parent's own baby is exactly
  // the thing this app exists not to be — and most people, most nights, only
  // need to know that something moved.
  //
  // Several releases can pile up for someone who was away; their items read as
  // one list, because "what changed since I last looked" is one question.
  const items = releases.flatMap((release) => release.items).slice(0, 4);

  return (
    <section className="whats-new" aria-labelledby="whats-new-heading">
      <span className="whats-new-icon" aria-hidden="true"><Sparkles size={14} /></span>
      <div className="whats-new-copy">
        <h2 id="whats-new-heading" className="whats-new-title">
          <button
            type="button"
            className="whats-new-toggle"
            aria-expanded={open}
            onClick={() => setOpen((wasOpen) => !wasOpen)}
          >
            <span className="whats-new-tag">New</span>
            <span className="whats-new-headline">{releases[0].title}</span>
            <ChevronDown
              size={14}
              className={open ? "whats-new-chevron is-open" : "whats-new-chevron"}
              aria-hidden="true"
            />
          </button>
        </h2>
        {open && (
          <ul className="whats-new-list">
            {items.map((item) => <li key={item}>{item}</li>)}
          </ul>
        )}
      </div>
      <Button
        variant="ghost"
        className="whats-new-dismiss"
        aria-label="Dismiss what's new"
        onClick={onDismiss}
      >
        <X size={14} aria-hidden="true" />
      </Button>
    </section>
  );
}
