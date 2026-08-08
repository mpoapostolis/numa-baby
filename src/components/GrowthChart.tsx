import { Plus } from "lucide-react";
import { Button } from "./ui/button";
import { EmptyState } from "./EmptyState";
import { SproutChart } from "./illustrations";
import { Activity } from "../domain/types";

// Hoisted like the formatters in domain/time.ts — constructing Intl per point
// per render is the expensive path the extraction was meant to remove.
const chartDateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const tableDateFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export function GrowthChart({
  activities,
  change,
  figure,
  onAdd,
  onOpenGuide,
}: {
  activities: Activity[];
  change: number;
  figure: number;
  onAdd: () => void;
  onOpenGuide: () => void;
}) {
  const visible = activities.slice(-7);
  const weights = visible.map((activity) => activity.weightGrams ?? 0);
  const minimum = weights.length ? Math.min(...weights) : 0;
  const maximum = weights.length ? Math.max(...weights) : 1;
  const range = Math.max(100, maximum - minimum);
  const latest = visible[visible.length - 1];
  const firstTime = visible.length ? new Date(visible[0].startedAt).getTime() : 0;
  const lastTime = visible.length ? new Date(visible[visible.length - 1].startedAt).getTime() : 1;
  const timeRange = Math.max(1, lastTime - firstTime);
  const points = visible.map((activity) => {
    const weight = activity.weightGrams ?? 0;
    const x = 32 + ((new Date(activity.startedAt).getTime() - firstTime) / timeRange) * 576;
    const y = 150 - ((weight - minimum) / range) * 112;
    return { activity, weight, x, y };
  });

  const takeaway = !visible.length
    ? "Measurements over time"
    : activities.length < 2
      ? `${((latest.weightGrams ?? 0) / 1_000).toFixed(2)} kg at the first check.`
      : change > 0
        ? `Up ${change} g since the last check.`
        : change < 0
          ? `Down ${Math.abs(change)} g since the last check.`
          : "Steady since the last check.";

  return (
    <figure className="chart-card growth-card insight-figure">
      <figcaption>
        <div>
          <p className="t-label">Fig. {figure} · Growth</p>
          <h2>{takeaway}</h2>
        </div>
        <Button variant="outline" onClick={onAdd}><Plus size={15} /> Add measurement</Button>
      </figcaption>

      {!visible.length ? (
        <EmptyState
          illustration={<SproutChart size={96} />}
          text="Your baby’s weight trend will appear after the first measurement."
        />
      ) : (
        <>
          <div className="growth-overview">
            <div>
              <span>Latest</span>
              <strong>{((latest.weightGrams ?? 0) / 1_000).toFixed(2)} kg</strong>
            </div>
            <div>
              <span>Since last check</span>
              <strong className={change < 0 ? "is-negative" : ""}>
                {activities.length < 2 ? "First check" : `${change > 0 ? "+" : ""}${change} g`}
              </strong>
            </div>
            <div>
              <span>Length / head</span>
              <strong>{latest.lengthCm ? `${latest.lengthCm} cm` : "—"} / {latest.headCm ? `${latest.headCm} cm` : "—"}</strong>
            </div>
          </div>
          <div className="growth-line-chart">
            <svg viewBox="0 0 640 180" role="img" aria-labelledby="growth-chart-title growth-chart-description">
              <title id="growth-chart-title">Recent weight measurements</title>
              <desc id="growth-chart-description">A date-proportional line from {(minimum / 1_000).toFixed(2)} to {(maximum / 1_000).toFixed(2)} kilograms.</desc>
              <line className="growth-gridline" x1="32" x2="608" y1="150" y2="150" />
              {points.length > 1 && <polyline className="growth-line" points={points.map((point) => `${point.x},${point.y}`).join(" ")} />}
              {points.map(({ activity, weight, x, y }) => (
                <g key={activity.id}>
                  <circle className="growth-point" cx={x} cy={y} r="7" />
                  <text className="growth-value" x={x} y={Math.max(18, y - 14)} textAnchor="middle">{(weight / 1_000).toFixed(2)}</text>
                  <text className="growth-date" x={x} y="173" textAnchor="middle">{chartDateFormat.format(new Date(activity.startedAt))}</text>
                </g>
              ))}
            </svg>
          </div>
          <table className="sr-only">
            <caption>Recent weight measurements</caption>
            <thead><tr><th>Date</th><th>Weight</th><th>Length</th><th>Head</th></tr></thead>
            <tbody>
              {visible.map((activity) => (
                <tr key={activity.id}>
                  <td>{tableDateFormat.format(new Date(activity.startedAt))}</td>
                  <td>{activity.weightGrams} g</td>
                  <td>{activity.lengthCm ? `${activity.lengthCm} cm` : "Not logged"}</td>
                  <td>{activity.headCm ? `${activity.headCm} cm` : "Not logged"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="figure-source">
            From {activities.length} logged {activities.length === 1 ? "measurement" : "measurements"} · on this device
          </p>
        </>
      )}
      <p className="growth-note">Trends are useful context for your paediatrician. A single measurement is not a diagnosis.</p>
      <button type="button" className="guide-entry" onClick={onOpenGuide}>What’s typical at this age?</button>
    </figure>
  );
}
