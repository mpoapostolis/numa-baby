"use client";

import {
  BarChart3,
  Baby,
  Check,
  ChevronRight,
  Clock,
  Download,
  Droplet,
  Heart,
  Home,
  Minus,
  Milk,
  Moon,
  Plus,
  Settings,
  ShieldCheck,
  Square,
  Trash2,
  Undo2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";

type ActivityType = "bottle" | "nursing" | "diaper" | "sleep";
type DiaperKind = "wet" | "dirty" | "both";
type FeedingMode = "mixed" | "breast" | "bottle";
type Tab = "today" | "timeline" | "insights" | "more";

type Activity = {
  id: string;
  type: ActivityType;
  startedAt: string;
  endedAt?: string;
  amount?: number;
  side?: "left" | "right";
  diaperKind?: DiaperKind;
  milkType?: "formula" | "expressed";
};

type Profile = {
  name: string;
  birthDate: string;
  feedingMode: FeedingMode;
  isDemo: boolean;
};

type Sheet = null | "bottle" | "nursing" | "diaper" | "profile";

const STORAGE_KEY = "numa-baby-v1";
const bottlePresets = [60, 90, 120, 150];

function localDateInput(date: Date) {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat("en", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

function formatShortDay(date: Date) {
  return new Intl.DateTimeFormat("en", { weekday: "short" }).format(date);
}

function formatLongDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(date);
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return "You’re up late";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function minutesBetween(start: string, end = new Date().toISOString()) {
  return Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000));
}

function humanDuration(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}

function liveDuration(start: string) {
  const totalSeconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(start).getTime()) / 1_000),
  );
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const clock = [minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  return hours > 0 ? `${hours}:${clock}` : clock;
}

function timeAgo(value?: string) {
  if (!value) return "No entries yet";
  const minutes = minutesBetween(value);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours < 24) return `${hours}h ${mins}m ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function isSameDay(value: string, day: Date) {
  const date = new Date(value);
  return (
    date.getFullYear() === day.getFullYear() &&
    date.getMonth() === day.getMonth() &&
    date.getDate() === day.getDate()
  );
}

function makeId() {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function demoData() {
  const now = new Date();
  const activities: Activity[] = [];

  for (let dayOffset = 6; dayOffset >= 0; dayOffset -= 1) {
    const day = new Date(now);
    day.setDate(now.getDate() - dayOffset);
    const feedHours = [1, 5, 8, 11, 15, 18, 22];

    feedHours.forEach((hour, index) => {
      const started = new Date(day);
      started.setHours(hour + ((dayOffset + index) % 2), index % 2 ? 20 : 5, 0, 0);
      if (started <= now) {
        activities.push({
          id: `demo-feed-${dayOffset}-${index}`,
          type: index % 3 === 1 ? "nursing" : "bottle",
          startedAt: started.toISOString(),
          endedAt:
            index % 3 === 1
              ? new Date(started.getTime() + (14 + index) * 60_000).toISOString()
              : undefined,
          amount: index % 3 === 1 ? undefined : 80 + ((index + dayOffset) % 4) * 10,
          side: index % 3 === 1 ? (index % 2 ? "left" : "right") : undefined,
          milkType: index % 3 === 1 ? undefined : index % 2 ? "expressed" : "formula",
        });
      }
    });

    [3, 9, 14, 20].forEach((hour, index) => {
      const started = new Date(day);
      started.setHours(hour, 35, 0, 0);
      if (started <= now) {
        activities.push({
          id: `demo-diaper-${dayOffset}-${index}`,
          type: "diaper",
          diaperKind: index === 2 ? "both" : index % 2 ? "dirty" : "wet",
          startedAt: started.toISOString(),
        });
      }
    });

    const sleepStart = new Date(day);
    sleepStart.setHours(12, 20 + (dayOffset % 3) * 10, 0, 0);
    const sleepEnd = new Date(sleepStart.getTime() + (75 + (dayOffset % 2) * 25) * 60_000);
    if (sleepStart <= now) {
      activities.push({
        id: `demo-sleep-${dayOffset}`,
        type: "sleep",
        startedAt: sleepStart.toISOString(),
        endedAt: sleepEnd > now ? now.toISOString() : sleepEnd.toISOString(),
      });
    }
  }

  return activities.sort(
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
  );
}

function activityTitle(activity: Activity) {
  if (activity.type === "bottle") return "Bottle";
  if (activity.type === "nursing") return "Nursing";
  if (activity.type === "sleep") return activity.endedAt ? "Sleep" : "Sleeping now";
  if (activity.diaperKind === "both") return "Wet + dirty diaper";
  return activity.diaperKind === "dirty" ? "Dirty diaper" : "Wet diaper";
}

function activityDetail(activity: Activity) {
  if (activity.type === "bottle") {
    return `${activity.amount ?? 0} ml · ${activity.milkType === "expressed" ? "breast milk" : "formula"}`;
  }
  if (activity.type === "nursing") {
    const side = activity.side === "left" ? "Left side" : "Right side";
    return activity.endedAt
      ? `${side} · ${formatTime(activity.startedAt)}–${formatTime(activity.endedAt)} · ${humanDuration(minutesBetween(activity.startedAt, activity.endedAt))}`
      : `${side} · started ${formatTime(activity.startedAt)}`;
  }
  if (activity.type === "sleep") {
    return activity.endedAt
      ? `${formatTime(activity.startedAt)}–${formatTime(activity.endedAt)} · ${humanDuration(minutesBetween(activity.startedAt, activity.endedAt))}`
      : `Started ${formatTime(activity.startedAt)} · ${timeAgo(activity.startedAt)}`;
  }
  return "Quick logged";
}

function ActivityGlyph({ type }: { type: ActivityType }) {
  if (type === "bottle") return <Milk size={19} strokeWidth={2.1} />;
  if (type === "nursing") return <Heart size={19} strokeWidth={2.1} />;
  if (type === "sleep") return <Moon size={19} strokeWidth={2.1} />;
  return <Droplet size={19} strokeWidth={2.1} />;
}

export default function HomePage() {
  const [hydrated, setHydrated] = useState(false);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [profile, setProfile] = useState<Profile>({
    name: "Mia",
    birthDate: "",
    feedingMode: "mixed",
    isDemo: true,
  });
  const [activeTab, setActiveTab] = useState<Tab>("today");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [bottleAmount, setBottleAmount] = useState(90);
  const [milkType, setMilkType] = useState<"formula" | "expressed">("formula");
  const [logTime, setLogTime] = useState("");
  const [nightMode, setNightMode] = useState(false);
  const [, refreshTimers] = useState(0);
  const [toast, setToast] = useState<{ message: string; undo?: () => void } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => refreshTimers((current) => current + 1), 1_000);
    return () => {
      window.clearInterval(timer);
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as {
            activities: Activity[];
            profile: Profile;
            nightMode?: boolean;
          };
          setActivities(parsed.activities ?? []);
          setProfile(parsed.profile);
          setNightMode(Boolean(parsed.nightMode));
        } catch {
          setActivities(demoData());
        }
      } else {
        const birthday = new Date();
        birthday.setDate(birthday.getDate() - 18);
        setProfile({
          name: "Mia",
          birthDate: birthday.toISOString().slice(0, 10),
          feedingMode: "mixed",
          isDemo: true,
        });
        setActivities(demoData());
      }
      setHydrated(true);
    });

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ activities, profile, nightMode }),
    );
  }, [activities, profile, nightMode, hydrated]);

  const sortedActivities = useMemo(
    () =>
      [...activities].sort(
        (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
      ),
    [activities],
  );

  const todayActivities = useMemo(
    () => sortedActivities.filter((activity) => isSameDay(activity.startedAt, new Date())),
    [sortedActivities],
  );

  const feedsToday = todayActivities.filter(
    (activity) => activity.type === "bottle" || activity.type === "nursing",
  );
  const bottleMlToday = feedsToday.reduce((sum, activity) => sum + (activity.amount ?? 0), 0);
  const diapersToday = todayActivities.filter((activity) => activity.type === "diaper").length;
  const sleepMinutesToday = todayActivities
    .filter((activity) => activity.type === "sleep")
    .reduce(
      (sum, activity) => sum + minutesBetween(activity.startedAt, activity.endedAt),
      0,
    );
  const lastFeed = sortedActivities.find(
    (activity) => activity.type === "bottle" || activity.type === "nursing",
  );
  const activeSleep = sortedActivities.find(
    (activity) => activity.type === "sleep" && !activity.endedAt,
  );
  const activeNursing = sortedActivities.find(
    (activity) => activity.type === "nursing" && !activity.endedAt,
  );
  const activeTimers = [activeNursing, activeSleep].filter(
    (activity): activity is Activity => Boolean(activity),
  );

  const feedingGaps = useMemo(() => {
    const feeds = sortedActivities
      .filter((activity) => activity.type === "bottle" || activity.type === "nursing")
      .slice(0, 30)
      .map((activity) => new Date(activity.startedAt).getTime())
      .sort((a, b) => a - b);
    return feeds
      .slice(1)
      .map((time, index) => Math.round((time - feeds[index]) / 60_000))
      .filter((minutes) => minutes > 20 && minutes < 480);
  }, [sortedActivities]);

  const typicalGap = useMemo(() => {
    if (!feedingGaps.length) return 0;
    const ordered = [...feedingGaps].sort((a, b) => a - b);
    return ordered[Math.floor(ordered.length / 2)];
  }, [feedingGaps]);

  const weekly = useMemo(() => {
    return Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(12, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      const dayActivities = sortedActivities.filter((activity) => isSameDay(activity.startedAt, date));
      const feeds = dayActivities.filter(
        (activity) => activity.type === "bottle" || activity.type === "nursing",
      );
      return {
        date,
        feeds,
        ml: feeds.reduce((sum, activity) => sum + (activity.amount ?? 0), 0),
        diapers: dayActivities.filter((activity) => activity.type === "diaper").length,
        sleep: dayActivities
          .filter((activity) => activity.type === "sleep")
          .reduce(
            (sum, activity) => sum + minutesBetween(activity.startedAt, activity.endedAt),
            0,
          ),
      };
    });
  }, [sortedActivities]);

  const maxMl = Math.max(...weekly.map((day) => day.ml), 1);
  const averageFeeds = Math.round(
    weekly.reduce((sum, day) => sum + day.feeds.length, 0) / weekly.length,
  );

  function showToast(message: string, undo?: () => void) {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ message, undo });
    toastTimer.current = setTimeout(() => setToast(null), 4200);
  }

  function addActivity(activity: Activity, message: string) {
    setActivities((current) => [activity, ...current]);
    showToast(message, () => {
      setActivities((current) => current.filter((item) => item.id !== activity.id));
      setToast(null);
    });
  }

  function openSheet(next: Exclude<Sheet, null>) {
    setLogTime(localDateInput(new Date()));
    setSheet(next);
  }

  function saveBottle() {
    const entry: Activity = {
      id: makeId(),
      type: "bottle",
      startedAt: new Date(logTime || Date.now()).toISOString(),
      amount: bottleAmount,
      milkType,
    };
    addActivity(entry, `${bottleAmount} ml bottle saved`);
    setSheet(null);
  }

  function startNursing(side: "left" | "right") {
    const entry: Activity = {
      id: makeId(),
      type: "nursing",
      startedAt: new Date(logTime || Date.now()).toISOString(),
      side,
    };
    addActivity(entry, `${side === "left" ? "Left" : "Right"} timer started`);
    setSheet(null);
  }

  function stopNursing() {
    if (!activeNursing) return;
    setActivities((current) =>
      current.map((activity) =>
        activity.id === activeNursing.id
          ? { ...activity, endedAt: new Date().toISOString() }
          : activity,
      ),
    );
    showToast("Nursing session saved");
  }

  function saveDiaper(kind: DiaperKind) {
    const entry: Activity = {
      id: makeId(),
      type: "diaper",
      diaperKind: kind,
      startedAt: new Date(logTime || Date.now()).toISOString(),
    };
    addActivity(entry, `${kind === "both" ? "Wet + dirty" : kind === "dirty" ? "Dirty" : "Wet"} diaper saved`);
    setSheet(null);
  }

  function toggleSleep() {
    if (activeSleep) {
      setActivities((current) =>
        current.map((activity) =>
          activity.id === activeSleep.id
            ? { ...activity, endedAt: new Date().toISOString() }
            : activity,
        ),
      );
      showToast("Sleep session saved");
      return;
    }
    const entry: Activity = {
      id: makeId(),
      type: "sleep",
      startedAt: new Date().toISOString(),
    };
    addActivity(entry, "Sleep timer started");
  }

  function removeActivity(activity: Activity) {
    setActivities((current) => current.filter((item) => item.id !== activity.id));
    showToast("Entry removed", () => {
      setActivities((current) => [activity, ...current]);
      setToast(null);
    });
  }

  function startFresh() {
    setActivities([]);
    setProfile((current) => ({ ...current, isDemo: false }));
    openSheet("profile");
    showToast("Demo entries cleared");
  }

  function exportData() {
    const payload = JSON.stringify({ profile, activities, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `baby-tracker-${profile.name.toLowerCase().replace(/\s+/g, "-")}-backup.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("Private backup downloaded");
  }

  function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as {
          profile: Profile;
          activities: Activity[];
        };
        if (!parsed.profile || !Array.isArray(parsed.activities)) throw new Error("Invalid backup");
        setProfile({ ...parsed.profile, isDemo: false });
        setActivities(parsed.activities);
        showToast("Backup restored");
      } catch {
        showToast("That backup could not be read");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  if (!hydrated) {
    return (
      <main className="loading-screen" aria-label="Loading Baby Tracker">
        <div className="brand-mark"><Baby size={24} /></div>
        <span>Baby Tracker</span>
      </main>
    );
  }

  return (
    <div className={`numa-shell ${nightMode ? "theme-night" : ""}`}>
      <div className="app-frame">
        <header className="topbar">
          <div className="wordmark" aria-label="Baby Tracker">
            <span className="wordmark-mark"><Baby size={20} /></span>
            <span className="wordmark-copy">
              <strong>Baby Tracker</strong>
              <small>Private family log</small>
            </span>
          </div>
          <div className="topbar-date">
            <Clock size={16} />
            <span>{formatLongDate(new Date())}</span>
          </div>
          <button className="baby-identity" onClick={() => openSheet("profile")}>
            <span className="baby-avatar"><Baby size={19} /></span>
            <span>
              <strong>{profile.name}</strong>
              <small>{profile.isDemo ? "Preview profile" : "Your private log"}</small>
            </span>
            <ChevronRight size={16} />
          </button>
        </header>

        {profile.isDemo && (
          <div className="demo-banner">
            <span><strong>Preview data</strong> — explore the full app</span>
            <button onClick={startFresh}>Start fresh</button>
          </div>
        )}

        <main className="content">
          {activeTab === "today" && (
            <section className="screen today-screen" aria-labelledby="today-heading">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">{formatLongDate(new Date())}</p>
                  <h1 id="today-heading">{greeting()}, {profile.name}.</h1>
                  <p className="page-subtitle">Everything that matters today, without having to remember it.</p>
                </div>
                <button className="icon-button" aria-label="Open settings" onClick={() => setActiveTab("more")}>
                  <Settings size={20} />
                </button>
              </div>

              <div className="today-dashboard">
                <div className="today-primary">
              <article className="now-card">
                <div className="now-card-top">
                  <span className="status-pill"><span /> Last feed</span>
                  <span className="now-time">{lastFeed ? formatTime(lastFeed.startedAt) : "—"}</span>
                </div>
                <div className="now-main">
                  <div>
                    <strong>{timeAgo(lastFeed?.startedAt)}</strong>
                    <p>{lastFeed ? `${activityTitle(lastFeed)} · ${activityDetail(lastFeed)}` : "Log the first feed when it happens."}</p>
                  </div>
                  <Milk size={36} strokeWidth={1.7} />
                </div>
                {typicalGap > 0 && (
                  <div className="usual-row">
                    <Clock size={15} />
                    <span>Usual gap from your logs: {humanDuration(typicalGap)}</span>
                  </div>
                )}
              </article>

              {activeTimers.length > 0 && (
                <div className="active-stack" aria-label="Active timers">
                  <div className="timer-heading">
                    <span><i className="pulse" /> Running now</span>
                    <small>{activeTimers.length} {activeTimers.length === 1 ? "timer" : "timers"}</small>
                  </div>
                  {activeTimers.map((timer) => (
                    <ActiveTimerCard
                      key={timer.id}
                      activity={timer}
                      onStop={timer.type === "sleep" ? toggleSleep : stopNursing}
                    />
                  ))}
                </div>
              )}

              <div className="summary-grid" aria-label="Today's summary">
                <div><strong>{feedsToday.length}</strong><span>feeds</span></div>
                <div><strong>{bottleMlToday}</strong><span>ml logged</span></div>
                <div><strong>{diapersToday}</strong><span>diapers</span></div>
                <div><strong>{humanDuration(sleepMinutesToday)}</strong><span>sleep</span></div>
              </div>
                </div>

              <div className="quick-section">
                <div className="mini-heading">
                  <h2>Quick log</h2>
                  <span>Details are optional</span>
                </div>
                <div className="action-grid">
                  {profile.feedingMode !== "breast" && (
                    <button className="action-tile action-feed" onClick={() => openSheet("bottle")}>
                      <span className="action-icon"><Milk size={23} /></span>
                      <span><strong>Bottle</strong><small>Amount</small></span>
                      <Plus size={18} />
                    </button>
                  )}
                  {profile.feedingMode !== "bottle" && (
                    <button
                      className="action-tile action-nurse"
                      onClick={activeNursing ? stopNursing : () => openSheet("nursing")}
                    >
                      <span className="action-icon"><Heart size={22} /></span>
                      <span><strong>{activeNursing ? "Stop nursing" : "Nursing"}</strong><small>{activeNursing ? humanDuration(minutesBetween(activeNursing.startedAt)) : "Left or right"}</small></span>
                      {activeNursing ? <Square size={16} fill="currentColor" /> : <Plus size={18} />}
                    </button>
                  )}
                  <button className="action-tile action-diaper" onClick={() => openSheet("diaper")}>
                    <span className="action-icon"><Droplet size={22} /></span>
                    <span><strong>Diaper</strong><small>Wet or dirty</small></span>
                    <Plus size={18} />
                  </button>
                  <button className={`action-tile action-sleep ${activeSleep ? "is-active" : ""}`} onClick={toggleSleep}>
                    <span className="action-icon"><Moon size={22} /></span>
                    <span><strong>{activeSleep ? "Wake up" : "Sleep"}</strong><small>{activeSleep ? humanDuration(minutesBetween(activeSleep.startedAt)) : "Start timer"}</small></span>
                    {activeSleep ? <Square size={16} fill="currentColor" /> : <Plus size={18} />}
                  </button>
                </div>
              </div>
              </div>

              <div className="recent-section">
                <div className="mini-heading">
                  <h2>Recent</h2>
                  <button onClick={() => setActiveTab("timeline")}>See all <ChevronRight size={15} /></button>
                </div>
                <div className="activity-list">
                  {sortedActivities.slice(0, 4).map((activity) => (
                    <ActivityRow key={activity.id} activity={activity} onRemove={removeActivity} />
                  ))}
                  {!sortedActivities.length && <EmptyState text="Your day will appear here as you log it." />}
                </div>
              </div>
            </section>
          )}

          {activeTab === "timeline" && (
            <section className="screen timeline-screen" aria-labelledby="timeline-heading">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">The full picture</p>
                  <h1 id="timeline-heading">Timeline</h1>
                </div>
                <span className="count-badge">{sortedActivities.length} logs</span>
              </div>
              <div className="timeline-date"><span>Latest first</span><span>Tap trash to remove</span></div>
              <div className="activity-list timeline-list">
                {sortedActivities.map((activity) => (
                  <ActivityRow key={activity.id} activity={activity} onRemove={removeActivity} showDate />
                ))}
                {!sortedActivities.length && <EmptyState text="Nothing logged yet. Your first entry takes seconds." />}
              </div>
            </section>
          )}

          {activeTab === "insights" && (
            <section className="screen insights-screen" aria-labelledby="insights-heading">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Last 7 days</p>
                  <h1 id="insights-heading">Patterns, calmly</h1>
                </div>
                <span className="insight-spark"><BarChart3 size={20} /></span>
              </div>

              <div className="insight-summary">
                <div><span>Typical feed gap</span><strong>{typicalGap ? humanDuration(typicalGap) : "—"}</strong></div>
                <div><span>Feeds / day</span><strong>{averageFeeds}</strong></div>
                <div><span>Today’s bottle</span><strong>{bottleMlToday} ml</strong></div>
              </div>

              <article className="chart-card">
                <div className="chart-title">
                  <div><span>Bottle volume</span><strong>Daily total in ml</strong></div>
                  <Milk size={19} />
                </div>
                <div className="bar-chart" aria-label="Bottle volume for the last seven days">
                  {weekly.map((day) => (
                    <div className="bar-column" key={day.date.toISOString()}>
                      <span className="bar-value">{day.ml || ""}</span>
                      <div className="bar-track">
                        <div className="bar-fill" style={{ height: `${Math.max(4, (day.ml / maxMl) * 100)}%` }} />
                      </div>
                      <small>{formatShortDay(day.date)}</small>
                    </div>
                  ))}
                </div>
              </article>

              <article className="chart-card rhythm-card">
                <div className="chart-title">
                  <div><span>Feeding rhythm</span><strong>When feeds happened</strong></div>
                  <Clock size={19} />
                </div>
                <div className="rhythm-axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>
                <div className="rhythm-chart">
                  {weekly.map((day) => (
                    <div className="rhythm-row" key={day.date.toISOString()}>
                      <small>{formatShortDay(day.date)}</small>
                      <div className="rhythm-line">
                        {day.feeds.map((feed) => {
                          const date = new Date(feed.startedAt);
                          const hour = date.getHours() + date.getMinutes() / 60;
                          return (
                            <span
                              className={`feed-dot ${feed.type === "nursing" ? "nursing-dot" : ""}`}
                              key={feed.id}
                              style={{ left: `${(hour / 24) * 100}%` }}
                              title={`${activityTitle(feed)} at ${formatTime(feed.startedAt)}`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="chart-legend"><span><i /> Bottle</span><span><i className="nursing-key" /> Nursing</span></div>
              </article>

              <article className="gentle-note">
                <ShieldCheck size={20} />
                <p><strong>Useful, not judgmental.</strong> Baby Tracker summarizes what you logged. It never scores your parenting or replaces medical advice.</p>
              </article>
            </section>
          )}

          {activeTab === "more" && (
            <section className="screen more-screen" aria-labelledby="more-heading">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Private by design</p>
                  <h1 id="more-heading">Your tracker</h1>
                </div>
                <button className="icon-button" aria-label="Toggle night mode" onClick={() => setNightMode((value) => !value)}>
                  {nightMode ? <Home size={19} /> : <Moon size={19} />}
                </button>
              </div>

              <article className="privacy-card">
                <span><ShieldCheck size={25} /></span>
                <div><strong>Only on this device</strong><p>No account. No ads. No baby data sent anywhere.</p></div>
                <Check size={19} />
              </article>

              <div className="settings-group">
                <h2>Baby profile</h2>
                <button className="settings-row" onClick={() => openSheet("profile")}>
                  <span className="settings-icon"><Baby size={19} /></span>
                  <span><strong>{profile.name}</strong><small>{profile.feedingMode} feeding</small></span>
                  <ChevronRight size={17} />
                </button>
              </div>

              <div className="settings-group">
                <h2>Your data</h2>
                <button className="settings-row" onClick={exportData}>
                  <span className="settings-icon"><Download size={19} /></span>
                  <span><strong>Download private backup</strong><small>JSON file you control</small></span>
                  <ChevronRight size={17} />
                </button>
                <button className="settings-row" onClick={() => importRef.current?.click()}>
                  <span className="settings-icon"><Upload size={19} /></span>
                  <span><strong>Restore a backup</strong><small>Import from this or another device</small></span>
                  <ChevronRight size={17} />
                </button>
                <input ref={importRef} className="hidden-input" type="file" accept="application/json" onChange={importData} />
              </div>

              <article className="pro-card">
                <div className="pro-kicker"><Users size={17} /> Family Pro</div>
                <h2>One family.<br />One shared timeline.</h2>
                <p>Encrypted partner sync, shared live timers and automatic backups — without selling your family’s data.</p>
                <div className="pro-price"><strong>€19.99</strong><span>once · yours forever</span></div>
                <button onClick={() => showToast("Family Pro is next on the roadmap")}>Coming next</button>
              </article>

              <p className="version-note">Baby Tracker preview · Local-first and private</p>
            </section>
          )}
        </main>

        <nav className="bottom-nav" aria-label="Primary navigation">
          <NavButton active={activeTab === "today"} label="Today" onClick={() => setActiveTab("today")} icon={<Home size={20} />} />
          <NavButton active={activeTab === "timeline"} label="Timeline" onClick={() => setActiveTab("timeline")} icon={<Clock size={20} />} />
          <NavButton active={activeTab === "insights"} label="Insights" onClick={() => setActiveTab("insights")} icon={<BarChart3 size={20} />} />
          <NavButton active={activeTab === "more"} label="More" onClick={() => setActiveTab("more")} icon={<Settings size={20} />} />
        </nav>

        {toast && (
          <div className="toast" role="status">
            <span><Check size={16} /> {toast.message}</span>
            {toast.undo && <button onClick={toast.undo}><Undo2 size={15} /> Undo</button>}
          </div>
        )}

        {sheet && (
          <div className="sheet-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSheet(null)}>
            <section className="bottom-sheet" role="dialog" aria-modal="true" aria-label={`Log ${sheet}`}>
              <div className="sheet-handle" />
              <button className="sheet-close" aria-label="Close" onClick={() => setSheet(null)}><X size={20} /></button>

              {sheet === "bottle" && (
                <>
                  <div className="sheet-heading"><span className="sheet-symbol"><Milk size={23} /></span><div><p>Quick log</p><h2>Bottle</h2></div></div>
                  <label className="field-label">Amount</label>
                  <div className="amount-control">
                    <button aria-label="Decrease amount" onClick={() => setBottleAmount((value) => Math.max(10, value - 10))}><Minus size={20} /></button>
                    <strong>{bottleAmount}<small>ml</small></strong>
                    <button aria-label="Increase amount" onClick={() => setBottleAmount((value) => Math.min(400, value + 10))}><Plus size={20} /></button>
                  </div>
                  <div className="preset-row">
                    {bottlePresets.map((amount) => <button className={bottleAmount === amount ? "selected" : ""} key={amount} onClick={() => setBottleAmount(amount)}>{amount}</button>)}
                  </div>
                  <div className="segmented">
                    <button className={milkType === "formula" ? "selected" : ""} onClick={() => setMilkType("formula")}>Formula</button>
                    <button className={milkType === "expressed" ? "selected" : ""} onClick={() => setMilkType("expressed")}>Breast milk</button>
                  </div>
                  <TimeField value={logTime} onChange={setLogTime} />
                  <button className="primary-button" onClick={saveBottle}>Save {bottleAmount} ml</button>
                </>
              )}

              {sheet === "nursing" && (
                <>
                  <div className="sheet-heading"><span className="sheet-symbol"><Heart size={23} /></span><div><p>Start timer</p><h2>Which side?</h2></div></div>
                  <div className="side-grid">
                    <button onClick={() => startNursing("left")}><span>L</span><strong>Left</strong></button>
                    <button onClick={() => startNursing("right")}><span>R</span><strong>Right</strong></button>
                  </div>
                  <TimeField value={logTime} onChange={setLogTime} />
                  <p className="sheet-footnote">The timer stays active if you close the app.</p>
                </>
              )}

              {sheet === "diaper" && (
                <>
                  <div className="sheet-heading"><span className="sheet-symbol"><Droplet size={23} /></span><div><p>Quick log</p><h2>What was it?</h2></div></div>
                  <div className="diaper-grid">
                    <button onClick={() => saveDiaper("wet")}><Droplet size={22} /><strong>Wet</strong></button>
                    <button onClick={() => saveDiaper("dirty")}><span className="dot-icon">●</span><strong>Dirty</strong></button>
                    <button onClick={() => saveDiaper("both")}><span className="both-icon"><Droplet size={18} />●</span><strong>Both</strong></button>
                  </div>
                  <TimeField value={logTime} onChange={setLogTime} />
                </>
              )}

              {sheet === "profile" && (
                <ProfileForm profile={profile} onChange={setProfile} onDone={() => setSheet(null)} />
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityRow({ activity, onRemove, showDate = false }: { activity: Activity; onRemove: (activity: Activity) => void; showDate?: boolean }) {
  return (
    <article className="activity-row">
      <span className={`activity-glyph glyph-${activity.type}`}><ActivityGlyph type={activity.type} /></span>
      <div className="activity-copy">
        <strong>{activityTitle(activity)}</strong>
        <span>{activityDetail(activity)}</span>
      </div>
      <div className="activity-meta">
        <time>{formatTime(activity.startedAt)}</time>
        {showDate && <small>{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(activity.startedAt))}</small>}
      </div>
      <button className="delete-button" aria-label={`Delete ${activityTitle(activity)}`} onClick={() => onRemove(activity)}><Trash2 size={16} /></button>
    </article>
  );
}

function ActiveTimerCard({ activity, onStop }: { activity: Activity; onStop: () => void }) {
  const isSleep = activity.type === "sleep";
  const title = isSleep
    ? "Sleeping"
    : `Nursing · ${activity.side === "left" ? "Left" : "Right"}`;
  const elapsed = liveDuration(activity.startedAt);

  return (
    <article className={`active-card active-${activity.type}`}>
      <span className="active-icon"><ActivityGlyph type={activity.type} /></span>
      <div className="active-copy">
        <strong>{title}</strong>
        <span>Started at {formatTime(activity.startedAt)} · {formatTime(activity.startedAt)} → now</span>
      </div>
      <div className="active-elapsed" aria-live="polite">
        <small>Elapsed</small>
        <strong>{elapsed}</strong>
      </div>
      <button onClick={onStop} aria-label={`Stop ${title.toLowerCase()} timer`}>
        <Square size={14} fill="currentColor" /> Stop
      </button>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><Baby size={24} /><p>{text}</p></div>;
}

function NavButton({ active, label, onClick, icon }: { active: boolean; label: string; onClick: () => void; icon: React.ReactNode }) {
  return <button className={active ? "active" : ""} onClick={onClick}>{icon}<span>{label}</span></button>;
}

function TimeField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="time-field">
      <span>When</span>
      <input type="datetime-local" value={value} max={localDateInput(new Date())} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function ProfileForm({ profile, onChange, onDone }: { profile: Profile; onChange: (profile: Profile) => void; onDone: () => void }) {
  const [draft, setDraft] = useState(profile);
  return (
    <>
      <div className="sheet-heading"><span className="sheet-symbol"><Baby size={23} /></span><div><p>Keep it personal</p><h2>Baby profile</h2></div></div>
      <label className="text-field"><span>Name</span><input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Baby’s name" /></label>
      <label className="text-field"><span>Date of birth</span><input type="date" value={draft.birthDate} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setDraft({ ...draft, birthDate: event.target.value })} /></label>
      <label className="field-label">How are you feeding?</label>
      <div className="segmented three-way">
        {(["breast", "bottle", "mixed"] as FeedingMode[]).map((mode) => <button key={mode} className={draft.feedingMode === mode ? "selected" : ""} onClick={() => setDraft({ ...draft, feedingMode: mode })}>{mode}</button>)}
      </div>
      <button className="primary-button" onClick={() => { onChange({ ...draft, name: draft.name.trim() || "Baby", isDemo: false }); onDone(); }}>Save profile</button>
    </>
  );
}
