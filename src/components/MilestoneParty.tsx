// Confetti for a month-birthday. Lazy-loaded, so the app only ever downloads
// a party on a day there is one.
//
// The confetti is deterministic on purpose: positions, delays and colours
// derive from each piece's index, because this codebase's render-purity rules
// (rightly) refuse Math.random in render, and a party does not need true
// randomness — it needs thirty pieces of paper that don't move in lockstep.

import "../styles/screens/milestone.css";
import { useEffect, useState } from "react";
import { PartyPopper } from "lucide-react";
import { Button } from "./ui/button";
import { Milestone, markMilestoneSeen } from "../domain/milestones";
import { track } from "../domain/analytics";

const COLORS = ["var(--glyph-bottle)", "var(--glyph-nursing)", "var(--glyph-diaper)", "var(--glyph-sleep)", "var(--glyph-burp)"];
const PIECES = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  delay: ((i * 53) % 40) / 40,
  duration: 2.2 + ((i * 29) % 30) / 30,
  color: COLORS[i % COLORS.length],
  tilt: ((i * 71) % 360),
  size: 6 + ((i * 13) % 3) * 2,
}));

export function MilestoneParty({ milestone }: { milestone: Milestone }) {
  const [dismissed, setDismissed] = useState(false);
  // Confetti falls once and cleans up after itself; the card stays until read.
  const [raining, setRaining] = useState(true);
  useEffect(() => {
    track("milestone_shown", { id: milestone.id });
    markMilestoneSeen(milestone.id);
    const id = window.setTimeout(() => setRaining(false), 4_000);
    return () => window.clearTimeout(id);
  }, [milestone.id]);

  if (dismissed) return null;

  return (
    <>
      {raining && (
        <div className="confetti" aria-hidden="true">
          {PIECES.map((piece, i) => (
            <span
              key={i}
              style={{
                left: `${piece.left}%`,
                animationDelay: `${piece.delay}s`,
                animationDuration: `${piece.duration}s`,
                background: piece.color,
                width: piece.size,
                height: piece.size * 0.6,
                rotate: `${piece.tilt}deg`,
              }}
            />
          ))}
        </div>
      )}
      <div className="milestone-card" role="status">
        <span className="milestone-icon" aria-hidden="true"><PartyPopper /></span>
        <div className="milestone-copy">
          <strong>{milestone.title}</strong>
          <small>{milestone.sub}</small>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setDismissed(true)}>🎉</Button>
      </div>
    </>
  );
}
