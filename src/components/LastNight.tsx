// "How was the night?"
//
// The first question of every morning, asked by the partner who slept, by a
// grandmother on the phone, and by the parent themselves trying to remember
// three hours that have already blurred. It is answered here from the log,
// once, and it goes out as a picture in one tap — because the answer is
// usually wanted by somebody who is not holding this phone.
//
// Mornings only, and only when the night holds something. An empty card
// about a night nobody logged is worse than no card.

import { Moon, Share2 } from "lucide-react";
import { track } from "../domain/analytics";
import { NightSummary } from "../domain/nightSummary";
import { shareLink } from "../domain/shareApp";
import { formatTime, humanDuration } from "../domain/time";
import { shareCardOnTap } from "../lib/shareOnTap";
import { Button } from "./ui/button";

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <div className="night-figure">
      <strong className="figure t-numeral">{value}</strong>
      <span>{label}</span>
    </div>
  );
}

export function LastNight({ night, name }: { night: NightSummary; name: string }) {
  const who = name.trim() || "Baby";

  function share() {
    track("night_shared");
    void shareCardOnTap((cards) => cards.nightCard(name, night), "numalog-last-night.png", `${who} · last night · ${shareLink("night")}`);
  }

  return (
    <section className="night-card" aria-labelledby="last-night-heading">
      <header>
        <span className="action-icon glyph-sleep" aria-hidden="true"><Moon size={18} /></span>
        <div>
          <h2 id="last-night-heading" className="t-label">Last night</h2>
          <p className="night-line">
            {night.sleepMinutes > 0
              ? <>{humanDuration(night.sleepMinutes)} asleep{night.wakeUps > 0 && <> · {night.wakeUps} {night.wakeUps === 1 ? "waking" : "wakings"}</>}</>
              : <>{night.feeds} night {night.feeds === 1 ? "feed" : "feeds"} logged</>}
          </p>
        </div>
        <Button variant="ghost" size="sm" aria-label="Share last night as a picture" onClick={share}>
          <Share2 size={18} aria-hidden="true" />
        </Button>
      </header>
      <div className="night-figures">
        {night.longestStretchMinutes > 0 && (
          <Figure value={humanDuration(night.longestStretchMinutes)} label="longest stretch" />
        )}
        {night.feeds > 0 && <Figure value={String(night.feeds)} label={night.feeds === 1 ? "feed" : "feeds"} />}
        {night.diapers > 0 && <Figure value={String(night.diapers)} label={night.diapers === 1 ? "change" : "changes"} />}
        {night.firstFeedAt && <Figure value={formatTime(night.firstFeedAt)} label="first feed" />}
      </div>
    </section>
  );
}
