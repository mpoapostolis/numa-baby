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
import { t } from "../i18n";

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
  const entries = entryCount === 1 ? t("1 entry") : t("{n} entries", { n: entryCount });

  return (
    <main className="handoff-screen">
      <section className="handoff-card">
        <span className="handoff-icon" aria-hidden="true"><ShieldCheck /></span>
        <h1>{t("Move this log to {origin}?", { origin: originLabel(target) })}</h1>
        <p className="handoff-lead">
          {babyName
            ? t("{name}’s log — {entries} — would be copied to the same app at its other address.", { name: babyName, entries })
            : t("This log — {entries} — would be copied to the same app at its other address.", { entries })}
        </p>

        {/* The empty-browser trap. A parent who always used the installed
            app arrives here through Safari, where this origin's copy has
            nothing in it — their real log is inside the installed app's own
            storage partition. Sending 0 entries "successfully" would read as
            the app losing everything, so the empty case explains instead. */}
        {entryCount === 0 && (
          <p className="handoff-problem" role="alert">
            {t("This browser’s copy is empty, so there is nothing to send from here. If you have been using the installed app from your home screen, your log lives inside it — open the installed app, go to Settings →")}{" "}
            <strong>{t("Download backup")}</strong>{t(", then choose “Restore a backup” at the new address. Everything comes across.")}
          </p>
        )}

        <ul className="handoff-facts">
          <li>{t("Nothing is uploaded. The entries travel inside the link, which no browser sends to a server.")}</li>
          <li>{t("This copy stays here too. Nothing is deleted from this address — and keep any installed icon until the new address shows your entries: deleting an installed app deletes its storage with it.")}</li>
          <li>{t("You will be asked to confirm again on the other side before anything is merged.")}</li>
        </ul>

        {state === "too-large" && (
          <p className="handoff-problem" role="alert">
            {t("This log is too big to travel inside a link. Download a backup here and open it there instead — that route has no size limit.")}
          </p>
        )}
        {state === "failed" && (
          <p className="handoff-problem" role="alert">
            {t("Something went wrong packing the log. Nothing was sent, and nothing here has changed.")}
          </p>
        )}

        <div className="handoff-actions">
          {state === "too-large" ? (
            <Button onClick={onDownloadInstead}>
              <Download size={16} aria-hidden="true" /> {t("Download backup")}
            </Button>
          ) : (
            <Button
              // Sending zero entries would "succeed", and success would read
              // as the app losing everything. The empty case explains instead.
              disabled={state === "sending" || entryCount === 0}
              onClick={() => {
                setState("sending");
                void onSend().then((outcome) => {
                  // "sent" navigates away, so only a failure lands back here.
                  if (outcome !== "sent") setState(outcome);
                });
              }}
            >
              {state === "sending" ? t("Sending…") : <>{t("Send the log")} <ArrowRight size={16} aria-hidden="true" /></>}
            </Button>
          )}
          <Button variant="ghost" onClick={onCancel}>{t("Not now")}</Button>
        </div>

        <p className="handoff-warning">
          {t("If you did not ask for this, tap “Not now”. A link alone should never move your baby’s records anywhere.")}
        </p>
      </section>
    </main>
  );
}
