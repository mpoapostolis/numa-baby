// "What's probably next", in one place.
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

import { ReactNode } from "react";
import { Forecast } from "../domain/forecast";
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

export function ComingUp({ entries, now }: { entries: ComingUpEntry[]; now: number }) {
  if (entries.length === 0) return null;
  const ordered = [...entries].sort((a, b) => order(a) - order(b));

  return (
    <section className="coming-up" aria-labelledby="coming-up-heading">
      <h2 id="coming-up-heading" className="t-label">Coming up</h2>
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
    </section>
  );
}
