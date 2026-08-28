// "Need anything?" — the only way a parent can reach the author.
//
// Kept to one box and one optional line. Someone typing this is usually
// annoyed, often tired, and frequently one-handed: asking them for a name, an
// email and a category first is how you get no messages at all. The contact
// field says plainly that leaving it empty is fine, because a bug report is
// worth having even with no way to reply.

import { FormEvent, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { track } from "../domain/analytics";

type State = "idle" | "sending" | "sent" | "failed";

export function FeedbackCard() {
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [state, setState] = useState<State>("idle");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (message.trim().length < 3 || state === "sending") return;
    setState("sending");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: message.trim(),
          contact: contact.trim(),
          appVersion: __APP_VERSION__,
        }),
      });
      if (!response.ok) throw new Error("rejected");
      track("feedback_sent", { withContact: contact.trim().length > 0 });
      setState("sent");
      setMessage("");
      setContact("");
    } catch {
      // Offline is the likeliest cause, and this app is used offline a lot.
      setState("failed");
    }
  }

  return (
    <Card className="settings-group">
      <CardHeader>
        <CardTitle asChild><h2>Need anything?</h2></CardTitle>
        <CardDescription>
          Something broken, missing, or just annoying? It goes straight to the person who
          built this — one dad, evenings, between feeds.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state === "sent" ? (
          <p className="feedback-thanks" role="status">
            Sent — thank you. Genuinely.
          </p>
        ) : (
          <form className="feedback-form" onSubmit={(event) => void submit(event)}>
            <label className="sr-only" htmlFor="feedback-message">Your message</label>
            <textarea
              id="feedback-message"
              className="feedback-input"
              rows={4}
              maxLength={2000}
              placeholder="What would make this better?"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
            <label className="t-label" htmlFor="feedback-contact">
              Email or handle <span className="feedback-optional">optional — leave empty and I still read it</span>
            </label>
            <input
              id="feedback-contact"
              className="feedback-input"
              type="text"
              maxLength={200}
              autoComplete="email"
              placeholder="only if you want a reply"
              value={contact}
              onChange={(event) => setContact(event.target.value)}
            />
            {state === "failed" && (
              <p className="feedback-error" role="alert">
                That did not send — you may be offline. Your text is still here, try again.
              </p>
            )}
            <Button type="submit" disabled={message.trim().length < 3 || state === "sending"}>
              <MessageCircle size={16} aria-hidden="true" />
              {state === "sending" ? "Sending…" : "Send"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
