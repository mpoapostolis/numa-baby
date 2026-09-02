// The Rhythm card: what is probably next, and how often the app has been
// right about it.
//
//
// These forecasts used to be scattered: the next feed sat under the timers at
// the top of Today, the next sleep sat below the day band, and nappies had no
// forecast at all. Three answers to one question, in three different places,
// which is how a parent ends up scrolling to find out whether they have time
// for a shower.
//
// Now: one card, soonest first. Anything the app has not learned yet goes last
// and says so plainly, because "still learning" is a fact about the app and
// belongs under the facts about the evening, not above them.
//
// The track record at the foot is the reason this card has a name at all. A
// forecast nobody can check is a horoscope; one that says "right 9 of the
// last 10, within 12 minutes" is a thing a parent tells a friend about.

import { ReactNode } from "react";
import { Share2 } from "lucide-react";
import { Forecast } from "../domain/forecast";
import { RhythmRecord, rhythmLine, worthSharing } from "../domain/rhythm";
import { ActivityType } from "../domain/types";
import { ActivityGlyph } from "./ActivityGlyph";
import { Button } from "./ui/button";
import { forecastRange, forecastRelative, humanDuration } from "../domain/time";

type Copy = { headline: string; hint: ReactNode };

export type ComingUpEntry = {
  /** Which glyph and colour to wear, so a row here matches the same thing
      everywhere else in the app. */
  type: ActivityType;
  label: string;
  forecast: Forecast;
  /** While there is not enough of a rhythm to say anything. */
  waiting: Copy;
  /** Once the window has gone by. Never a stale clock time — a row reading
      "17:00–17:40" at nine in the evening is history dressed as a forecast. */
  gone: Copy;
  action?: { label: string; onClick: () => void; ariaLabel: string };
};

/** Soonest first. A window that has gone by, or one that does not exist yet,
    sorts to the end: neither is an answer to "what is next". */
function order(entry: ComingUpEntry): number {
  const { at, passed } = entry.forecast;
  return at === null || passed ? Number.POSITIVE_INFINITY : at;
}

export function ComingUp({
  entries,
  now,
  name,
  record,
  onShareRecord,
}: {
  entries: ComingUpEntry[];
  now: number;
  /** The baby's name, so the card is theirs and not the app's. */
  name?: string;
  /** How the feed forecast has actually done. */
  record?: RhythmRecord;
  onShareRecord?: () => void;
}) {
  if (entries.length === 0) return null;
  const ordered = [...entries].sort((a, b) => order(a) - order(b));
  const line = record ? rhythmLine(record, name ?? "") : null;
  const who = (name ?? "").trim();

  return (
    <section className="coming-up" aria-labelledby="coming-up-heading">
      <h2 id="coming-up-heading" className="t-label">{who ? `${who}’s rhythm` : "Rhythm"}</h2>
      <ul>
        {ordered.map((entry) => {
          const { at, spread, typicalGap, passed } = entry.forecast;
          const copy: Copy =
            at === null
              ? entry.waiting
              : passed
                ? entry.gone
                : {
                    headline: forecastRelative(at, now),
                    hint: (
                      <>
                        {forecastRange(at, spread)}
                        {/* "usually" is already carried by "Likely in 39m"
                            above; repeating it here cost a second line on a
                            phone, which is where this card is read. */}
                        {typicalGap > 0 && <> · every {humanDuration(typicalGap)}</>}
                      </>
                    ),
                  };
          return (
            <li key={entry.type} className="coming-row">
              {/* The glyph classes are the app's shared colour hooks, so a
                  forecast row wears the same hue as the tile it forecasts. */}
              <span className={`action-icon glyph-${entry.type}`} aria-hidden="true">
                <ActivityGlyph type={entry.type} />
              </span>
              <div className="log-copy">
                <span className="t-label">{entry.label}</span>
                <strong>{copy.headline}</strong>
                <small>{copy.hint}</small>
              </div>
              {entry.action && (
                <Button
                  variant="outline"
                  onClick={entry.action.onClick}
                  aria-label={entry.action.ariaLabel}
                >
                  {entry.action.label}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {line && (
        <p className="rhythm-record">
          <span>{line}</span>
          {/* Offered only on a run worth showing — the moment a parent
              actually wants to tell somebody the app called it. */}
          {onShareRecord && record && worthSharing(record) && (
            <Button variant="ghost" size="sm" aria-label="Share this run as a picture" onClick={onShareRecord}>
              <Share2 size={16} aria-hidden="true" />
            </Button>
          )}
        </p>
      )}
    </section>
  );
}
