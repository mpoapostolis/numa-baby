import { Activity, Profile } from "./types";

// Loaded only through a dynamic import from the ?debug boot path so the
// fixture never ships in the production bundle.
export function debugPreviewData(): { profile: Profile; activities: Activity[] } {
  const now = new Date();
  const birthDate = new Date(now);
  birthDate.setDate(now.getDate() - 24);
  const activities: Activity[] = [];

  for (let dayOffset = 6; dayOffset >= 0; dayOffset -= 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - dayOffset);

    [1, 5, 8, 11, 15, 18, 22].forEach((hour, index) => {
      const started = new Date(day);
      started.setHours(hour + ((dayOffset + index) % 2), index % 2 ? 20 : 5, 0, 0);
      if (started > now) return;
      const nursing = index % 3 === 1;
      activities.push({
        id: `debug-feed-${dayOffset}-${index}`,
        type: nursing ? "nursing" : "bottle",
        startedAt: started.toISOString(),
        endedAt: nursing ? new Date(started.getTime() + (14 + index) * 60_000).toISOString() : undefined,
        amount: nursing ? undefined : 80 + ((index + dayOffset) % 4) * 10,
        side: nursing ? (index % 2 ? "left" : "right") : undefined,
        milkType: nursing ? undefined : index % 2 ? "expressed" : "formula",
      });
    });

    [3, 9, 14, 20].forEach((hour, index) => {
      const started = new Date(day);
      started.setHours(hour, 35, 0, 0);
      if (started > now) return;
      activities.push({
        id: `debug-diaper-${dayOffset}-${index}`,
        type: "diaper",
        diaperKind: index === 2 ? "both" : index % 2 ? "dirty" : "wet",
        startedAt: started.toISOString(),
      });
    });

    [
      { hour: 2, minute: 30, duration: 110 },
      { hour: 9, minute: 25, duration: 65 },
      { hour: 13, minute: 5, duration: 80 },
      { hour: 17, minute: 15, duration: 45 },
      { hour: 23, minute: 10, duration: 145 },
    ].forEach((sleep, index) => {
      const started = new Date(day);
      started.setHours(sleep.hour, sleep.minute + (dayOffset % 3) * 5, 0, 0);
      const ended = new Date(started.getTime() + sleep.duration * 60_000);
      if (started > now || ended > now) return;
      activities.push({
        id: `debug-sleep-${dayOffset}-${index}`,
        type: "sleep",
        startedAt: started.toISOString(),
        endedAt: ended.toISOString(),
      });
    });
  }

  [
    { daysAgo: 17, weightGrams: 3180, lengthCm: 50.1, headCm: 34.2 },
    { daysAgo: 9, weightGrams: 3310, lengthCm: 50.8, headCm: 34.7 },
    { daysAgo: 1, weightGrams: 3470, lengthCm: 51.5, headCm: 35.1 },
  ].forEach((measurement, index) => {
    const started = new Date(now);
    started.setDate(now.getDate() - measurement.daysAgo);
    started.setHours(10, 15, 0, 0);
    activities.push({
      id: `debug-growth-${index}`,
      type: "growth",
      startedAt: started.toISOString(),
      weightGrams: measurement.weightGrams,
      lengthCm: measurement.lengthCm,
      headCm: measurement.headCm,
    });
  });

  const healthTime = new Date(now);
  healthTime.setDate(now.getDate() - 1);
  healthTime.setHours(18, 40, 0, 0);
  activities.push({
    id: "debug-health-0",
    type: "health",
    startedAt: healthTime.toISOString(),
    temperatureC: 36.8,
    note: "Routine evening check",
  });

  return {
    profile: {
      name: "Mia",
      birthDate: birthDate.toISOString().slice(0, 10),
      feedingMode: "mixed",
    },
    activities: activities.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    ),
  };
}
