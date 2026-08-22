import { formatTime, humanDuration, minutesBetween, timeAgo } from "./time";
import { Activity } from "./types";

export function activityTitle(activity: Activity) {
  if (activity.type === "bottle") return "Bottle";
  if (activity.type === "nursing") return "Nursing";
  if (activity.type === "burp") return "Burp";
  if (activity.type === "sleep") return activity.endedAt ? "Sleep" : "Sleeping now";
  if (activity.type === "growth") return "Growth check";
  if (activity.type === "health") return activity.temperatureC ? "Temperature" : "Health note";
  if (activity.diaperKind === "both") return "Wet + dirty diaper";
  return activity.diaperKind === "dirty" ? "Dirty diaper" : "Wet diaper";
}

function includeNote(detail: string, note?: string) {
  return note?.trim() ? `${detail} · ${note.trim()}` : detail;
}

export function activityDetail(activity: Activity) {
  if (activity.type === "bottle") {
    return includeNote(
      `${activity.amount ?? 0} ml · ${activity.milkType === "expressed" ? "breast milk" : "formula"}`,
      activity.note,
    );
  }
  if (activity.type === "nursing") {
    const side = activity.side === "left" ? "Left side" : "Right side";
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
    return includeNote(formatTime(activity.startedAt), activity.note);
  }
  if (activity.type === "growth") {
    const values = [
      activity.weightGrams ? `${(activity.weightGrams / 1_000).toFixed(2)} kg` : null,
      activity.lengthCm ? `${activity.lengthCm} cm long` : null,
      activity.headCm ? `${activity.headCm} cm head` : null,
    ].filter(Boolean);
    return includeNote(values.join(" · "), activity.note);
  }
  if (activity.type === "health") {
    const detail = activity.temperatureC ? `${activity.temperatureC.toFixed(1)} °C` : "Note";
    return includeNote(detail, activity.note);
  }
  return activity.note?.trim() ?? "";
}
