import { ExternalLink, PhoneCall, ShieldCheck, Sparkles } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { GrowthChart } from "../components/GrowthChart";
import { LittleBottle } from "../components/illustrations";
import { activityTitle } from "../domain/activityDisplay";
import { formatShortDay, formatTime, humanDuration, median } from "../domain/time";
import { Insight } from "../domain/insightRules";
import { ActivityStats } from "../hooks/useActivityStats";

type InsightsScreenProps = {
  stats: ActivityStats;
  insights: Insight[];
  onAddGrowth: () => void;
  onOpenGuide: () => void;
};

// Tone is the whole design language of a card: what it looks like, what icon
// it wears, and how loudly it speaks. A seek-care card is coral-keyed and
// says so plainly; it is never red, never alarmed, and never a diagnosis.
const TONE_LABEL: Record<Insight["tone"], string> = {
  "seek-care": "Worth a phone call",
  suggest: "Something to try",
  reassure: "This looks ordinary",
};

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <li className={`insight-card tone-${insight.tone}`}>
      <span className="insight-icon" aria-hidden="true">
        {insight.tone === "seek-care" ? <PhoneCall size={16} /> : <Sparkles size={16} />}
      </span>
      <div className="insight-copy">
        <span className="t-label insight-tone">{TONE_LABEL[insight.tone]}</span>
        <h3 className="insight-title">{insight.title}</h3>
        <p className="insight-body">{insight.body}</p>
        <p className="insight-advice">{insight.advice}</p>
        <p className="insight-sources">
          {insight.sources.map((source) => (
            <a key={source.url} className="fact-source" href={source.url} target="_blank" rel="noopener noreferrer">
              {source.name} <ExternalLink size={12} aria-hidden="true" />
            </a>
          ))}
        </p>
      </div>
    </li>
  );
}

// Unit-demoted duration: "2h 15m" with the letters receding (spec rule 4).
function DurationFigure({ minutes }: { minutes: number }) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return <>{mins}<span className="unit">m</span></>;
  if (mins === 0) return <>{hours}<span className="unit">h</span></>;
  return <>{hours}<span className="unit">h</span> {mins}<span className="unit">m</span></>;
}

export default function InsightsScreen({ stats, insights, onAddGrowth, onOpenGuide }: InsightsScreenProps) {
  const {
    typicalGap,
    averageFeeds,
    bottleMlToday,
    latestGrowth,
    weekly,
    maxMl,
    growthEntries,
    weightChange,
  } = stats;

  const showBottles = weekly.some((day) => day.ml > 0);
  const weekFeeds = weekly.reduce((sum, day) => sum + day.feeds.length, 0);
  const weekBottles = weekly.reduce(
    (sum, day) => sum + day.feeds.filter((feed) => feed.type === "bottle").length,
    0,
  );
  const medianMl = median(weekly.filter((day) => day.ml > 0).map((day) => day.ml));
  const todayIndex = weekly.length - 1;
  // Fresh install: with nothing in any tile, the strip would lead with four
  // dashes — skip it and let the rhythm card's EmptyState lead instead.
  const hasSummaryData = Boolean(
    typicalGap || averageFeeds || bottleMlToday > 0 || latestGrowth?.weightGrams,
  );

  // Partial data keeps the full four-tile grid (per-tile hiding causes daily
  // layout shift); each dash is decorative with an SR explanation.
  const emptyTile = (
    <strong className="t-numeral is-empty">
      <span aria-hidden="true">—</span>
      <span className="sr-only">No data yet</span>
    </strong>
  );

  return (
    <section className="screen insights-screen" aria-labelledby="insights-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Last 7 days</p>
          <h1 id="insights-heading">What the log is telling you</h1>
        </div>
      </div>

      {/* The answer first, the evidence below it. Cards only appear when the
          log can support them honestly — silence here is a good sign, not a
          missing feature. */}
      {insights.length > 0 && (
        <ul className="insight-deck" aria-label="What your entries suggest">
          {insights.map((insight) => <InsightCard key={insight.id} insight={insight} />)}
        </ul>
      )}

      {hasSummaryData && (
        <div className="insight-summary">
          <div>
            {typicalGap ? (
              <strong className="t-numeral figure"><DurationFigure minutes={typicalGap} /></strong>
            ) : (
              emptyTile
            )}
            <span className="t-label">Typical feed gap</span>
          </div>
          <div>
            {averageFeeds ? (
              <strong className="t-numeral">{averageFeeds.toFixed(1)}</strong>
            ) : (
              emptyTile
            )}
            <span className="t-label">Feeds / day</span>
          </div>
          <div>
            {bottleMlToday > 0 ? (
              <strong className="t-numeral figure">{bottleMlToday} <span className="unit">ml</span></strong>
            ) : (
              emptyTile
            )}
            <span className="t-label">Bottle total today</span>
          </div>
          <div>
            {latestGrowth?.weightGrams ? (
              <strong className="t-numeral figure">
                {(latestGrowth.weightGrams / 1_000).toFixed(2)} <span className="unit">kg</span>
              </strong>
            ) : (
              emptyTile
            )}
            <span className="t-label">Latest weight</span>
          </div>
        </div>
      )}

      {showBottles && (
        <figure className="chart-card insight-figure">
          <figcaption>
            <div>
              <p className="t-label">Fig. 1 · Bottle volume</p>
              <h2>Most bottle days total about {medianMl} ml.</h2>
            </div>
          </figcaption>
          <div
            className="bar-chart"
            role="img"
            aria-label={`Bottle volume for the last seven days. Most bottle days total about ${medianMl} millilitres. ${weekly
              .map((day) => `${formatShortDay(day.date)}: ${day.ml} millilitres`)
              .join(", ")}.`}
          >
            <div className="bar-plot" aria-hidden="true">
              <div className="bar-median" style={{ bottom: `${(medianMl / maxMl) * 100}%` }} />
              {weekly.map((day, index) => (
                <div className="bar-column" key={day.date.toISOString()}>
                  {day.ml > 0 && (
                    <span
                      className="bar-value"
                      style={{ bottom: `calc(${(day.ml / maxMl) * 100}% + 4px)` }}
                    >
                      {day.ml}
                    </span>
                  )}
                  <div
                    className={index === todayIndex ? "bar-fill is-today" : "bar-fill"}
                    style={{ height: `${(day.ml / maxMl) * 100}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="bar-days">
              {weekly.map((day) => (
                <span key={day.date.toISOString()}>{formatShortDay(day.date)}</span>
              ))}
            </div>
          </div>
          <p className="figure-source">
            From {weekBottles} logged {weekBottles === 1 ? "bottle" : "bottles"} · on this device
          </p>
        </figure>
      )}

      <figure className={`chart-card rhythm-card insight-figure${showBottles ? "" : " is-solo"}`}>
        <figcaption>
          <div>
            <p className="t-label">Fig. {showBottles ? 2 : 1} · Feeding rhythm</p>
            <h2>
              {typicalGap
                ? `Feeds usually arrive about ${humanDuration(typicalGap)} apart.`
                : "Each day’s feeds on a 24-hour line."}
            </h2>
          </div>
        </figcaption>
        {weekFeeds === 0 ? (
          <EmptyState
            illustration={<LittleBottle size={80} />}
            text="No feeds logged yet — the week’s rhythm will draw itself here."
          />
        ) : (
        <div className="rhythm-plot">
          <div className="rhythm-axis" aria-hidden="true"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
          <div className="rhythm-chart">
            {weekly.map((day, index) => (
              <div
                className={index === todayIndex ? "rhythm-row is-today" : "rhythm-row"}
                key={day.date.toISOString()}
                role="img"
                aria-label={
                  day.feeds.length === 0
                    ? `${formatShortDay(day.date)}: no feeds logged`
                    : `${formatShortDay(day.date)}: ${day.feeds
                        .map((feed) => `${activityTitle(feed)} at ${formatTime(feed.startedAt)}`)
                        .join(", ")}`
                }
              >
                <small aria-hidden="true">{formatShortDay(day.date)}</small>
                <div className="rhythm-line" aria-hidden="true">
                  {day.feeds.map((feed) => {
                    const date = new Date(feed.startedAt);
                    const hour = date.getHours() + date.getMinutes() / 60;
                    return (
                      <span
                        className={`feed-dot ${feed.type === "nursing" ? "nursing-dot" : ""}`}
                        key={feed.id}
                        style={{ left: `clamp(5px, ${(hour / 24) * 100}%, calc(100% - 5px))` }}
                        title={`${activityTitle(feed)} at ${formatTime(feed.startedAt)}`}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
        )}
        {weekFeeds > 0 && (
          <div className="chart-legend"><span><i /> Bottle</span><span><i className="nursing-key" /> Nursing</span></div>
        )}
        {weekFeeds > 0 && (
          <p className="figure-source">
            From {weekFeeds} logged {weekFeeds === 1 ? "feed" : "feeds"} · on this device
          </p>
        )}
      </figure>

      <GrowthChart
        activities={growthEntries}
        change={weightChange}
        figure={showBottles ? 3 : 2}
        onAdd={onAddGrowth}
        onOpenGuide={onOpenGuide}
      />

      <div className="gentle-note">
        <ShieldCheck size={20} />
        <p><strong>Useful, not judgmental.</strong> Baby Tracker summarizes what you logged. It never scores your parenting or replaces medical advice.</p>
      </div>
    </section>
  );
}
