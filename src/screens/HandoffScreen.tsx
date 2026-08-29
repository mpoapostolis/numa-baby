// The old address, being asked to hand a log over.
//
// This screen is the whole security decision made visible. The allowlist in
// domain/handoff.ts already refused every address that is not this same app,
// but a list in a file is not consent — so the person whose log it is sees
// exactly where it is going, and exactly how much of it, and taps.
//
// Nothing is uploaded. The log rides in the URL fragment, which no browser
// sends to a server, straight from this browser to the other address.

import { useState } from "react";
import "../styles/screens/handoff.css";
import { ArrowRight, Download, ShieldCheck } from "lucide-react";
import { Button } from "../components/ui/button";
import { originLabel } from "../domain/handoff";

type Outcome = "sent" | "too-large" | "failed";

export function HandoffScreen({
  target,
  babyName,
  entryCount,
  onSend,
  onDownloadInstead,
  onCancel,
}: {
  target: string;
  babyName: string;
  entryCount: number;
  onSend: () => Promise<Outcome>;
  onDownloadInstead: () => void;
  onCancel: () => void;
}) {
  const [state, setState] = useState<"idle" | "sending" | Outcome>("idle");
  const entries = `${entryCount} ${entryCount === 1 ? "entry" : "entries"}`;

  return (
    <main className="handoff-screen">
      <section className="handoff-card">
        <span className="handoff-icon" aria-hidden="true"><ShieldCheck /></span>
        <h1>Move this log to {originLabel(target)}?</h1>
        <p className="handoff-lead">
          {babyName ? `${babyName}'s log` : "This log"} — {entries} — would be copied to the same
          app at its other address.
        </p>

        <ul className="handoff-facts">
          <li>Nothing is uploaded. The entries travel inside the link, which no browser sends to a server.</li>
          <li>This copy stays here too. Nothing is deleted from this address.</li>
          <li>You will be asked to confirm again on the other side before anything is merged.</li>
        </ul>

        {state === "too-large" && (
          <p className="handoff-problem" role="alert">
            This log is too big to travel inside a link. Download a backup here and open it there
            instead — that route has no size limit.
          </p>
        )}
        {state === "failed" && (
          <p className="handoff-problem" role="alert">
            Something went wrong packing the log. Nothing was sent, and nothing here has changed.
          </p>
        )}

        <div className="handoff-actions">
          {state === "too-large" ? (
            <Button onClick={onDownloadInstead}>
              <Download size={16} aria-hidden="true" /> Download backup
            </Button>
          ) : (
            <Button
              disabled={state === "sending"}
              onClick={() => {
                setState("sending");
                void onSend().then((outcome) => {
                  // "sent" navigates away, so only a failure lands back here.
                  if (outcome !== "sent") setState(outcome);
                });
              }}
            >
              {state === "sending" ? "Sending…" : <>Send the log <ArrowRight size={16} aria-hidden="true" /></>}
            </Button>
          )}
          <Button variant="ghost" onClick={onCancel}>Not now</Button>
        </div>

        <p className="handoff-warning">
          If you did not ask for this, tap “Not now”. A link alone should never move your baby’s
          records anywhere.
        </p>
      </section>
    </main>
  );
}
