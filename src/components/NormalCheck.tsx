// "Is this normal?"
//
// The thing a parent actually types into a phone in the dark. Every other
// screen in this app shows them their own numbers; this one is the only
// place that answers the question those numbers are being asked in aid of.
//
// The discipline, which matters more than the feature:
// - A RANGE, never a target. "Usual", never "should".
// - Every line carries the page it came from, so it can be checked.
// - It reads YESTERDAY, a day that is over. A morning holds two feeds and
//   no verdict, and a card that panicked about nine in the morning would be
//   the cruellest thing in the app.
// - It never tells anyone what to do. The findings that end at a phone call
//   are insightRules', which is far more careful about them.

import { Check, Info } from "lucide-react";
import { TypicalVerdict, verdictHeadline } from "../domain/typical";

export function NormalCheck({ verdict, name }: { verdict: TypicalVerdict; name: string }) {
  if (verdict.checks.length === 0) return null;
  return (
    <section className={`normal-check${verdict.ordinary ? " is-ordinary" : ""}`} aria-labelledby="normal-check-heading">
      <header>
        <span className="action-icon" aria-hidden="true">{verdict.ordinary ? <Check size={18} /> : <Info size={18} />}</span>
        <h2 id="normal-check-heading">{verdictHeadline(verdict, name)}</h2>
      </header>
      <ul>
        {verdict.checks.map((check) => (
          <li key={check.id} className={check.within ? undefined : "is-outside"}>
            <span className="normal-label">{check.label}</span>
            <span className="normal-value">
              <strong className="t-numeral">{check.id === "sleep" ? `${Math.round(check.value / 60)}h` : check.value}</strong>
              <small>usual {check.range}</small>
            </span>
          </li>
        ))}
      </ul>
      {/* One note and one source: the line that is doing the reassuring, or
          the first one that is not. */}
      {(() => {
        const speaking = verdict.checks.find((check) => !check.within) ?? verdict.checks[0];
        return (
          <p className="normal-note">
            {speaking.note}{" "}
            <a href={speaking.source.url} target="_blank" rel="noopener noreferrer">{speaking.source.name}</a>
          </p>
        );
      })()}
    </section>
  );
}
