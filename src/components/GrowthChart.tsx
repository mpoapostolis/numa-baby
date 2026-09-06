import { Plus } from "lucide-react";
import { Button } from "./ui/button";
import { EmptyState } from "./EmptyState";
import { SproutChart } from "./illustrations";
import { Activity } from "../domain/types";
import { formatLength, formatWeight, useUnits, weightParts } from "../domain/units";
import { currentLocale, t } from "../i18n";

// Lazy, keyed by nothing: called at render, after initLocale has decided the
// locale — a module-level Intl const would freeze every date into English.
const chartDateFormat = () => new Intl.DateTimeFormat(currentLocale(), { month: "short", day: "numeric" });
const tableDateFormat = () => new Intl.DateTimeFormat(currentLocale(), { dateStyle: "medium" });

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
  const units = useUnits();
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
    ? t("Measurements over time")
    : activities.length < 2
      ? t("{weight} at the first check.", { weight: formatWeight(latest.weightGrams ?? 0, units) })
      : change > 0
        ? t("Up {n} g since the last check.", { n: change })
        : change < 0
          ? t("Down {n} g since the last check.", { n: Math.abs(change) })
          : t("Steady since the last check.");

  return (
    <figure className="chart-card growth-card insight-figure">
      <figcaption>
        <div>
          <p className="t-label">{t("Fig. {n} · Growth", { n: figure })}</p>
          <h2>{takeaway}</h2>
        </div>
        <Button variant="outline" onClick={onAdd}><Plus size={15} /> {t("Add measurement")}</Button>
      </figcaption>

      {!visible.length ? (
        <EmptyState
          illustration={<SproutChart size={96} />}
          text={t("Your baby’s weight trend will appear after the first measurement.")}
        />
      ) : (
        <>
          <div className="growth-overview">
            <div>
              <span>{t("Latest")}</span>
              <strong>{formatWeight(latest.weightGrams ?? 0, units)}</strong>
            </div>
            <div>
              <span>{t("Since last check")}</span>
              <strong className={change < 0 ? "is-negative" : ""}>
                {activities.length < 2 ? t("First check") : `${change > 0 ? "+" : ""}${change} g`}
              </strong>
            </div>
            <div>
              <span>{t("Length / head")}</span>
              <strong>{latest.lengthCm ? formatLength(latest.lengthCm, units) : "—"} / {latest.headCm ? formatLength(latest.headCm, units) : "—"}</strong>
            </div>
          </div>
          <div className="growth-line-chart">
            <svg viewBox="0 0 640 180" role="img" aria-labelledby="growth-chart-title growth-chart-description">
              <title id="growth-chart-title">{t("Recent weight measurements")}</title>
              <desc id="growth-chart-description">{t("A date-proportional line from {low} to {high} {unit}.", { low: weightParts(minimum, units).value, high: weightParts(maximum, units).value, unit: weightParts(maximum, units).unit })}</desc>
              <line className="growth-gridline" x1="32" x2="608" y1="150" y2="150" />
              {points.length > 1 && <polyline className="growth-line" points={points.map((point) => `${point.x},${point.y}`).join(" ")} />}
              {points.map(({ activity, weight, x, y }) => (
                <g key={activity.id}>
                  <circle className="growth-point" cx={x} cy={y} r="7" />
                  <text className="growth-value" x={x} y={Math.max(18, y - 14)} textAnchor="middle">{weightParts(weight, units).value}</text>
                  <text className="growth-date" x={x} y="173" textAnchor="middle">{chartDateFormat().format(new Date(activity.startedAt))}</text>
                </g>
              ))}
            </svg>
          </div>
          <table className="sr-only">
            <caption>{t("Recent weight measurements")}</caption>
            <thead><tr><th>{t("Date")}</th><th>{t("Weight")}</th><th>{t("Length")}</th><th>{t("Head")}</th></tr></thead>
            <tbody>
              {visible.map((activity) => (
                <tr key={activity.id}>
                  <td>{tableDateFormat().format(new Date(activity.startedAt))}</td>
                  <td>{activity.weightGrams ? formatWeight(activity.weightGrams, units) : t("Not logged")}</td>
                  <td>{activity.lengthCm ? formatLength(activity.lengthCm, units) : t("Not logged")}</td>
                  <td>{activity.headCm ? formatLength(activity.headCm, units) : t("Not logged")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="figure-source">
            {activities.length === 1 ? t("From 1 logged measurement · on this device") : t("From {n} logged measurements · on this device", { n: activities.length })}
          </p>
        </>
      )}
      <p className="growth-note">{t("Trends are useful context for your paediatrician. A single measurement is not a diagnosis.")}</p>
      <button type="button" className="guide-entry" onClick={onOpenGuide}>{t("What’s typical at this age?")}</button>
    </figure>
  );
}
