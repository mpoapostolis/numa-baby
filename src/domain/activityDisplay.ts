import { formatTime, humanDuration, minutesBetween, timeAgo } from "./time";
import { Activity } from "./types";
import { UnitSystem, formatLength, formatTemperature, formatVolume, formatWeight } from "./units";

export function activityTitle(activity: Activity) {
  if (activity.type === "bottle") return "Bottle";
  if (activity.type === "nursing") return "Nursing";
  if (activity.type === "pump") return "Pumping";
  if (activity.type === "burp") return activity.endedAt ? "Burping" : "Burping now";
  if (activity.type === "tummy") return activity.endedAt ? "Tummy time" : "Tummy time now";
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

/** One wording for a side, nursing or pumping. No side saved is no side
    shown — not a guess of "Right". */
const SIDE_LABEL = { left: "Left side", right: "Right side", both: "Both sides" } as const;

function includeNote(detail: string, note?: string) {
  return note?.trim() ? `${detail} · ${note.trim()}` : detail;
}

/** A running sleep, burp or tummy timer: its detail says how long ago it
    started, so its row has to be handed the minute clock to stay true. */
export function detailReadsClock(activity: Activity) {
  return !activity.endedAt && (activity.type === "sleep" || activity.type === "burp" || activity.type === "tummy");
}

export function activityDetail(activity: Activity, units: UnitSystem = "metric", now = Date.now()) {
  if (activity.type === "bottle") {
    return includeNote(
      `${formatVolume(activity.amount ?? 0, units)} · ${activity.milkType === "expressed" ? "breast milk" : "formula"}`,
      activity.note,
    );
  }
  if (activity.type === "nursing") {
    const side = activity.side ? SIDE_LABEL[activity.side] : null;
    const detail = activity.endedAt
      ? [side, `${formatTime(activity.startedAt)}–${formatTime(activity.endedAt)}`, humanDuration(minutesBetween(activity.startedAt, activity.endedAt))].filter(Boolean).join(" · ")
      : side ? `${side} · started ${formatTime(activity.startedAt)}` : `Started ${formatTime(activity.startedAt)}`;
    return includeNote(detail, activity.note);
  }
  // The amount leads, as on a bottle: it is the figure a mum who pumps comes
  // back for, and this line is cut short on a phone. At the end, "120 ml"
  // was the part that became "…". No start–end span: the row shows the time
  // beside it (as for medicine), and the span was what pushed the rest off.
  //
  // Each part only when it is there. A build from before pumping drops a
  // pump's end when it edits one; once that syncs here, the side and the
  // amount must still read — only the length is lost.
  if (activity.type === "pump") {
    return [
      activity.amount && formatVolume(activity.amount, units),
      activity.side && SIDE_LABEL[activity.side],
      activity.endedAt && humanDuration(minutesBetween(activity.startedAt, activity.endedAt)),
      activity.note?.trim(),
    ].filter(Boolean).join(" · ");
  }
  if (activity.type === "sleep") {
    const detail = activity.endedAt
      ? `${formatTime(activity.startedAt)}–${formatTime(activity.endedAt)} · ${humanDuration(minutesBetween(activity.startedAt, activity.endedAt))}`
      : `Started ${formatTime(activity.startedAt)} · ${timeAgo(activity.startedAt, now)}`;
    return includeNote(detail, activity.note);
  }
  if (activity.type === "burp" || activity.type === "tummy") {
    const detail = activity.endedAt
      ? `${formatTime(activity.startedAt)}–${formatTime(activity.endedAt)} · ${humanDuration(minutesBetween(activity.startedAt, activity.endedAt))}`
      : `Started ${formatTime(activity.startedAt)} · ${timeAgo(activity.startedAt, now)}`;
    return includeNote(detail, activity.note);
  }
  if (activity.type === "medicine") {
    // The dose is shown exactly as it was typed. This app has no opinion about
    // how much a baby should be given and must never look like it has one.
    //
    // No time here: ActivityRow renders one beside every row, so including it
    // read as "Vitamin D / 1 drop · 00:42" with "00:42" again alongside.
    return includeNote(activity.dose?.trim() ?? "", activity.note);
  }
  if (activity.type === "solid") {
    // Same as medicine: the row already carries the time.
    return activity.note?.trim() ?? "";
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
