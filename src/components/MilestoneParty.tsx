// Confetti for a month-birthday. Lazy-loaded, so the app only ever downloads
// a party on a day there is one.
//
// The confetti is deterministic on purpose: positions, delays and colours
// derive from each piece's index, because this codebase's render-purity rules
// (rightly) refuse Math.random in render, and a party does not need true
// randomness — it needs thirty pieces of paper that don't move in lockstep.

import "../styles/screens/milestone.css";
import { useEffect, useState } from "react";
import { PartyPopper, Share2 } from "lucide-react";
import { toast } from "../lib/toast";
import { LifetimeTotals } from "../domain/lifetime";
import { milestoneCard } from "../domain/shareCards";
import { shareLink } from "../domain/shareApp";
import { renderCard, shareImage } from "../lib/shareCard";
import { Button } from "./ui/button";
import { Milestone, markMilestoneSeen, milestoneSeen } from "../domain/milestones";
import { track } from "../domain/analytics";
import { useUnits } from "../domain/units";

const COLORS = ["var(--glyph-bottle)", "var(--glyph-nursing)", "var(--glyph-diaper)", "var(--glyph-sleep)", "var(--glyph-burp)"];
const PIECES = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  delay: ((i * 53) % 40) / 40,
  duration: 2.2 + ((i * 29) % 30) / 30,
  color: COLORS[i % COLORS.length],
  tilt: ((i * 71) % 360),
  size: 6 + ((i * 13) % 3) * 2,
}));

type Props = {
  milestone: Milestone;
  /** Everything since day one, so the card can say what the family has done. */
  totals: LifetimeTotals | null;
  onDismiss?: () => void;
};

export function MilestoneParty({ milestone, totals, onDismiss }: Props) {
  const units = useUnits();
  const [dismissed, setDismissed] = useState(false);
  // Confetti falls once and cleans up after itself; the card stays until read.
  // Once per milestone, not once per mount: Today unmounts on every tab
  // switch, and the card is held for the day by App, so a return to Today
  // remounts this — the card again, the paper not.
  const [raining, setRaining] = useState(() => !milestoneSeen(milestone.id));
  useEffect(() => {
    track("milestone_shown", { id: milestone.id });
    markMilestoneSeen(milestone.id);
    const id = window.setTimeout(() => setRaining(false), 4_000);
    return () => window.clearTimeout(id);
  }, [milestone.id]);

  // The party as a picture, for the family group chat: the one moment a
  // parent WANTS to send something, and the picture carries the app's name.
  async function share() {
    track("milestone_shared", { id: milestone.id });
    try {
      const blob = await renderCard(milestoneCard(milestone, Date.now(), totals, units));
      const outcome = await shareImage(blob, `numalog-${milestone.id}.png`, `${milestone.title} · ${shareLink("milestone")}`);
      if (outcome === "saved") toast("Card saved to your device");
    } catch {
      toast("Could not make the card on this phone");
    }
  }

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
        <Button variant="ghost" size="sm" aria-label="Share this milestone as a picture" onClick={() => void share()}><Share2 size={18} aria-hidden="true" /></Button>
        <Button variant="ghost" size="sm" aria-label="Dismiss the celebration" onClick={() => { setDismissed(true); onDismiss?.(); }}>🎉</Button>
      </div>
    </>
  );
}
