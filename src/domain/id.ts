// Entry ids: collision-free where the platform allows it, with a
// time-plus-random fallback for older WebViews.
export function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
