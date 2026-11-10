// Ships with this lazy chunk, not the app shell — the budget rule.
import "../styles/screens/insights.css";
import { useMemo, useState } from "react";
import { ExternalLink, PhoneCall, Share2, ShieldCheck, Sparkles, Stethoscope } from "lucide-react";
import { toast } from "../lib/toast";
import { weekCard } from "../domain/shareCards";
import { shareLink } from "../domain/shareApp";
import { renderCard, shareImage } from "../lib/shareCard";
import { EmptyState } from "../components/EmptyState";
import { GrowthChart } from "../components/GrowthChart";
import { TrendChart, TrendGroup } from "../components/TrendChart";
import { LittleBottle } from "../components/illustrations";
import { activityTitle } from "../domain/activityDisplay";
import { DaySummary, hasRoutineCare, summarizeDays } from "../domain/daySummary";
import { InsightRange, averageDay, groupDays, rangeDayCount, rangeGrain, rememberRange, rememberedRange } from "../domain/insightRange";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group";
import { nursingSideAverage } from "../domain/nursingSides";
import { formatVolume, formatWeight, useUnits, volumeParts, weightParts } from "../domain/units";
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
import { currentLocale, t } from "../i18n";

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
        <span className="t-label insight-tone">{t(TONE_LABEL[insight.tone])}</span>
        <h3 className="insight-title">{t(insight.title, insight.vars)}</h3>
        <p className="insight-body">{t(insight.body, insight.vars)}</p>
        <p className="insight-advice">{t(insight.advice, insight.vars)}</p>
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
  if (hours === 0) return <>{mins}<span className="unit">{t("m")}</span></>;
  if (mins === 0) return <>{hours}<span className="unit">{t("h")}</span></>;
  return <>{hours}<span className="unit">{t("h")}</span> {mins}<span className="unit">{t("m")}</span></>;
}

// Lazy, like every formatter here: the locale is settled before the first
// render, not before this module runs.
let shortDateFormatter: Intl.DateTimeFormat | null = null;
let monthFormatter: Intl.DateTimeFormat | null = null;
const shortDate = (at: number) => (shortDateFormatter ??= new Intl.DateTimeFormat(currentLocale(), { month: "short", day: "numeric" })).format(at);
const monthName = (at: number) => (monthFormatter ??= new Intl.DateTimeFormat(currentLocale(), { month: "long" })).format(at);

/** The heading over everything the range governs. */
function rangeHeading(range: InsightRange) {
  if (range === "30d") return t("Last 30 days");
  if (range === "3m") return t("Last 3 months");
  if (range === "1y") return t("Last 12 months");
  return t("Last 7 days");
}

/** The range's days as bars, named for the readout: a day, a week, a month. */
function namedGroups(days: DaySummary[], range: InsightRange): TrendGroup[] {
  const grain = rangeGrain(range);
  return groupDays(days, grain).map((group) => {
    if (grain === "day") return { ...group, label: shortDate(group.at) };
    const name = grain === "week" ? t("week of {date}", { date: shortDate(group.at) }) : monthName(group.at);
    return {
      ...group,
      label: grain === "week" ? t("Week of {date}", { date: shortDate(group.at) }) : name,
      reading: `${t("a day")} · ${name}`,
      empty: `${t("Nothing logged")} · ${name}`,
    };
  });
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
  const units = useUnits();
  // How far back: the week unless this phone chose otherwise. The week keeps
  // the figures it always had; a longer range re-reads the same log.
  const [range, setRange] = useState<InsightRange>(rememberedRange);
  const rangeDays = useMemo(
    () => (range === "7d"
      ? stats.recentDays.slice(-7)
      : summarizeDays(stats.sortedActivities, new Date(minuteClock), rangeDayCount(range, minuteClock), minuteClock)),
    [range, stats.recentDays, stats.sortedActivities, minuteClock],
  );
  // Days before anything was logged are days the app was not in use, not
  // empty days: the charts start where the record does.
  const firstLogged = rangeDays.findIndex(hasRoutineCare);
  const recordDays = firstLogged <= 0 ? rangeDays : rangeDays.slice(firstLogged);
  // Milk against this baby's own weight, rather than a stranger's average.
  // Complete days only: this morning's two bottles are not a typical day.
  const intake = useMemo(() => {
    const bottleDays = stats.recentDays.filter((day) => !day.isToday && day.ml > 0);
    return guidanceFor(
      stats.latestGrowth?.weightGrams,
      median(bottleDays.map((day) => day.ml)),
      bottleDays.length,
      feedingMode,
    );
  }, [stats.recentDays, stats.latestGrowth, feedingMode]);

  const [visitOpen, setVisitOpen] = useState(false);
  // Five-minute granularity for the two heavy derivations: the rules speak
  // in hours ("no feed for six hours"), so a few minutes of lag is invisible
  // and the recompute drops from sixty an hour to twelve.
  const insightClock = minuteClock - (minuteClock % (5 * 60_000));
  const visit = useMemo(
    () => buildVisitSummary(activities, insightClock, 14),
    [activities, insightClock],
  );

  const insights = useMemo(
    () => insightsFor(buildInsightInput({
      activities,
      recentDays: stats.recentDays,
      ageDays,
      ageMonths: stats.babyAgeMonths,
      feedingMode,
      now: insightClock,
      units,
    })),
    [activities, stats.recentDays, stats.babyAgeMonths, ageDays, feedingMode, insightClock, units],
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
  const sides = nursingSideAverage(rangeDays);
  // Feeds a day over the range, by the same rule as the week's.
  const rangeFeeds = range === "7d" ? averageFeeds : averageDay(rangeDays, (day) => day.feeds);
  const shownFeeds = rangeFeeds === null ? null : Math.round(rangeFeeds * 10) / 10;
  const weekFeeds = weekly.reduce((sum, day) => sum + day.feeds.length, 0);
  const weekBottles = weekly.reduce(
    (sum, day) => sum + day.feeds.filter((feed) => feed.type === "bottle").length,
    0,
  );
  const todayIndex = weekly.length - 1;
  // Today is half-lived: its morning bottles counted as a whole day drag
  // "most days" down. It counts only while it is the only bottle day.
  const bottleDays = weekly.filter((day) => day.ml > 0);
  const completeBottleDays = bottleDays.filter((day) => day !== weekly[todayIndex]);
  const weekMedianMl = median((completeBottleDays.length > 0 ? completeBottleDays : bottleDays).map((day) => day.ml));
  // A longer range: a bar per day (30 days), or the average bottle day of
  // each week or month — over the days that had bottles, so a nursing-only
  // day is not a day of zero millilitres.
  const isWeek = range === "7d";
  const bottleBars = isWeek ? [] : namedGroups(recordDays, range).map((group) => ({
    ...group,
    ml: Math.round(averageDay(group.days, (day) => day.ml, (day) => day.ml > 0) ?? 0),
  }));
  const rangeBottleDays = rangeDays.filter((day) => day.ml > 0);
  const rangeCompleteBottleDays = rangeBottleDays.filter((day) => !day.isToday);
  const medianMl = isWeek ? weekMedianMl : median((rangeCompleteBottleDays.length > 0 ? rangeCompleteBottleDays : rangeBottleDays).map((day) => day.ml));
  const showRangeBottles = !isWeek && rangeBottleDays.length > 0;
  // Whether a bottle figure is on screen, for the numbering of the others.
  const bottleFigure = isWeek ? showBottles : showRangeBottles;
  const rangeMaxMl = Math.max(...bottleBars.map((bar) => bar.ml), 1);
  const rangeBottles = rangeDays.reduce((sum, day) => sum + day.bottles, 0);
  // "a, b and c" — an Oxford-comma-free list, because this is a sentence a
  // person reads, not a data dump.
  const listOf = (items: string[]) =>
    items.length <= 1 ? items[0] : `${items.slice(0, -1).join(", ")} ${t("and")} ${items[items.length - 1]}`;
  // Fresh install: with nothing in any tile, the strip would lead with four
  // dashes — skip it and let the rhythm card's EmptyState lead instead.
  const hasSummaryData = Boolean(
    typicalGap || shownFeeds || bottleMlToday > 0 || latestGrowth?.weightGrams,
  );

  // Partial data keeps the full four-tile grid (per-tile hiding causes daily
  // layout shift); each dash is decorative with an SR explanation. But three
  // dashes beside one number reads as a broken screen rather than a young one,
  // so when any tile is waiting the strip says what it is waiting FOR.
  const waitingFor = [
    typicalGap ? null : t("a few more feeds"),
    shownFeeds ? null : t("a day or two"),
    // A breastfeeding-only family will rightly never log a bottle — promising
    // that dash "fills in on its own" would be a promise broken daily.
    bottleMlToday > 0 || feedingMode === "breast" ? null : t("a bottle today"),
    latestGrowth?.weightGrams ? null : t("a weight"),
  ].filter(Boolean) as string[];

  const emptyTile = (
    <strong className="t-numeral is-empty">
      <span aria-hidden="true">—</span>
      <span className="sr-only">{t("No data yet")}</span>
    </strong>
  );

  return (
    <section className="screen insights-screen" aria-labelledby="insights-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{rangeHeading(range)}</p>
          <h1 id="insights-heading">{t("What the log is telling you")}</h1>
        </div>
      </div>

      {/* Asked for from the feedback box: "the option of customizing it,
          like 7 days, 1 month, year". */}
      <ToggleGroup
        type="single"
        value={range}
        className="segmented range-picker"
        aria-label={t("Show the last")}
        onValueChange={(value) => {
          if (!value) return;
          track("insights_range_changed", { range: value });
          setRange(value as InsightRange);
          rememberRange(value as InsightRange);
        }}
      >
        <ToggleGroupItem value="7d">{t("7 days")}</ToggleGroupItem>
        <ToggleGroupItem value="30d">{t("30 days")}</ToggleGroupItem>
        <ToggleGroupItem value="3m">{t("3 months")}</ToggleGroupItem>
        <ToggleGroupItem value="1y">{t("Year")}</ToggleGroupItem>
      </ToggleGroup>

      {/* The answer first, the evidence below it. Cards only appear when the
          log can support them honestly — silence here is a good sign, not a
          missing feature. */}
      {/* One page a parent can hand across a desk. Placed first because the
          appointment is the moment all of this stops being a hobby. */}
      {visit.loggedDays > 0 && (
        <div className="insight-actions">
          <Button variant="outline" className="visit-open" onClick={() => setVisitOpen(true)}>
            <Stethoscope size={16} aria-hidden="true" />
            {t("Summary for the paediatrician")}
          </Button>
          {/* The week as a picture for the grandparents' group chat — the
              numbers a parent is quietly proud of, with the app's name on it. */}
          {hasSummaryData && (
            <Button
              variant="outline"
              className="week-share"
              onClick={() => {
                track("week_shared");
                void renderCard(weekCard(profile.name, weekly, units))
                  .then((blob) => shareImage(blob, "numalog-week.png", t("{name}’s week · {link}", { name: profile.name.trim() || t("Baby"), link: shareLink("week") })))
                  .then((outcome) => { if (outcome === "saved") toast(t("Card saved to your device")); })
                  .catch(() => toast(t("Could not make the card on this phone")));
              }}
            >
              <Share2 size={16} aria-hidden="true" />
              {t("Share this week")}
            </Button>
          )}
        </div>
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
            <p className="t-label">{t("Milk against weight")}</p>
            <h2>
              {/* Past ~6.4 kg both ends of the 150-200 ml/kg rule hit the
                  daily ceiling and the range IS a single number. "960-960 ml"
                  is a bug wearing the voice of guidance; "about 960 ml" is
                  what the source actually says there. */}
              {intake.lowMl === intake.highMl
                ? t("At {weight}, the usual guide is about {vol} a day at most.", { weight: formatWeight(intake.weightKg * 1_000, units), vol: formatVolume(intake.highMl, units) })
                : t("At {weight}, the usual guide is about {range} a day.", { weight: formatWeight(intake.weightKg * 1_000, units), range: units === "metric" ? `${intake.lowMl}–${intake.highMl} ml` : `${volumeParts(intake.lowMl, units).value}–${formatVolume(intake.highMl, units)}` })}
            </h2>
          </figcaption>

          {/* The band is the subject; the marker is where these days sit. No
              target line, no colour that says pass or fail. */}
          <div
            className="intake-bar"
            role="img"
            aria-label={t("{ref}. Your typical day is {vol}, {where} the band.", {
              ref: intake.lowMl === intake.highMl
                ? t("Reference ceiling {vol} a day", { vol: formatVolume(intake.highMl, units) })
                : t("Reference band {low} to {high} a day", { low: formatVolume(intake.lowMl, units), high: formatVolume(intake.highMl, units) }),
              vol: formatVolume(intake.typicalMl, units),
              where: intake.position === "within" ? t("which is within") : intake.position === "below" ? t("which is below") : t("which is above"),
            })}
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
            <strong className="figure">{volumeParts(intake.typicalMl, units).value}<span className="unit">{volumeParts(intake.typicalMl, units).unit}</span></strong>
            <span> {t("is your typical day — {where}.", { where: intake.position === "within"
              ? t("inside that range")
              : intake.position === "below" ? t("below it") : t("above it") })}</span>
          </p>

          <p className="intake-caveat">
            {intake.cappedByCeiling
              ? `${t("Capped at the {vol} a day AAP gives as the usual maximum, whatever the weight suggests.", { vol: formatVolume(960, units) })} `
              : ""}
            {t("This counts bottles only, so any nursing sits outside it. Babies feed to appetite and a range is not a target — bring the number to your paediatrician rather than to a calculator.")}
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
        <ul className="insight-deck" aria-label={t("What your entries suggest")}>
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
            <span className="t-label">{t("Typical feed gap")}</span>
          </div>
          <div>
            {shownFeeds ? (
              <strong className="t-numeral">{shownFeeds.toFixed(1)}</strong>
            ) : (
              emptyTile
            )}
            <span className="t-label">{t("Feeds / day")}</span>
          </div>
          <div>
            {bottleMlToday > 0 ? (
              <strong className="t-numeral figure">{volumeParts(bottleMlToday, units).value} <span className="unit">{volumeParts(bottleMlToday, units).unit}</span></strong>
            ) : (
              emptyTile
            )}
            <span className="t-label">{t("Bottle total today")}</span>
          </div>
          <div>
            {latestGrowth?.weightGrams ? (
              <strong className="t-numeral figure">
                {weightParts(latestGrowth.weightGrams, units).value}{" "}
                <span className="unit">{weightParts(latestGrowth.weightGrams, units).unit}</span>
              </strong>
            ) : (
              emptyTile
            )}
            <span className="t-label">{t("Latest weight")}</span>
          </div>
        </div>
      )}

      {hasSummaryData && waitingFor.length > 0 && (
        <p className="insight-waiting">
          {t("The dashes fill in on their own — they are waiting on {list}.", { list: listOf(waitingFor) })}
        </p>
      )}

      {/* Asked for from the feedback box: "add which category I want to
          track in the insights page, for example, sleep". The same chart as
          Today's, and the same remembered choice — pick Sleep on either and
          both open on Sleep. Shown once there are two days to compare. */}
      {rangeDays.filter(hasRoutineCare).length > 1 && (
        isWeek
          ? <TrendChart days={rangeDays} />
          : <TrendChart
              days={rangeDays}
              groups={(days) => namedGroups(days, range)}
              title={range === "30d" ? undefined : rangeHeading(range)}
            />
      )}

      {/* Asked for from the feedback box: "a statistic of how long she
          nurses on the right and on the left each day". The Timeline shows
          each day; this is the usual day. The bar is the split, so a side
          that is getting less is visible before anyone reads a number. */}
      {sides && sides.left + sides.right > 0 && (
        <figure className="chart-card insight-figure side-card">
          <figcaption>
            <div>
              <p className="t-label">{t("Nursing by side")}</p>
              <h2>{t("About {left} on the left and {right} on the right a day.", { left: humanDuration(sides.left), right: humanDuration(sides.right) })}</h2>
            </div>
          </figcaption>
          <div className="side-bar" aria-hidden="true">
            {sides.left > 0 && <span className="side-left" style={{ flexGrow: sides.left }}>{t("Left")}</span>}
            {sides.right > 0 && <span className="side-right" style={{ flexGrow: sides.right }}>{t("Right")}</span>}
          </div>
          <p className="side-note">
            {isWeek
              ? sides.days === 1 ? t("From the one day with nursing this week.") : t("An average of the {n} days with nursing this week.", { n: sides.days })
              : sides.days === 1 ? t("From the one day with nursing.") : t("An average of the {n} days with nursing.", { n: sides.days })}
            {sides.both > 0 && ` ${t("Sessions on both sides add {both} a day, not split between them.", { both: humanDuration(sides.both) })}`}
          </p>
        </figure>
      )}

      {isWeek && showBottles && (
        <figure className="chart-card insight-figure">
          <figcaption>
            <div>
              <p className="t-label">{t("Fig. 1 · Bottle volume")}</p>
              <h2>{t("Most bottle days total about {vol}.", { vol: formatVolume(medianMl, units) })}</h2>
            </div>
          </figcaption>
          <div
            className="bar-chart"
            role="img"
            aria-label={t("Bottle volume for the last seven days. Most bottle days total about {vol}. {days}.", {
              vol: formatVolume(medianMl, units),
              days: weekly.map((day) => `${formatShortDay(day.date)}: ${formatVolume(day.ml, units)}`).join(", "),
            })}
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
                      {volumeParts(day.ml, units).value}
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
            {weekBottles === 1 ? t("From 1 logged bottle · on this device") : t("From {n} logged bottles · on this device", { n: weekBottles })}
          </p>
        </figure>
      )}

      {/* The same figure over a longer range: too many bars for a number
          on each, so the readout is the headline, the median line, and the
          list a screen reader hears. */}
      {showRangeBottles && (
        <figure className="chart-card insight-figure">
          <figcaption>
            <div>
              <p className="t-label">{t("Fig. 1 · Bottle volume")}</p>
              <h2>{t("Most bottle days total about {vol}.", { vol: formatVolume(medianMl, units) })}</h2>
            </div>
          </figcaption>
          <div
            className="bar-chart is-dense"
            role="img"
            aria-label={t("Bottle volume, {range}. Most bottle days total about {vol}. {days}.", {
              range: rangeHeading(range),
              vol: formatVolume(medianMl, units),
              days: bottleBars.map((bar) => `${bar.label}: ${formatVolume(bar.ml, units)}`).join(", "),
            })}
          >
            <div className="bar-plot" style={{ gridTemplateColumns: `repeat(${bottleBars.length}, minmax(0, 1fr))` }} aria-hidden="true">
              <div className="bar-median" style={{ bottom: `${(medianMl / rangeMaxMl) * 100}%` }} />
              {bottleBars.map((bar, index) => (
                <div className="bar-column" key={bar.at}>
                  <div
                    className={index === bottleBars.length - 1 ? "bar-fill is-today" : "bar-fill"}
                    style={{ height: `${(bar.ml / rangeMaxMl) * 100}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="bar-ends" aria-hidden="true">
              <span>{bottleBars[0]?.label}</span>
              <span>{t("Today")}</span>
            </div>
          </div>
          <p className="figure-source">
            {range !== "30d" && `${t("Each bar is the average bottle day.")} `}
            {rangeBottles === 1 ? t("From 1 logged bottle · on this device") : t("From {n} logged bottles · on this device", { n: rangeBottles })}
          </p>
        </figure>
      )}

      <figure className={`chart-card rhythm-card insight-figure${bottleFigure ? "" : " is-solo"}`}>
        <figcaption>
          <div>
            <p className="t-label">
              {t("Fig. {n} · Feeding rhythm", { n: bottleFigure ? 2 : 1 })}
              {/* Each day's feeds on a line: a week of rows, whatever the range. */}
              {!isWeek && ` · ${t("Last 7 days")}`}
            </p>
            <h2>
              {typicalGap
                ? t("Feeds usually arrive about {gap} apart.", { gap: humanDuration(typicalGap) })
                : t("Each day’s feeds on a 24-hour line.")}
            </h2>
          </div>
        </figcaption>
        {weekFeeds === 0 ? (
          <EmptyState
            illustration={<LittleBottle size={80} />}
            text={t("No feeds logged yet — the week’s rhythm will draw itself here.")}
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
                    ? t("{day}: no feeds logged", { day: formatShortDay(day.date) })
                    : `${formatShortDay(day.date)}: ${day.feeds
                        .map((feed) => t("{what} at {time}", { what: activityTitle(feed), time: formatTime(feed.startedAt) }))
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
                        title={t("{what} at {time}", { what: activityTitle(feed), time: formatTime(feed.startedAt) })}
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
          <div className="chart-legend"><span><i /> {t("Bottle")}</span><span><i className="nursing-key" /> {t("Nursing")}</span></div>
        )}
        {weekFeeds > 0 && (
          <p className="figure-source">
            {weekFeeds === 1 ? t("From 1 logged feed · on this device") : t("From {n} logged feeds · on this device", { n: weekFeeds })}
          </p>
        )}
      </figure>

      <GrowthChart
        activities={growthEntries}
        change={weightChange}
        figure={bottleFigure ? 3 : 2}
        onAdd={onAddGrowth}
        onOpenGuide={onOpenGuide}
      />

      <div className="gentle-note">
        <ShieldCheck size={20} />
        <p><strong>{t("Useful, not judgmental.")}</strong> {t("Numalog summarizes what you logged. It never scores your parenting or replaces medical advice.")}</p>
      </div>
    </section>
  );
}
