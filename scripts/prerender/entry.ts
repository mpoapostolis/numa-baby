// The single import surface the prerender bundles. Nothing new lives here —
// it exists so the bundler has one file to follow into the app's domain layer.
export { FACT_BRACKETS } from "../../src/domain/babyFacts";
export { CARE_BRACKETS, WATCH_FOR, WATCH_INSTINCT, WATCH_TIERS } from "../../src/domain/careGuidance";
export { ML_PER_KG_PER_DAY, DAILY_ML_CEILING } from "../../src/domain/intakeGuide";
// For the sitemap's lastmod on "/": the day the app last shipped a release.
export { LATEST_RELEASE_ID } from "../../src/domain/releaseIds";
