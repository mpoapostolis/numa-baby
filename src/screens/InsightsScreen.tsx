import { Clock, Milk, ShieldCheck } from "lucide-react";
import { Card } from "../components/ui/card";
import { GrowthChart } from "../components/GrowthChart";
import { activityTitle } from "../domain/activityDisplay";
import { formatShortDay, formatTime, humanDuration } from "../domain/time";
import { ActivityStats } from "../hooks/useActivityStats";

type InsightsScreenProps = {
  stats: ActivityStats;
  onAddGrowth: () => void;
};

export default function InsightsScreen({ stats, onAddGrowth }: InsightsScreenProps) {
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

  return (
    <section className="screen insights-screen" aria-labelledby="insights-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Last 7 days</p>
          <h1 id="insights-heading">Patterns, calmly</h1>
        </div>
      </div>

      <Card size="sm" className="insight-summary">
        <div><span>Typical feed gap</span><strong>{typicalGap ? humanDuration(typicalGap) : "—"}</strong></div>
        <div><span>Feeds / day</span><strong>{averageFeeds === null ? "—" : averageFeeds}</strong></div>
        <div><span>Today’s bottle</span><strong>{bottleMlToday} ml</strong></div>
        <div><span>Latest weight</span><strong>{latestGrowth?.weightGrams ? `${(latestGrowth.weightGrams / 1_000).toFixed(2)} kg` : "—"}</strong></div>
      </Card>

      {weekly.some((day) => day.ml > 0) && (
        <Card size="sm" className="chart-card">
          <div className="chart-title">
            <div><span>Bottle volume</span><strong>Daily total in ml</strong></div>
            <Milk size={19} />
          </div>
          <div className="bar-chart" aria-label="Bottle volume for the last seven days">
            {weekly.map((day) => (
              <div className="bar-column" key={day.date.toISOString()}>
                <span className="bar-value">{day.ml || ""}</span>
                <div className="bar-track">
                  <div className="bar-fill" style={{ height: day.ml > 0 ? `${Math.max(4, (day.ml / maxMl) * 100)}%` : "0%" }} />
                </div>
                <small>{formatShortDay(day.date)}</small>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card size="sm" className="chart-card rhythm-card">
        <div className="chart-title">
          <div><span>Feeding rhythm</span><strong>When feeds happened</strong></div>
          <Clock size={19} />
        </div>
        <div className="rhythm-axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
        <div className="rhythm-chart">
          {weekly.map((day) => (
            <div className="rhythm-row" key={day.date.toISOString()}>
              <small>{formatShortDay(day.date)}</small>
              <div className="rhythm-line">
                {day.feeds.map((feed) => {
                  const date = new Date(feed.startedAt);
                  const hour = date.getHours() + date.getMinutes() / 60;
                  return (
                    <span
                      className={`feed-dot ${feed.type === "nursing" ? "nursing-dot" : ""}`}
                      key={feed.id}
                      style={{ left: `${(hour / 24) * 100}%` }}
                      title={`${activityTitle(feed)} at ${formatTime(feed.startedAt)}`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <div className="chart-legend"><span><i /> Bottle</span><span><i className="nursing-key" /> Nursing</span></div>
      </Card>

      <GrowthChart activities={growthEntries} change={weightChange} onAdd={onAddGrowth} />

      <Card className="gentle-note">
        <ShieldCheck size={20} />
        <p><strong>Useful, not judgmental.</strong> Baby Tracker summarizes what you logged. It never scores your parenting or replaces medical advice.</p>
      </Card>
    </section>
  );
}
