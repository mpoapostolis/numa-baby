// "Need anything?" — the only way a parent can reach the author, and now
// the way the answer comes back.
//
// Kept to one box and one optional line. Someone typing this is usually
// annoyed, often tired, and frequently one-handed: asking them for a name, an
// email and a category first is how you get no messages at all. The first
// message makes this phone a conversation (see domain/feedbackInbox): what
// was said and what was answered sit above the box, like any chat.

import { FormEvent, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { track } from "../domain/analytics";
import {
  addSent,
  conversationOnScreen,
  getInbox,
  inboxKey,
  markInboxSeen,
  refreshInbox,
  subscribeInbox,
  unreadReplies,
  type ThreadMessage,
} from "../domain/feedbackInbox";

type State = "idle" | "sending" | "sent" | "failed";

const stampFormat = new Intl.DateTimeFormat("en", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function stamp(at: string): string {
  const date = new Date(at);
  return Number.isNaN(date.getTime()) ? "" : stampFormat.format(date);
}

function Thread({ thread }: { thread: ThreadMessage[] }) {
  const listRef = useRef<HTMLOListElement>(null);
  const visibleRef = useRef(false);
  const unread = unreadReplies(getInbox());

  // The newest is what matters: open at the bottom, like any conversation.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [thread.length]);

  // Is the conversation in front of the parent? Then an answer counts as
  // read — not merely because Settings was opened with it far below the
  // fold — and arriving, it is not announced over itself.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const show = (visible: boolean) => {
      if (visible === visibleRef.current) return;
      visibleRef.current = visible;
      conversationOnScreen(visible ? 1 : -1);
      if (visible) markInboxSeen();
    };
    if (typeof IntersectionObserver === "undefined") {
      show(true);
    } else {
      const observer = new IntersectionObserver((entries) => show(entries.some((entry) => entry.isIntersecting)));
      observer.observe(list);
      return () => {
        observer.disconnect();
        show(false);
      };
    }
    return () => show(false);
  }, []);

  // An answer that arrives while it is on screen is read as it lands.
  useEffect(() => {
    if (visibleRef.current && unread) markInboxSeen();
  }, [unread, thread.length]);

  return (
    <ol className="feedback-thread" ref={listRef} aria-label="Your messages and the replies">
      {thread.map((message) => (
        <li key={message.id} className={message.from === "dev" ? "feedback-said dev" : "feedback-said you"}>
          <span className="feedback-who">
            {message.from === "dev" ? "Apostolis" : "You"} · {stamp(message.at)}
          </span>
          <p>{message.text}</p>
        </li>
      ))}
    </ol>
  );
}

export function FeedbackForm({ onSent }: { onSent?: () => void } = {}) {
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [state, setState] = useState<State>("idle");
  // What the server said when it refused (too many messages from one
  // connection) — "you may be offline" would send a parent to the wrong fix.
  const [refusal, setRefusal] = useState<string | null>(null);
  const inbox = useSyncExternalStore(subscribeInbox, getInbox, () => null);
  const thread = inbox?.thread ?? [];
  const talking = thread.length > 0;

  // Opening it is asking: the answer may have arrived a minute ago.
  useEffect(() => {
    void refreshInbox(true);
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (message.trim().length < 3 || state === "sending") return;
    setState("sending");
    setRefusal(null);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          contact: contact.trim(),
          appVersion: __APP_VERSION__,
          key: inboxKey(),
        }),
      });
      if (!response.ok) {
        const refused = (await response.json().catch(() => ({}))) as { error?: unknown };
        if (response.status < 500 && typeof refused.error === "string") setRefusal(refused.error);
        throw new Error("rejected");
      }
      const body = (await response.json().catch(() => ({}))) as { message?: ThreadMessage };
      if (body.message) addSent(body.message);
      track("feedback_sent", { withContact: contact.trim().length > 0, inThread: talking });
      setState("sent");
      setMessage("");
      setContact("");
      onSent?.();
    } catch {
      // Offline is the likeliest cause, and this app is used offline a lot.
      setState("failed");
    }
  }

  return (
    <>
      {talking && <Thread thread={thread} />}
      <form className="feedback-form" onSubmit={(event) => void submit(event)}>
        <label className="sr-only" htmlFor="feedback-message">{talking ? "Your reply" : "Your message"}</label>
        <textarea
          id="feedback-message"
          className="feedback-input"
          rows={talking ? 3 : 4}
          maxLength={2000}
          placeholder={talking ? "Write a message…" : "What would make this better?"}
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            if (state === "sent" || state === "failed") setState("idle");
          }}
        />
        {/* Asked once. After the first message the answer comes here anyway,
            and an address given then is used for every reply. */}
        {!talking && (
          <>
            <label className="t-label" htmlFor="feedback-contact">
              Email <span className="feedback-optional">optional — replies show up here too</span>
            </label>
            <input
              id="feedback-contact"
              className="feedback-input"
              type="text"
              maxLength={200}
              autoComplete="email"
              placeholder="only if you also want them by email"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
            />
          </>
        )}
        {state === "sent" && (
          <p className="feedback-thanks" role="status">
            Sent — thank you. The answer will show up right here, and the
            speech bubble gets a dot when it does.
          </p>
        )}
        {state === "failed" && (
          <p className="feedback-error" role="alert">
            {refusal
              ? `That did not send: ${refusal} Your text is still here.`
              : "That did not send — you may be offline. Your text is still here, try again."}
          </p>
        )}
        <Button type="submit" disabled={message.trim().length < 3 || state === "sending"}>
          <MessageCircle size={16} aria-hidden="true" />
          {state === "sending" ? "Sending…" : "Send"}
        </Button>
      </form>
    </>
  );
}

export const FEEDBACK_BLURB =
  "Something broken, missing, or just annoying? It goes straight to the person who built " +
  "this — two tired parents, evenings, between feeds.";

export function FeedbackCard() {
  return (
    <Card className="settings-group">
      <CardHeader>
        <CardTitle asChild><h2>Need anything?</h2></CardTitle>
        <CardDescription>{FEEDBACK_BLURB}</CardDescription>
      </CardHeader>
      <CardContent>
        <FeedbackForm />
      </CardContent>
    </Card>
  );
}
