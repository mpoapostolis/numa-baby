import { describe, expect, it } from "vitest";
import { visitDocument } from "@/domain/visitDocument";
import { buildVisitSummary } from "@/domain/visitSummary";
import { Activity } from "@/domain/types";

// The words for the paediatrician: the same builder feeds the sheet, the
// PDF page and the picture. What is under test is the words; the drawing
// needs a browser.

function log(): Activity[] {
  const out: Activity[] = [];
  for (let day = 20; day <= 31; day += 1) {
    if (day === 25) continue; // one blank day
    for (const hour of [6, 10, 14, 18, 22]) {
      out.push({ id: `b${day}${hour}`, type: "bottle", startedAt: `2026-08-${day}T${String(hour).padStart(2, "0")}:00:00`, amount: 90, milkType: "formula" });
    }
    out.push({ id: `w${day}`, type: "diaper", diaperKind: "wet", startedAt: `2026-08-${day}T08:00:00` });
    out.push({ id: `d${day}`, type: "diaper", diaperKind: "both", startedAt: `2026-08-${day}T15:00:00` });
  }
  out.push({ id: "g1", type: "growth", startedAt: "2026-08-21T11:00:00", weightGrams: 4200 });
  out.push({ id: "g2", type: "growth", startedAt: "2026-08-28T11:00:00", weightGrams: 4410 });
  return out;
}

describe("visitDocument", () => {
  const now = new Date(2026, 8, 1, 9).getTime();
  const summary = buildVisitSummary(log(), now, 14);
  const doc = visitDocument(summary, "Mia", "1 month", "metric", { p3: 3.2, p50: 4.4, p97: 5.7 }, { minGramsPerWeek: 160, maxGramsPerWeek: 210 }, now);

  it("says who, when, and how much of the window was logged, before any number", () => {
    expect(doc.title).toBe("Mia, 1 month old");
    expect(doc.sub).toMatch(/^Aug 19 – Sep 1 · 14 days · printed September 1, 2026$/);
    expect(doc.coverage).toMatch(/not logged, so the daily figures are medians/);
    expect(doc.sections.map((s) => s.heading)).toEqual(["Feeding", "Nappies", "Growth"]);
    expect(doc.sections[0].figures[0]).toEqual({ value: "5", label: "feeds a day" });
    expect(doc.sections[2].note).toMatch(/WHO reference at this age: 3.2 kg–5.7 kg/);
    expect(doc.days.filter((d) => d.blank).map((d) => d.label)).toEqual(["Aug 19", "Aug 25", "Sep 1"]);
  });

  it("speaks the phone's units and says when there is no age on file", () => {
    const plain = visitDocument(summary, "", null, "us", null, null, now);
    expect(plain.title).toBe("Baby");
    expect(plain.volumeUnit).toBe("oz");
    expect(plain.sections[2].note).toBe("No age on file, so no WHO reference is shown.");
    expect(plain.days).toHaveLength(14);
    expect(JSON.stringify(plain)).not.toMatch(/undefined|NaN|\[object/);
  });
});
