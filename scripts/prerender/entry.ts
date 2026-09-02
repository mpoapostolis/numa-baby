// The single import surface the prerender bundles. Nothing new lives here —
// it exists so the bundler has one file to follow into the app's domain layer.
export { FACT_BRACKETS } from "../../src/domain/babyFacts";
export { CARE_BRACKETS, WATCH_FOR } from "../../src/domain/careGuidance";
export { ML_PER_KG_PER_DAY, DAILY_ML_CEILING } from "../../src/domain/intakeGuide";
