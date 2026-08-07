import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { Button } from "../components/ui/button";
import { SproutChart } from "../components/illustrations";
import {
  MAX_REFERENCE_MONTHS,
  WEEKLY_GAIN_BANDS,
  WHO_WEIGHT_FOR_AGE,
  WeightPercentiles,
  expectedWeightRange,
} from "../domain/growthReference";
import { Activity, Profile } from "../domain/types";

// The guide never grades the baby: the range bar shows where the WHO band
// sits and places the latest logged weight as a neutral dot — no percentile
// verdict, no normal/abnormal wording. Interpretation stays with the
// paediatrician, which is exactly what the disclaimer card says first.

const latestDateFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

const kg = (value: number) => value.toFixed(1);

type GrowthGuideScreenProps = {
  profile: Profile;
  latestGrowth?: Activity;
  onBack?: () => void;
};

// Fractional age drives the interpolated band — a 24-day-old must not be
// shown the birth-day range, which parks a healthy weight at the P97 edge.
function fractionalAgeMonths(birthDate: string): number | null {
  const birth = new Date(`${birthDate}T12:00:00`);
  if (!Number.isFinite(birth.getTime())) return null;
  const days = Math.max(0, (Date.now() - birth.getTime()) / 86_400_000);
  return days / 30.4375;
}

function ageHeading(months: number) {
  if (months < 1) {
    const weeks = Math.floor((months * 30.4375) / 7);
    if (weeks < 1) return "In the first week";
    return weeks === 1 ? "At 1 week" : `At ${weeks} weeks`;
  }
  const whole = Math.floor(months);
  return whole === 1 ? "At 1 month" : `At ${whole} months`;
}

// P3–P97 as a horizontal band on a hairline, P50 as a tick, the baby's latest
// weight as the only --signal element. Pure CSS on a padded linear scale.
function RangeBar({ range, weightKg }: { range: WeightPercentiles; weightKg?: number }) {
  const pad = Math.max(0.4, (range.p97 - range.p3) * 0.14);
  const lo = range.p3 - pad;
  const hi = range.p97 + pad;
  const at = (value: number) => `${Math.min(100, Math.max(0, ((value - lo) / (hi - lo)) * 100))}%`;
  const description = `Reference band from ${kg(range.p3)} to ${kg(range.p97)} kilograms, middle of the range ${kg(range.p50)} kilograms${
    weightKg === undefined ? "" : `. Latest logged weight ${weightKg.toFixed(2)} kilograms`
  }.`;
  return (
    <div className="range-bar" role="img" aria-label={description}>
      <div className="range-track">
        <div className="range-band" style={{ left: at(range.p3), width: `calc(${at(range.p97)} - ${at(range.p3)})` }} />
        <span className="range-median" style={{ left: at(range.p50) }} />
        {weightKg !== undefined && <span className="range-marker" style={{ left: at(weightKg) }} />}
      </div>
      <div className="range-scale">
        <span style={{ left: at(range.p3) }}><em>P3</em>{kg(range.p3)}</span>
        <span style={{ left: at(range.p50) }}><em>P50</em>{kg(range.p50)}</span>
        <span style={{ left: at(range.p97) }}><em>P97</em>{kg(range.p97)} kg</span>
      </div>
    </div>
  );
}

// Named sources — every figure on this screen traces to one of these.
const GUIDE_SOURCES = [
  {
    name: "WHO Child Growth Standards — weight-for-age",
    url: "https://www.who.int/tools/child-growth-standards/standards/weight-for-age",
    note: "The percentile tables behind the reference band (retrieved 7 Aug 2026).",
  },
  {
    name: "CDC — WHO growth chart data files",
    url: "https://www.cdc.gov/growthcharts/who-data-files.htm",
    note: "Independent republication used to cross-check every value.",
  },
  {
    name: "AAP · HealthyChildren.org",
    url: "https://www.healthychildren.org/English/ages-stages/baby/Pages/default.aspx",
    note: "Typical newborn weight loss, regain and gain patterns.",
  },
  {
    name: "NHS — Your baby's weight and height",
    url: "https://www.nhs.uk/baby/babys-development/height-weight-and-reviews/baby-height-and-weight/",
    note: "Weighing guidance and when to talk to a professional.",
  },
];

export default function GrowthGuideScreen({ profile, latestGrowth, onBack }: GrowthGuideScreenProps) {
  const name = profile.name.trim() || "Baby";
  const exactAge = fractionalAgeMonths(profile.birthDate);
  const age = exactAge === null ? null : Math.min(exactAge, MAX_REFERENCE_MONTHS);
  const range = age === null ? null : expectedWeightRange(age, profile.sex);
  const latestKg = latestGrowth?.weightGrams ? latestGrowth.weightGrams / 1_000 : undefined;
  const tableMonths = WHO_WEIGHT_FOR_AGE.boys.map((row) => row.month);

  return (
    <section className="screen growth-guide-screen" aria-labelledby="growth-guide-heading">
      <div className="section-heading">
        <div>
          {onBack && (
            <Button variant="ghost" size="sm" className="guide-back" onClick={onBack}>
              <ArrowLeft size={16} /> Insights
            </Button>
          )}
          <p className="eyebrow">Reference ranges</p>
          <h1 id="growth-guide-heading">Growth guide</h1>
        </div>
      </div>

      <div className="surface-card guide-disclaimer">
        <ShieldCheck size={20} />
        <div>
          <h2 className="t-title-2">Context, not a diagnosis</h2>
          <p className="t-body">
            Indicative ranges from the WHO child growth standards. Babies grow in their own
            rhythm — your paediatrician’s assessment always comes first.
          </p>
        </div>
      </div>

      {age !== null && range !== null ? (
        <div className="surface-card guide-range-card">
          <span className="guide-range-art" aria-hidden="true"><SproutChart size={72} /></span>
          <p className="t-label">{ageHeading(age)}</p>
          <h2 className="guide-range-figure figure">
            {kg(range.p3)}–{kg(range.p97)}
            <span className="unit">kg</span>
          </h2>
          <p className="t-meta guide-range-sub">Typical weight range at this age (WHO P3–P97)</p>
          {exactAge !== null && exactAge > MAX_REFERENCE_MONTHS && (
            <p className="t-meta">The WHO table covers the first 24 months, shown here at 24 months.</p>
          )}
          <RangeBar range={range} weightKg={latestKg} />
          {latestGrowth && latestKg !== undefined && (
            <p className="guide-latest">
              <span className="guide-latest-dot" aria-hidden="true" />
              {name}’s latest: {latestKg.toFixed(2)} kg ({latestDateFormat.format(new Date(latestGrowth.startedAt))})
            </p>
          )}
          {!profile.sex && <p className="t-meta">Range shown covers girls and boys.</p>}
        </div>
      ) : (
        <div className="surface-card guide-range-card">
          <p className="t-label">By age, 0–24 months</p>
          <h2>Reference weights across the first two years.</h2>
          <div className="guide-table-scroll">
            <table className="guide-table">
              <thead>
                <tr><th scope="col">Age</th><th scope="col">P3</th><th scope="col">P50</th><th scope="col">P97</th></tr>
              </thead>
              <tbody>
                {tableMonths.map((month) => {
                  const row = expectedWeightRange(month, profile.sex);
                  return (
                    <tr key={month}>
                      <th scope="row">{month} mo</th>
                      <td>{kg(row.p3)}</td>
                      <td>{kg(row.p50)}</td>
                      <td>{kg(row.p97)} kg</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!profile.sex && <p className="t-meta">Range shown covers girls and boys.</p>}
          <p className="t-meta">Add a birth date in Settings to see the range for {name}’s exact age.</p>
        </div>
      )}

      <div className="surface-card guide-section">
        <p className="t-label">Typical pattern</p>
        <ul className="guide-rows">
          <li>
            <p>Many newborns lose some weight in the first days, then regain it — most are back to birth weight by two weeks, nearly all by three.</p>
            <span className="guide-authority">AAP · NHS</span>
          </li>
          {WEEKLY_GAIN_BANDS.map((band) => (
            <li key={band.fromMonth}>
              <p>
                {band.fromMonth === 0
                  ? "In the first month, roughly "
                  : `From ${band.fromMonth} to ${band.toMonth} months, roughly `}
                {band.minGramsPerWeek}–{band.maxGramsPerWeek} g a week is common.
              </p>
              <span className="guide-authority">{band.source}</span>
            </li>
          ))}
          <li>
            <p>Many babies double their birth weight around six months and triple it around one year. After eight months, gains slow — following their own curve matters more than any weekly number.</p>
            <span className="guide-authority">AAP</span>
          </li>
          <li>
            <p>Growth is usually fastest in the first six months, then gradually slows. A short illness can flatten gain for a couple of weeks — that usually settles on its own.</p>
            <span className="guide-authority">NHS</span>
          </li>
        </ul>
        <p className="t-meta">These are population averages, not targets. A baby tracking a lower centile gains less than one on a higher centile — steadiness is the point.</p>
      </div>

      <div className="surface-card guide-section">
        <p className="t-label">When to ask your paediatrician</p>
        <p className="t-body guide-intro">Trust your instincts — reach out whenever you’re unsure. These are the moments the guidance names for a check-in:</p>
        <ul className="guide-rows">
          <li>
            <p>Not back to birth weight by three weeks of age.</p>
            <span className="guide-authority">NHS · NICE</span>
          </li>
          <li>
            <p>At two weeks, still under birth weight or gaining less than about 150 g a week.</p>
            <span className="guide-authority">AAP</span>
          </li>
          <li>
            <p>After the first week, fewer than six wet nappies a day, or urine that is dark or specked with red.</p>
            <span className="guide-authority">AAP</span>
          </li>
          <li>
            <p>Weight drifting across more than one centile line on their chart, in either direction.</p>
            <span className="guide-authority">NHS</span>
          </li>
          <li>
            <p>Noticeably fewer wet nappies alongside irritability, unusual sleepiness or reduced feeding — seek care the same day.</p>
            <span className="guide-authority">NHS</span>
          </li>
        </ul>
      </div>

      <div className="surface-card guide-sources">
        <p className="t-label">Sources</p>
        <ul className="guide-source-list">
          {GUIDE_SOURCES.map((source) => (
            <li key={source.url}>
              <a href={source.url} target="_blank" rel="noreferrer noopener">
                {source.name}
                <ExternalLink size={13} aria-hidden="true" />
              </a>
              <p className="t-meta">{source.note}</p>
            </li>
          ))}
        </ul>
      </div>

      <p className="figure-source">WHO Child Growth Standards · shown for context, not diagnosis · on this device</p>
    </section>
  );
}
