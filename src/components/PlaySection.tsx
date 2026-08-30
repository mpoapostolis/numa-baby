// The Guide's play-and-development section: a handful of age-matched
// activity cards, each with the steps, the source it came from, and a small
// timer — because "we did tummy time for a bit" at 3am means nobody knows
// how long, and a phone face-down next to the play mat can.
//
// One timer at a time, seconds-accurate while it runs, and it simply stops
// when it ends — no alarm sound over a baby who is finally content.

import { useEffect, useState } from "react";
import { ExternalLink, Play, Square } from "lucide-react";
import { track } from "../domain/analytics";
import { PLAY_AREA_LABEL, PlayBracket, PlayIdea } from "../domain/playIdeas";

const TIMER_MINUTES = [2, 5];

function formatLeft(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function PlayCard({
  idea,
  timerEndsAt,
  onStart,
  onStop,
}: {
  idea: PlayIdea;
  /** Epoch ms when this card's running timer ends; null = not running. */
  timerEndsAt: number | null;
  onStart: (minutes: number) => void;
  onStop: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const running = timerEndsAt !== null && timerEndsAt > now;

  useEffect(() => {
    if (timerEndsAt === null) return;
    const id = window.setInterval(() => {
      setNow(Date.now());
      if (Date.now() >= timerEndsAt) onStop();
    }, 1000);
    return () => window.clearInterval(id);
    // onStop identity is per-render; the interval only needs the deadline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerEndsAt]);

  return (
    <li className="play-card">
      <div className="play-card-head">
        <strong>{idea.title}</strong>
        <span className={`play-area-chip play-area-${idea.area}`}>{PLAY_AREA_LABEL[idea.area]}</span>
      </div>
      <p className="play-why">{idea.why}</p>
      <ol className="play-steps">
        {idea.steps.map((step) => <li key={step}>{step}</li>)}
      </ol>
      <p className="play-meta">
        {idea.howLong}
        {idea.safety && <> · <em>{idea.safety}</em></>}
      </p>
      <div className="play-foot">
        <div className="play-timer" role="group" aria-label={`Timer for ${idea.title}`}>
          {running ? (
            <button type="button" className="play-timer-btn is-running" onClick={onStop}>
              <Square size={12} aria-hidden="true" /> {formatLeft(Math.max(0, Math.ceil((timerEndsAt - now) / 1000)))}
            </button>
          ) : (
            TIMER_MINUTES.map((minutes) => (
              <button
                key={minutes}
                type="button"
                className="play-timer-btn"
                onClick={() => {
                  track("play_timer_started", { idea: idea.key, minutes });
                  onStart(minutes);
                }}
              >
                <Play size={12} aria-hidden="true" /> {minutes} min
              </button>
            ))
          )}
        </div>
        <a
          className="fact-source"
          href={idea.source.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track("source_opened", { name: idea.source.name })}
        >
          {idea.source.name} <ExternalLink size={12} aria-hidden="true" />
        </a>
      </div>
    </li>
  );
}

export function PlaySection({ bracket, name }: { bracket: PlayBracket; name: string }) {
  // One running timer across the section — starting a second one replaces
  // the first, which matches how one adult and one baby actually work.
  const [timer, setTimer] = useState<{ key: string; endsAt: number } | null>(null);

  return (
    <section className="surface-card guide-section play-section" aria-labelledby="play-heading">
      <h2 id="play-heading" className="t-title-2">Play &amp; development</h2>
      <p className="t-meta">
        Everyday play for {name} right now — {bracket.stage}. No grades, no
        milestones to pass: stop whenever either of you has had enough. Every
        card links to the page it came from.
      </p>
      <ul className="play-list">
        {bracket.ideas.map((idea) => (
          <PlayCard
            key={idea.key}
            idea={idea}
            timerEndsAt={timer?.key === idea.key ? timer.endsAt : null}
            onStart={(minutes) => setTimer({ key: idea.key, endsAt: Date.now() + minutes * 60_000 })}
            onStop={() => setTimer(null)}
          />
        ))}
      </ul>
    </section>
  );
}
