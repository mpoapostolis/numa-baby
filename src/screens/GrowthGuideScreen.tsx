// Ships with this chunk, not the app shell — same budget rule as handoff.css.
import "../styles/screens/growth-guide.css";
import { ArrowLeft, ExternalLink, PhoneCall, ShieldCheck } from "lucide-react";
import { Button } from "../components/ui/button";
import { ActivityGlyph } from "../components/ActivityGlyph";
import { SproutChart } from "../components/illustrations";
import { track } from "../domain/analytics";
import { gramsToLb, useUnits } from "../domain/units";
import { OutingChecklist } from "../components/OutingChecklist";
import { CareCard, WATCH_FOR, careForAge } from "../domain/careGuidance";
import { playForAge } from "../domain/playIdeas";
import { PlaySection } from "../components/PlaySection";
import { ageInDays } from "../domain/time";
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

// Number labels on the WHO band. The band's geometry stays in kilograms —
// proportions have no unit — only the printed numbers convert.
function useKgLabel() {
  const units = useUnits();
  return {
    units,
    kg: (value: number) => (units === "metric" ? value.toFixed(1) : gramsToLb(value * 1_000).toFixed(1)),
    unitWord: units === "metric" ? "kg" : "lb",
    longUnit: units === "metric" ? "kilograms" : "pounds",
  };
}

type GrowthGuideScreenProps = {
  profile: Profile;
  latestGrowth?: Activity;
  minuteClock: number;
  onBack?: () => void;
};

// Each care card wears the pigment of the thing it is about, so the four read
// as one row of the same family the log rows already use.
const CARE_GLYPH = {
  feeding: "bottle",
  nappies: "diaper",
  activity: "growth",
  comfort: "burp",
} as const;

function CareCardView({ card }: { card: CareCard }) {
  const glyph = CARE_GLYPH[card.kind];
  return (
    <li className="care-card">
      <span className={`activity-glyph glyph-${glyph}`} aria-hidden="true">
        <ActivityGlyph type={glyph} />
      </span>
      <div className="care-copy">
        <h3 className="care-title">{card.title}</h3>
        <p className="care-body">{card.body}</p>
        <p className="care-action">{card.action}</p>
        <a className="fact-source" onClick={() => track("source_opened", { name: card.source.name })} href={card.source.url} target="_blank" rel="noopener noreferrer">
          {card.source.name} <ExternalLink size={12} aria-hidden="true" />
        </a>
      </div>
    </li>
  );
}

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
  const { kg, unitWord, longUnit } = useKgLabel();
  const pad = Math.max(0.4, (range.p97 - range.p3) * 0.14);
  const lo = range.p3 - pad;
  const hi = range.p97 + pad;
  const at = (value: number) => `${Math.min(100, Math.max(0, ((value - lo) / (hi - lo)) * 100))}%`;
  const description = `Reference band from ${kg(range.p3)} to ${kg(range.p97)} ${longUnit}, middle of the range ${kg(range.p50)} ${longUnit}${
    weightKg === undefined ? "" : `. Latest logged weight ${kg(weightKg)} ${longUnit}`
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
        <span style={{ left: at(range.p97) }}><em>P97</em>{kg(range.p97)} {unitWord}</span>
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
  {
    name: "CDC — Learn the Signs. Act Early.",
    url: "https://www.cdc.gov/act-early/milestones/index.html",
    note: "Milestone pages behind several Play & development cards — each card also links its exact page.",
  },
  {
    name: "NHS — Baby play and learning",
    url: "https://www.nhs.uk/baby/babys-development/play-and-learning/",
    note: "Play ideas and learning-to-talk guidance behind the early Play & development cards.",
  },
];

export default function GrowthGuideScreen({
  profile,
  latestGrowth,
  minuteClock,
  onBack,
}: GrowthGuideScreenProps) {
  const { kg, unitWord } = useKgLabel();
  const name = profile.name.trim() || "Baby";
  const careDays = ageInDays(profile.birthDate, minuteClock);
  const care = careDays === null ? null : careForAge(careDays);
  const play = careDays === null ? null : playForAge(careDays);
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
            <Button
              variant="ghost"
              size="sm"
              className="guide-back"
              aria-label="Back to Insights"
              onClick={onBack}
            >
              <ArrowLeft size={16} aria-hidden="true" /> Insights
            </Button>
          )}
          <p className="eyebrow">Care guide</p>
          <h1 id="growth-guide-heading">What to do today</h1>
        </div>
      </div>

      {care && (
        <section className="care-today" aria-labelledby="care-today-heading">
          <div className="care-heading">
            <h2 id="care-today-heading" className="t-title-2">{care.stage}</h2>
            <p className="t-meta">
              What is expected for {name} right now, and what to do about it. Every line links
              to the page it came from.
            </p>
          </div>
          <ul className="care-list">
            {care.cards.map((card) => <CareCardView key={card.title} card={card} />)}
          </ul>
        </section>
      )}

      {play && <PlaySection bracket={play} name={name} />}

      <section className="surface-card watch-card" aria-labelledby="watch-heading">
        <div className="watch-head">
          <span className="watch-icon" aria-hidden="true"><PhoneCall size={18} /></span>
          <div>
            <h2 id="watch-heading" className="t-title-2">When to call someone</h2>
            <p className="t-meta">
              This app never decides any of these — you do. Trust your instincts and ring your
              paediatrician, midwife or health visitor.
            </p>
          </div>
        </div>
        <ul className="watch-list">
          {WATCH_FOR.map((item) => (
            <li key={item.sign}>
              <span>{item.sign}</span>
              <a className="fact-source" href={item.source.url} target="_blank" rel="noopener noreferrer">
                {item.source.name} <ExternalLink size={12} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </section>

      <OutingChecklist />

      <div className="surface-card guide-disclaimer">
        <ShieldCheck size={20} />
        <div>
          <h2 className="t-title-2">Context, not a diagnosis</h2>
          <p className="t-body">
            Everything in this guide — ranges, care notes and play ideas — is general
            information from the sources listed below, not medical advice, and this app is
            not a medical device. Babies grow in their own rhythm; your paediatrician’s
            assessment always comes first.
          </p>
        </div>
      </div>

      {age !== null && range !== null ? (
        <div className="surface-card guide-range-card">
          <span className="guide-range-art" aria-hidden="true"><SproutChart size={72} /></span>
          <h2 className="t-label">{ageHeading(age)}</h2>
          <p className="guide-range-figure figure">
            {kg(range.p3)}–{kg(range.p97)}
            <span className="unit">{unitWord}</span>
          </p>
          <p className="t-meta guide-range-sub">Typical weight range at this age (WHO P3–P97)</p>
          {exactAge !== null && exactAge > MAX_REFERENCE_MONTHS && (
            <p className="t-meta">The WHO table covers the first 24 months, shown here at 24 months.</p>
          )}
          <RangeBar range={range} weightKg={latestKg} />
          {latestGrowth && latestKg !== undefined && (
            <p className="guide-latest">
              <span className="guide-latest-dot" aria-hidden="true" />
              {name}’s latest: <span className="guide-latest-value">{kg(latestKg)} {unitWord}</span> ({latestDateFormat.format(new Date(latestGrowth.startedAt))})
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
                      <td>{kg(row.p97)} {unitWord}</td>
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
        <h2 className="t-label">Typical pattern</h2>
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
        <p className="t-meta">These are population averages, not targets. A baby growing along a lower line on the chart gains less than one on a higher line — steadiness is the point.</p>
      </div>

      <div className="surface-card guide-section">
        <h2 className="t-label">When to ask your paediatrician</h2>
        <p className="t-body guide-intro">Trust your instincts — reach out whenever you’re unsure. These are the moments the guidance names for a check-in:</p>
        <ul className="guide-rows">
          <li>
            <p>At two weeks, still under birth weight or gaining less than about 150 g a week.</p>
            <span className="guide-authority">AAP</span>
          </li>
          <li>
            <p>Not back to birth weight by three weeks of age.</p>
            <span className="guide-authority">NHS · NICE</span>
          </li>
          <li>
            <p>After the first week, fewer than six wet diapers a day, or urine that is dark or has reddish-orange marks in it.</p>
            <span className="guide-authority">AAP</span>
          </li>
          <li>
            <p>Weight drifting across more than one line on their growth chart, in either direction.</p>
            <span className="guide-authority">NHS</span>
          </li>
          <li>
            <p>Noticeably fewer wet diapers alongside irritability, unusual sleepiness or reduced feeding — seek care the same day.</p>
            <span className="guide-authority">NHS</span>
          </li>
        </ul>
      </div>

      <div className="surface-card guide-sources">
        <h2 className="t-label">Sources</h2>
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
