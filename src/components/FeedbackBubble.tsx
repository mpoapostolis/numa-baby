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
//
// It is also where an answer arrives. A phone that has written checks for
// replies, and a reply puts a dot on the bubble until it has been read.

import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { useCloseOnBack } from "../hooks/useCloseOnBack";
import { MessageCircle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
// The form itself is only needed once someone taps — the bubble is not.
const FeedbackForm = lazy(() =>
  import("./FeedbackCard").then((m) => ({ default: m.FeedbackForm })),
);
const FEEDBACK_BLURB =
  "Something broken, missing, or just annoying? It goes straight to the person who built " +
  "this — two tired parents, evenings, between feeds.";
import { track } from "../domain/analytics";

/** Has this phone ever written? Read without loading the conversation code,
    which only a phone that has needs. Mirrors INBOX_STORE in feedbackInbox. */
function hasConversation(): boolean {
  try {
    return window.localStorage.getItem("numalog-inbox-v1") !== null;
  } catch {
    return false;
  }
}

/** Mirrors INBOX_STARTED in feedbackInbox: the first message, from anywhere. */
const INBOX_STARTED = "numalog-inbox-started";

type Watcher = { stop: () => void; announce: () => void };

export function FeedbackBubble({ hidden }: { hidden: boolean }) {
  const [open, setOpen] = useState(false);
  // How long to wait before looking for answers, or null for not at all: a
  // phone that never wrote has none. At boot it waits for the first paint;
  // once the parent has written or tapped, it looks at once.
  const [watching, setWatching] = useState<number | null>(() => (hasConversation() ? 1_500 : null));
  const [unread, setUnread] = useState(0);
  const [hasThread, setHasThread] = useState(false);
  // Nothing is announced over a log sheet, or over the conversation itself.
  const quietRef = useRef(true);
  const watcherRef = useRef<Watcher | null>(null);
  const showing = open && !hidden;
  useCloseOnBack(showing, () => setOpen(false));

  useEffect(() => {
    const start = () => setWatching((delay) => delay ?? 0);
    window.addEventListener(INBOX_STARTED, start);
    return () => window.removeEventListener(INBOX_STARTED, start);
  }, []);

  useEffect(() => {
    quietRef.current = hidden || open;
    // A reply that came in while a sheet was open is announced once it closes.
    if (!hidden && !open) watcherRef.current?.announce();
  }, [hidden, open]);

  useEffect(() => {
    if (watching === null) return;
    let cancelled = false;
    // Nothing about an answer is worth slowing the app's first screen for.
    const timer = window.setTimeout(() => {
      import("../domain/feedbackInbox").then((inbox) => {
        if (cancelled) return;
        watcherRef.current = inbox.watchInbox(
          (count, talking) => {
            setUnread(count);
            setHasThread(talking);
          },
          () => {
            if (!quietRef.current) setOpen(true);
          },
          () => quietRef.current,
        );
      }, () => {
        // The chunk did not load (offline, mid-update): no dot this time.
      });
    }, watching);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      watcherRef.current?.stop();
      watcherRef.current = null;
    };
  }, [watching]);

  if (hidden) return null;

  return (
    <>
      <button
        type="button"
        className="feedback-bubble"
        aria-label={
          unread
            ? `Messages — ${unread} new ${unread === 1 ? "reply" : "replies"}`
            : hasThread ? "Messages" : "Send feedback to the developer"
        }
        onClick={() => {
          track("feedback_opened", { from: "bubble", unread });
          setOpen(true);
          setWatching((delay) => delay ?? 0);
        }}
      >
        <MessageCircle size={20} aria-hidden="true" />
        {unread > 0 && <span className="feedback-badge" aria-hidden="true">{unread}</span>}
      </button>

      <Dialog open={showing} onOpenChange={setOpen}>
        <DialogContent className="feedback-dialog">
          <DialogTitle>{hasThread ? "Messages" : "Need anything?"}</DialogTitle>
          <DialogDescription>
            {hasThread
              ? "Answers show up here, with a dot on the bubble when one arrives."
              : FEEDBACK_BLURB}
          </DialogDescription>
          {/* Closing on send would hide the conversation, so the dialog
              stays open and its own X closes it. */}
          <Suspense fallback={null}>
            <FeedbackForm />
          </Suspense>
        </DialogContent>
      </Dialog>
    </>
  );
}
