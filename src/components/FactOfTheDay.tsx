// The "right now your baby may be…" card: one verified, age-matched fact
// with its sources in plain sight. In its own chunk because the table it
// reads from is eleven kilobytes of prose — the whole of babyFacts.ts rode
// the boot bundle so that one sentence of it could be shown, and the card
// sits below the log tiles where a frame's delay costs a tired thumb nothing.
import { ExternalLink } from "lucide-react";
import { TinyStars } from "./illustrations";
import { track } from "../domain/analytics";
import { bracketOfAge, factOfTheDay } from "../domain/babyFacts";

type FactOfTheDayProps = {
  babyDays: number;
  babyAge: string;
  displayName: string;
};

export default function FactOfTheDay({ babyDays, babyAge, displayName }: FactOfTheDayProps) {
  // One verified fact per day, matched to the baby's exact age — the pick is
  // deterministic (see babyFacts.ts), so both parents see the same fact.
  // The stage list ("right now she may be…") comes from the same bracket.
  const fact = factOfTheDay(babyDays);
  const stage = bracketOfAge(babyDays);
  if (!fact || !stage) return null;
  const stageSources = [...new Map(
    [...stage.doing.map((d) => d.source), fact.source].map((s) => [s.url, s]),
  ).values()];

  return (
    <aside className="fact-card" aria-label="What your baby is doing at this age">
      <span className="fact-spark" aria-hidden="true"><TinyStars size={20} /></span>
      <div className="fact-copy">
        <span className="t-label">
          {babyAge === "born today"
            ? "From day one"
            : babyAge.startsWith("almost")
              ? babyAge
              : `At ${babyAge}`}
        </span>
        <p className="fact-doing-lead">Right now, {displayName} may be:</p>
        <ul className="fact-doing">
          {stage.doing.map((item) => (
            <li key={item.text}>{item.text}</li>
          ))}
        </ul>
        <p className="fact-text t-body">
          <strong className="fact-kicker">Did you know?</strong> {fact.text}
        </p>
        <p className="fact-foot">
          <span className="fact-pace">Every baby has their own pace.</span>
          {stageSources.map((source) => (
            <a
              key={source.url}
              className="fact-source"
              onClick={() => track("source_opened", { name: source.name })}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {source.name} <ExternalLink size={12} aria-hidden="true" />
            </a>
          ))}
        </p>
      </div>
    </aside>
  );
}
