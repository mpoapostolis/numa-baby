// The "tell me something" bubble.
//
// Placement is the whole design problem here. This app exists to be tapped
// one-handed at 3am, and the tap targets it exists for sit at the TOP of the
// phone. So the bubble takes the bottom-right corner, just above the nav —
// out of the thumb's path to Bottle and Diaper, still impossible to miss.
//
// It hides itself whenever something else owns the screen: the consent
// banner sits in the same corner, and a parent mid-log should not be
// competing with a feedback button.

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { FEEDBACK_BLURB, FeedbackForm } from "./FeedbackCard";
import { track } from "../domain/analytics";

export function FeedbackBubble({ hidden }: { hidden: boolean }) {
  const [open, setOpen] = useState(false);
  if (hidden) return null;

  return (
    <>
      <button
        type="button"
        className="feedback-bubble"
        aria-label="Send feedback to the developer"
        onClick={() => {
          track("feedback_opened", { from: "bubble" });
          setOpen(true);
        }}
      >
        <MessageCircle size={20} aria-hidden="true" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="feedback-dialog">
          <DialogTitle>Need anything?</DialogTitle>
          <DialogDescription>{FEEDBACK_BLURB}</DialogDescription>
          {/* Closing on send would hide the thank-you, so the dialog stays
              open and its own X closes it once that has been read. */}
          <FeedbackForm />
        </DialogContent>
      </Dialog>
    </>
  );
}
