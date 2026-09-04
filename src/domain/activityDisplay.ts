import { formatTime, humanDuration, minutesBetween, timeAgo } from "./time";
import { Activity } from "./types";
import { UnitSystem, formatLength, formatTemperature, formatVolume, formatWeight } from "./units";

export function activityTitle(activity: Activity) {
  if (activity.type === "bottle") return "Bottle";
  if (activity.type === "nursing") return "Nursing";
  if (activity.type === "burp") return activity.endedAt ? "Burping" : "Burping now";
  if (activity.type === "sleep") return activity.endedAt ? "Sleep" : "Sleeping now";
  if (activity.type === "growth") return "Growth check";
  if (activity.type === "health") return activity.temperatureC ? "Temperature" : "Health note";
  if (activity.type === "medicine") return activity.medicine?.trim() || "Medicine";
  if (activity.type === "solid") return activity.food?.trim() || "Solid food";
  // The label is carried ON the tick rather than looked up in the profile, so
  // a log entry stays self-describing: deleting the routine later must not
  // rename "Vitamin D, 09:12" into something nobody can identify.
  if (activity.type === "routine") return activity.note?.trim() || "Daily routine";
  if (activity.type === "diaper") {
    if (activity.diaperKind === "both") return "Wet + dirty diaper";
    return activity.diaperKind === "dirty" ? "Dirty diaper" : "Wet diaper";
  }
  // An activity type from a build newer than this one. Naming it honestly
  // beats mislabelling it as a nappy, which is what falling through did.
  return "Entry";
}

function includeNote(detail: string, note?: string) {
  return note?.trim() ? `${detail} · ${note.trim()}` : detail;
}

export function activityDetail(activity: Activity, units: UnitSystem = "metric") {
  if (activity.type === "bottle") {
    return includeNote(
      `${formatVolume(activity.amount ?? 0, units)} · ${activity.milkType === "expressed" ? "breast milk" : "formula"}`,
      activity.note,
    );
  }
  if (activity.type === "nursing") {
    const side = activity.side === "both" ? "Both sides" : activity.side === "left" ? "Left side" : "Right side";
    const detail = activity.endedAt
      ? `${side} · ${formatTime(activity.startedAt)}–${formatTime(activity.endedAt)} · ${humanDuration(minutesBetween(activity.startedAt, activity.endedAt))}`
      : `${side} · started ${formatTime(activity.startedAt)}`;
    return includeNote(detail, activity.note);
  }
  if (activity.type === "sleep") {
    const detail = activity.endedAt
      ? `${formatTime(activity.startedAt)}–${formatTime(activity.endedAt)} · ${humanDuration(minutesBetween(activity.startedAt, activity.endedAt))}`
      : `Started ${formatTime(activity.startedAt)} · ${timeAgo(activity.startedAt)}`;
    return includeNote(detail, activity.note);
  }
  if (activity.type === "burp") {
    const detail = activity.endedAt
      ? `${formatTime(activity.startedAt)}–${formatTime(activity.endedAt)} · ${humanDuration(minutesBetween(activity.startedAt, activity.endedAt))}`
      : `Started ${formatTime(activity.startedAt)} · ${timeAgo(activity.startedAt)}`;
    return includeNote(detail, activity.note);
  }
  if (activity.type === "medicine") {
    // The dose is shown exactly as it was typed. This app has no opinion about
    // how much a baby should be given and must never look like it has one.
    const detail = [activity.dose?.trim(), formatTime(activity.startedAt)].filter(Boolean).join(" · ");
    return includeNote(detail, activity.note);
  }
  if (activity.type === "solid") {
    return includeNote(formatTime(activity.startedAt), activity.note);
  }
  // The note IS the title here, and ActivityRow already renders the time — a
  // detail of the time as well read as "Vitamin D · 12:46 · 12:46".
  if (activity.type === "routine") return "";
  if (activity.type === "growth") {
    const values = [
      activity.weightGrams ? formatWeight(activity.weightGrams, units) : null,
      activity.lengthCm ? `${formatLength(activity.lengthCm, units)} long` : null,
      activity.headCm ? `${formatLength(activity.headCm, units)} head` : null,
    ].filter(Boolean);
    return includeNote(values.join(" · "), activity.note);
  }
  if (activity.type === "health") {
    const detail = activity.temperatureC ? formatTemperature(activity.temperatureC, units) : "Note";
    return includeNote(detail, activity.note);
  }
  return activity.note?.trim() ?? "";
}
