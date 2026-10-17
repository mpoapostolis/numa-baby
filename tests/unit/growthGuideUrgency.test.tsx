/** @vitest-environment jsdom */
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import { Profile } from "@/domain/types";
import GrowthGuideScreen from "@/screens/GrowthGuideScreen";
import { stubBrowser } from "./appHarness";

// One screen, one urgency per sign. The Growth guide shows the "Get help now"
// list, the day's care cards and a "When to ask your paediatrician" card
// together. That card once said fewer wet diapers with unusual sleepiness
// meant "seek care the same day", and filed fewer than six wet diapers as a
// check-in, a few inches below a list calling the same signs "call your
// doctor immediately" — the AAP's word for them.

beforeEach(() => {
  window.localStorage.clear();
  stubBrowser();
  Element.prototype.scrollTo = () => {};
});
afterEach(() => cleanup());

// Eight days old: the day-5 card (six heavy wet diapers) is on screen too.
function guide() {
  const profile: Profile = { name: "Mia", birthDate: "2026-10-07", feedingMode: "mixed", sex: "girl" };
  render(<GrowthGuideScreen profile={profile} minuteClock={new Date(2026, 9, 15, 12, 0).getTime()} />);
}

test("no line on the guide gives a dehydration sign a softer urgency than the list", () => {
  guide();
  expect(document.body.textContent).not.toMatch(/same day/i);
  const lines = [...document.querySelectorAll("p, li > span")].map((el) => el.textContent ?? "");
  const dehydration = lines.filter((text) => /wet (diaper|count)|dry mouth|fewer tears|sleepiness/i.test(text));
  expect(dehydration.length).toBeGreaterThan(2);
  for (const text of dehydration) expect(text, text).not.toMatch(/\btoday\b/i);
});

test("the paediatrician check-ins hold no wet-diaper count", () => {
  guide();
  const card = [...document.querySelectorAll("h2")].find((h) => h.textContent === "When to ask your paediatrician")!.parentElement!;
  const [checkIns, cannotWait] = card.querySelectorAll(".guide-rows");
  expect(checkIns.textContent).not.toMatch(/wet diapers/);
  expect(cannotWait.textContent).toContain("fewer than six wet diapers a day");
  expect(card.textContent).toContain("call your doctor immediately");
});

test("a line that takes its urgency from a second page links both", () => {
  guide();
  const fever = [...document.querySelectorAll(".watch-list li")].find((li) => li.textContent?.includes("38.0 °C"))!;
  const links = [...fever.querySelectorAll("a.fact-source")].map((a) => a.getAttribute("href") ?? "");
  expect(links.some((href) => href.includes("healthychildren.org"))).toBe(true);
  expect(links.some((href) => href.includes("nhs.uk"))).toBe(true);
  const dayFive = [...document.querySelectorAll(".care-card")].find((li) => li.textContent?.includes("6 or more heavy wet diapers"))!;
  expect(dayFive.querySelectorAll("a.fact-source")).toHaveLength(2);
});
