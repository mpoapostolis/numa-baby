import { useMemo, useState } from "react";
import { ExternalLink, PhoneCall, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";
import { EmptyState } from "../components/EmptyState";
import { GrowthChart } from "../components/GrowthChart";
import { LittleBottle } from "../components/illustrations";
import { activityTitle } from "../domain/activityDisplay";
import { formatShortDay, formatTime, humanDuration, median } from "../domain/time";
import { track } from "../domain/analytics";
import { Insight, buildInsightInput, insightsFor } from "../domain/insightRules";
import { guidanceFor } from "../domain/intakeGuide";
import { buildVisitSummary } from "../domain/visitSummary";
import { VisitSummarySheet } from "../components/VisitSummarySheet";
import { Button } from "../components/ui/button";
import { AAP_FORMULA_AMOUNT, NHS_ENOUGH_MILK } from "../domain/sources";
import { Activity, FeedingMode, Profile } from "../domain/types";
import { ActivityStats } from "../hooks/useActivityStats";

type InsightsScreenProps = {
  stats: ActivityStats;
  // The rules engine is derived here rather than in App so it rides this
  // screen's lazy chunk — Today must not pay for advice it never shows.
  activities: Activity[];
  profile: Profile;
  ageDays: number | null;
  feedingMode: FeedingMode;
  minuteClock: number;
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
            <a key={source.url} className="fact-source" href={source.url} onClick={() => track("source_opened", { name: source.name })} target="_blank" rel="noopener noreferrer">
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

export default function InsightsScreen({
  stats,
  activities,
  profile,
  ageDays,
  feedingMode,
  minuteClock,
  onAddGrowth,
  onOpenGuide,
}: InsightsScreenProps) {
  // Milk against this baby's own weight, rather than a stranger's average.
  const intake = useMemo(() => {
    const bottleDays = stats.recentDays.filter((day) => day.ml > 0);
    return guidanceFor(
      stats.latestGrowth?.weightGrams,
      median(bottleDays.map((day) => day.ml)),
      bottleDays.length,
      feedingMode,
    );
  }, [stats.recentDays, stats.latestGrowth, feedingMode]);

  const [visitOpen, setVisitOpen] = useState(false);
  const visit = useMemo(
    () => buildVisitSummary(activities, minuteClock, 14),
    [activities, minuteClock],
  );

  const insights = useMemo(
    () => insightsFor(buildInsightInput({
      activities,
      recentDays: stats.recentDays,
      ageDays,
      ageMonths: stats.babyAgeMonths,
      feedingMode,
      now: minuteClock,
    })),
    [activities, stats.recentDays, stats.babyAgeMonths, ageDays, feedingMode, minuteClock],
  );
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
  // "a, b and c" — an Oxford-comma-free list, because this is a sentence a
  // person reads, not a data dump.
  const listOf = (items: string[]) =>
    items.length <= 1 ? items[0] : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
  // Fresh install: with nothing in any tile, the strip would lead with four
  // dashes — skip it and let the rhythm card's EmptyState lead instead.
  const hasSummaryData = Boolean(
    typicalGap || averageFeeds || bottleMlToday > 0 || latestGrowth?.weightGrams,
  );

  // Partial data keeps the full four-tile grid (per-tile hiding causes daily
  // layout shift); each dash is decorative with an SR explanation. But three
  // dashes beside one number reads as a broken screen rather than a young one,
  // so when any tile is waiting the strip says what it is waiting FOR.
  const waitingFor = [
    typicalGap ? null : "a few more feeds",
    averageFeeds ? null : "a day or two",
    bottleMlToday > 0 ? null : "a bottle today",
    latestGrowth?.weightGrams ? null : "a weight",
  ].filter(Boolean) as string[];

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
      {/* One page a parent can hand across a desk. Placed first because the
          appointment is the moment all of this stops being a hobby. */}
      {visit.loggedDays > 0 && (
        <Button variant="outline" className="visit-open" onClick={() => setVisitOpen(true)}>
          <Stethoscope size={16} aria-hidden="true" />
          Summary for the paediatrician
        </Button>
      )}

      <VisitSummarySheet
        open={visitOpen}
        onOpenChange={setVisitOpen}
        summary={visit}
        profile={profile}
        ageMonths={stats.babyAgeMonths}
        now={minuteClock}
      />

      {intake && (
        <figure className="chart-card intake-card">
          <figcaption>
            <p className="t-label">Milk against weight</p>
            <h2>
              {/* Past ~6.4 kg both ends of the 150-200 ml/kg rule hit the
                  daily ceiling and the range IS a single number. "960-960 ml"
                  is a bug wearing the voice of guidance; "about 960 ml" is
                  what the source actually says there. */}
              At {intake.weightKg.toFixed(2)} kg, the usual guide is about{" "}
              {intake.lowMl === intake.highMl
                ? `${intake.highMl} ml a day at most.`
                : `${intake.lowMl}–${intake.highMl} ml a day.`}
            </h2>
          </figcaption>

          {/* The band is the subject; the marker is where these days sit. No
              target line, no colour that says pass or fail. */}
          <div
            className="intake-bar"
            role="img"
            aria-label={`${
              intake.lowMl === intake.highMl
                ? `Reference ceiling ${intake.highMl} millilitres a day`
                : `Reference band ${intake.lowMl} to ${intake.highMl} millilitres a day`
            }. Your typical day is ${intake.typicalMl} millilitres, which is ${intake.position} the band.`}
          >
            {(() => {
              const span = Math.max(intake.highMl * 1.35, intake.typicalMl * 1.15);
              const at = (value: number) => `${Math.min(100, (value / span) * 100)}%`;
              return (
                <>
                  {/* A collapsed band leaves 2px of borders — thinner than
                      the marker beside it. Once the ends meet it is drawn as
                      a deliberate cap mark instead. */}
                  <div
                    className={intake.lowMl === intake.highMl ? "intake-band intake-cap" : "intake-band"}
                    style={intake.lowMl === intake.highMl
                      ? { left: `calc(${at(intake.highMl)} - 6px)`, width: "12px" }
                      : { left: at(intake.lowMl), width: `calc(${at(intake.highMl)} - ${at(intake.lowMl)})` }}
                  />
                  <span className="intake-marker" style={{ left: at(intake.typicalMl) }} />
                </>
              );
            })()}
          </div>

          <p className="intake-reading">
            <strong className="figure">{intake.typicalMl}<span className="unit">ml</span></strong>
            <span> is your typical day — {intake.position === "within"
              ? "inside that range"
              : intake.position === "below" ? "below it" : "above it"}.</span>
          </p>

          <p className="intake-caveat">
            {intake.cappedByCeiling
              ? "Capped at the 960 ml a day AAP gives as the usual maximum, whatever the weight suggests. "
              : ""}
            This counts bottles only, so any nursing sits outside it. Babies feed to appetite and
            a range is not a target — bring the number to your paediatrician rather than to a
            calculator.
          </p>

          <p className="figure-source">
            <a className="fact-source" href={AAP_FORMULA_AMOUNT.url} target="_blank" rel="noopener noreferrer"
               onClick={() => track("source_opened", { name: AAP_FORMULA_AMOUNT.name })}>
              {AAP_FORMULA_AMOUNT.name} <ExternalLink size={12} aria-hidden="true" />
            </a>
            <a className="fact-source" href={NHS_ENOUGH_MILK.url} target="_blank" rel="noopener noreferrer"
               onClick={() => track("source_opened", { name: NHS_ENOUGH_MILK.name })}>
              {NHS_ENOUGH_MILK.name} <ExternalLink size={12} aria-hidden="true" />
            </a>
          </p>
        </figure>
      )}

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

      {hasSummaryData && waitingFor.length > 0 && (
        <p className="insight-waiting">
          The dashes fill in on their own — they are waiting on {listOf(waitingFor)}.
        </p>
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
