// The things that have to happen today, until they have.
//
// Not a to-do list with satisfying ticks that stay ticked: a card that is
// simply GONE once the last one is done, and back tomorrow morning. The state
// worth showing a tired parent is "what is left", and when nothing is left
// the most useful thing the card can do is stop taking up the screen.
//
// One tap each, no confirmation, no sheet. Ticking writes an ordinary
// activity, so the undo toast that every other log gets covers a mis-tap too
// — which is why there is no "are you sure" here.

import { Check } from "lucide-react";
import type { Routine } from "../domain/routines";

export function DailyRoutines({
  pending,
  total,
  onTick,
}: {
  pending: Routine[];
  /** How many the family keeps, so the card can say "1 of 3 left" rather
      than leaving them to count. */
  total: number;
  onTick: (routine: Routine) => void;
}) {
  const done = total - pending.length;
  return (
    <section className="routines" aria-label="Today's routine">
      <div className="routines-head">
        <h2>Still to do today</h2>
        {done > 0 && <span className="routines-count">{done} of {total} done</span>}
      </div>
      <div className="routines-row">
        {pending.map((routine) => (
          <button
            key={routine.id}
            type="button"
            className="routine-pill"
            onClick={() => onTick(routine)}
            aria-label={`Mark ${routine.label} as done`}
          >
            <span className="routine-check" aria-hidden="true"><Check /></span>
            {routine.label}
          </button>
        ))}
      </div>
    </section>
  );
}
