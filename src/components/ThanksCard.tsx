// A one-time thank-you from the person who built this.
//
// It exists because the app quietly grew past its own family, and the man
// who made it wanted the people using it to hear that directly — not as
// growth copy, but as the truth: this was built for one baby, and it never
// occurred to him that it would end up helping with yours.
//
// Shown once, to devices that actually use the app (there are entries), and
// dismissed forever with one tap. It scrolls with the page — nothing in this
// app floats over a parent's thumb at 3am if it can help it.

import { Suspense, lazy, useState } from "react";
import { Heart, MessageCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { track } from "../domain/analytics";

const FeedbackForm = lazy(() =>
  import("./FeedbackCard").then((m) => ({ default: m.FeedbackForm })),
);

const SEEN_KEY = "numalog-thanks-v1";

function alreadySeen(): boolean {
  try {
    return window.localStorage.getItem(SEEN_KEY) !== null;
  } catch {
    return false;
  }
}

export function ThanksCard() {
  const [hidden, setHidden] = useState(alreadySeen);
  const [writing, setWriting] = useState(false);

  function dismiss() {
    setHidden(true);
    try {
      window.localStorage.setItem(SEEN_KEY, "1");
    } catch {
      // Session state still hides it; worst case it shows once more.
    }
  }

  if (hidden) return null;

  return (
    <Card className="thanks-card">
      <CardHeader>
        <span className="thanks-heart" aria-hidden="true"><Heart /></span>
        <CardTitle asChild><h2>Thank you for being here</h2></CardTitle>
        <CardDescription>
          Numalog started as two parents’ app for their own daughter, built in the
          evenings between feeds. I honestly never expected other families to
          find it — seeing it help with your baby means more than you’d guess.
          If anything is broken, missing, or just annoying, don’t hesitate to
          say so. It comes straight to me.
        </CardDescription>
      </CardHeader>
      <CardContent className="thanks-actions">
        <Button onClick={() => { track("thanks_write_opened"); setWriting(true); }}>
          <MessageCircle /> Write to me
        </Button>
        <Button variant="ghost" onClick={() => { track("thanks_dismissed"); dismiss(); }}>
          Close
        </Button>
      </CardContent>

      <Dialog open={writing} onOpenChange={(open) => { setWriting(open); if (!open) dismiss(); }}>
        <DialogContent className="feedback-dialog">
          <DialogTitle>Say anything</DialogTitle>
          <DialogDescription>
            A bug, a wish, a hello — it all lands with the same person.
          </DialogDescription>
          <Suspense fallback={null}>
            <FeedbackForm />
          </Suspense>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
