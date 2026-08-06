import {
  BarChart3,
  Baby,
  Bell,
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
  Pencil,
  Plus,
  Settings,
  ShieldCheck,
  Square,
  Stethoscope,
  Sun,
  Thermometer,
  Trash2,
  Upload,
  Users,
  Weight,
} from "lucide-react";
import { ChangeEvent, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "./components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./components/ui/alert-dialog";
import { Badge } from "./components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "./components/ui/field";
import { Input } from "./components/ui/input";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
  InputGroupTextarea,
} from "./components/ui/input-group";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "./components/ui/item";
import { ButtonGroup, ButtonGroupText } from "./components/ui/button-group";
import { Toaster } from "./components/ui/sonner";
import { Separator } from "./components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "./components/ui/sidebar";
import { Switch } from "./components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "./components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "./components/ui/toggle-group";
import { toast } from "sonner";

type ActivityType = "bottle" | "nursing" | "diaper" | "sleep" | "growth" | "health";
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
  weightGrams?: number;
  lengthCm?: number;
  headCm?: number;
  temperatureC?: number;
  note?: string;
};

type Profile = {
  name: string;
  birthDate: string;
  feedingMode: FeedingMode;
};

type BootState = "loading" | "onboarding" | "ready" | "recovery";

type ReminderSettings = {
  feedEnabled: boolean;
  feedIntervalMinutes: number;
};

type Sheet = null | "bottle" | "nursing" | "diaper" | "growth" | "health" | "profile" | "edit";

const STORAGE_KEY = "numa-baby-v1";
const RECOVERY_KEY = "numa-baby-v1-recovery";
const EMPTY_PROFILE: Profile = { name: "", birthDate: "", feedingMode: "mixed" };
const DEFAULT_REMINDERS: ReminderSettings = { feedEnabled: false, feedIntervalMinutes: 180 };
const bottlePresets = [60, 90, 120, 150];
const activityTypes = new Set<ActivityType>([
  "bottle",
  "nursing",
  "diaper",
  "sleep",
  "growth",
  "health",
]);

type StoredData = {
  activities: Activity[];
  profile: Profile;
  nightMode?: boolean;
  reminders?: ReminderSettings;
  legacyDemo?: boolean;
  onboardingComplete: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isValidDate(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(new Date(value).getTime());
}

function isValidActivity(value: unknown): value is Activity {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || !value.id || !activityTypes.has(value.type as ActivityType)) {
    return false;
  }
  if (!isValidDate(value.startedAt) || (value.endedAt !== undefined && !isValidDate(value.endedAt))) {
    return false;
  }
  if (value.note !== undefined && (typeof value.note !== "string" || value.note.length > 240)) return false;
  if (value.amount !== undefined && (typeof value.amount !== "number" || value.amount < 0 || value.amount > 1_000)) return false;
  if (value.weightGrams !== undefined && (typeof value.weightGrams !== "number" || value.weightGrams < 500 || value.weightGrams > 30_000)) return false;
  if (value.lengthCm !== undefined && (typeof value.lengthCm !== "number" || value.lengthCm < 20 || value.lengthCm > 130)) return false;
  if (value.headCm !== undefined && (typeof value.headCm !== "number" || value.headCm < 20 || value.headCm > 80)) return false;
  if (value.temperatureC !== undefined && (typeof value.temperatureC !== "number" || value.temperatureC < 30 || value.temperatureC > 45)) return false;
  if (value.side !== undefined && value.side !== "left" && value.side !== "right") return false;
  if (value.diaperKind !== undefined && !["wet", "dirty", "both"].includes(String(value.diaperKind))) return false;
  if (value.milkType !== undefined && value.milkType !== "formula" && value.milkType !== "expressed") return false;
  return true;
}

function isValidProfile(value: unknown): value is Profile & { isDemo?: boolean } {
  return (
    isRecord(value) &&
    typeof value.name === "string" &&
    value.name.length <= 80 &&
    typeof value.birthDate === "string" &&
    ["mixed", "breast", "bottle"].includes(String(value.feedingMode)) &&
    (value.isDemo === undefined || typeof value.isDemo === "boolean")
  );
}

function isValidReminderSettings(value: unknown): value is ReminderSettings {
  return (
    isRecord(value) &&
    typeof value.feedEnabled === "boolean" &&
    [120, 180, 240].includes(Number(value.feedIntervalMinutes))
  );
}

function parseStoredData(value: string): StoredData {
  const parsed: unknown = JSON.parse(value);
  if (!isRecord(parsed) || !isValidProfile(parsed.profile) || !Array.isArray(parsed.activities)) {
    throw new Error("Invalid Baby Tracker backup");
  }
  if (parsed.activities.length > 25_000 || !parsed.activities.every(isValidActivity)) {
    throw new Error("Invalid Baby Tracker activities");
  }
  if (parsed.nightMode !== undefined && typeof parsed.nightMode !== "boolean") {
    throw new Error("Invalid Baby Tracker preference");
  }
  if (parsed.reminders !== undefined && !isValidReminderSettings(parsed.reminders)) {
    throw new Error("Invalid Baby Tracker reminder preference");
  }
  if (parsed.onboardingComplete !== undefined && typeof parsed.onboardingComplete !== "boolean") {
    throw new Error("Invalid Baby Tracker onboarding preference");
  }
  const storedProfile = parsed.profile;
  return {
    profile: {
      name: storedProfile.name,
      birthDate: storedProfile.birthDate,
      feedingMode: storedProfile.feedingMode,
    },
    activities: parsed.activities,
    nightMode: parsed.nightMode,
    reminders: parsed.reminders,
    legacyDemo: storedProfile.isDemo === true,
    onboardingComplete: parsed.onboardingComplete ?? storedProfile.isDemo === false,
  };
}

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

function formatTimelineDay(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (isSameDay(value, today)) return "Today";
  if (isSameDay(value, yesterday)) return "Yesterday";
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

function median(values: number[]) {
  if (!values.length) return 0;
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2
    ? ordered[middle]
    : Math.round((ordered[middle - 1] + ordered[middle]) / 2);
}

function forecastRelative(target: number, now: number) {
  const minutes = Math.round((target - now) / 60_000);
  if (minutes <= 15) return "Check cues now";
  return `Likely in ${humanDuration(minutes)}`;
}

function forecastRange(target: number, spreadMinutes: number) {
  const start = new Date(target - spreadMinutes * 60_000).toISOString();
  const end = new Date(target + spreadMinutes * 60_000).toISOString();
  return `${formatTime(start)}–${formatTime(end)}`;
}

function liveDuration(start: string, now: number) {
  const totalSeconds = Math.max(
    0,
    Math.floor((now - new Date(start).getTime()) / 1_000),
  );
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  const clock = [minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
  return hours > 0 ? `${hours}:${clock}` : clock;
}

function minutesOnDay(activity: Activity, day: Date, now = Date.now()) {
  const dayStart = new Date(day);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const start = Math.max(new Date(activity.startedAt).getTime(), dayStart.getTime());
  const end = Math.min(activity.endedAt ? new Date(activity.endedAt).getTime() : now, dayEnd.getTime());
  return Math.max(0, Math.round((end - start) / 60_000));
}

function ageInMonths(birthDate: string) {
  const birth = new Date(`${birthDate}T12:00:00`);
  if (!Number.isFinite(birth.getTime())) return null;
  const today = new Date();
  let months = (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth();
  if (today.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
}

function timeAgo(value?: string, now = Date.now()) {
  if (!value) return "No entries yet";
  const minutes = Math.max(0, Math.round((now - new Date(value).getTime()) / 60_000));
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

function activityTitle(activity: Activity) {
  if (activity.type === "bottle") return "Bottle";
  if (activity.type === "nursing") return "Nursing";
  if (activity.type === "sleep") return activity.endedAt ? "Sleep" : "Sleeping now";
  if (activity.type === "growth") return "Growth check";
  if (activity.type === "health") return activity.temperatureC ? "Temperature" : "Health note";
  if (activity.diaperKind === "both") return "Wet + dirty diaper";
  return activity.diaperKind === "dirty" ? "Dirty diaper" : "Wet diaper";
}

function includeNote(detail: string, note?: string) {
  return note?.trim() ? `${detail} · ${note.trim()}` : detail;
}

function activityDetail(activity: Activity) {
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
  return includeNote("Quick logged", activity.note);
}

function ActivityGlyph({ type }: { type: ActivityType }) {
  if (type === "bottle") return <Milk size={19} strokeWidth={2.1} />;
  if (type === "nursing") return <Heart size={19} strokeWidth={2.1} />;
  if (type === "sleep") return <Moon size={19} strokeWidth={2.1} />;
  if (type === "growth") return <Weight size={19} strokeWidth={2.1} />;
  if (type === "health") return <Stethoscope size={19} strokeWidth={2.1} />;
  return <Droplet size={19} strokeWidth={2.1} />;
}

export default function HomePage() {
  const [bootState, setBootState] = useState<BootState>("loading");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [activeTab, setActiveTab] = useState<Tab>("today");
  const [sheet, setSheet] = useState<Sheet>(null);
  const [bottleAmount, setBottleAmount] = useState(90);
  const [milkType, setMilkType] = useState<"formula" | "expressed">("formula");
  const [entryNote, setEntryNote] = useState("");
  const [weightGrams, setWeightGrams] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [headCm, setHeadCm] = useState("");
  const [temperatureC, setTemperatureC] = useState("");
  const [logTime, setLogTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [nursingSide, setNursingSide] = useState<"left" | "right">("left");
  const [diaperKind, setDiaperKind] = useState<DiaperKind>("wet");
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [nightMode, setNightMode] = useState(false);
  const [reminders, setReminders] = useState<ReminderSettings>(DEFAULT_REMINDERS);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    () => "Notification" in window ? Notification.permission : "unsupported",
  );
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const [timelineFilter, setTimelineFilter] = useState<"all" | ActivityType>("all");
  const [timelineLimit, setTimelineLimit] = useState(80);
  const [minuteClock, setMinuteClock] = useState(Date.now);
  const [sidebarDefaultOpen] = useState(() => !document.cookie.split("; ").includes("sidebar_state=false"));
  const importRef = useRef<HTMLInputElement>(null);
  const invalidFieldRef = useRef<HTMLInputElement>(null);
  const sheetTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const update = () => setMinuteClock(Date.now());
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") update();
    }, 60_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", nightMode);
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute("content", nightMode ? "#171c1a" : "#f7f7f5");
  }, [nightMode]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      try {
        const saved = window.localStorage.getItem(STORAGE_KEY);
        if (saved) {
          try {
            const parsed = parseStoredData(saved);
            setNightMode(Boolean(parsed.nightMode));
            setReminders(parsed.reminders ?? DEFAULT_REMINDERS);
            if (parsed.legacyDemo || !parsed.onboardingComplete) {
              setActivities([]);
              setProfile(EMPTY_PROFILE);
              setBootState("onboarding");
            } else {
              setActivities(parsed.activities);
              setProfile(parsed.profile);
              setBootState("ready");
            }
          } catch {
            try {
              window.localStorage.setItem(RECOVERY_KEY, saved);
            } catch {
              // The original value remains untouched when recovery storage is unavailable.
            }
            setStorageWarning("Your saved data could not be read. It was not overwritten.");
            setActivities([]);
            setProfile(EMPTY_PROFILE);
            setBootState("recovery");
          }
        } else {
          setProfile(EMPTY_PROFILE);
          setActivities([]);
          setBootState("onboarding");
        }
      } catch {
        setStorageWarning("This browser is blocking local storage. New entries may not persist.");
        setActivities([]);
        setProfile(EMPTY_PROFILE);
        setBootState("onboarding");
      }
      navigator.storage?.persist?.().catch(() => undefined);
    });

    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const syncFromAnotherTab = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      if (!event.newValue) {
        setActivities([]);
        setProfile(EMPTY_PROFILE);
        setBootState("onboarding");
        return;
      }
      try {
        const parsed = parseStoredData(event.newValue);
        setNightMode(Boolean(parsed.nightMode));
        setReminders(parsed.reminders ?? DEFAULT_REMINDERS);
        if (parsed.legacyDemo || !parsed.onboardingComplete) {
          setActivities([]);
          setProfile(EMPTY_PROFILE);
          setBootState("onboarding");
        } else {
          setActivities(parsed.activities);
          setProfile(parsed.profile);
          setBootState("ready");
        }
      } catch {
        setStorageWarning("A change from another tab could not be read. This tab kept its current data.");
      }
    };
    window.addEventListener("storage", syncFromAnotherTab);
    return () => window.removeEventListener("storage", syncFromAnotherTab);
  }, []);

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
  const sleepMinutesToday = sortedActivities
    .filter((activity) => activity.type === "sleep")
    .reduce((sum, activity) => sum + minutesOnDay(activity, new Date()), 0);
  const lastFeed = sortedActivities.find(
    (activity) => activity.type === "bottle" || activity.type === "nursing",
  );
  const feedReminderTargetAt = lastFeed
    ? new Date(lastFeed.startedAt).getTime() + reminders.feedIntervalMinutes * 60_000
    : null;

  useEffect(() => {
    if (
      !reminders.feedEnabled ||
      notificationPermission !== "granted" ||
      !feedReminderTargetAt ||
      !("serviceWorker" in navigator)
    ) return;

    const delay = feedReminderTargetAt - Date.now();
    if (delay <= 0) return;
    const timer = window.setTimeout(() => {
      void navigator.serviceWorker.ready
        .then((registration) => registration.showNotification("Time to check feeding cues", {
          body: `${profile.name}’s feed reminder is due. Follow your baby’s cues and care plan.`,
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: `feed-reminder-${lastFeed?.id ?? "latest"}`,
          data: { url: "/" },
        }))
        .catch(() => undefined);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [feedReminderTargetAt, lastFeed?.id, notificationPermission, profile.name, reminders.feedEnabled]);

  const activeSleep = sortedActivities.find(
    (activity) => activity.type === "sleep" && !activity.endedAt,
  );
  const activeNursing = sortedActivities.find(
    (activity) => activity.type === "nursing" && !activity.endedAt,
  );
  const activeTimers = [activeNursing, activeSleep].filter(
    (activity): activity is Activity => Boolean(activity),
  );
  const growthEntries = useMemo(
    () =>
      sortedActivities
        .filter((activity) => activity.type === "growth" && activity.weightGrams)
        .sort(
          (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
        ),
    [sortedActivities],
  );
  const latestGrowth = growthEntries[growthEntries.length - 1];
  const previousGrowth = growthEntries[growthEntries.length - 2];
  const weightChange =
    latestGrowth?.weightGrams && previousGrowth?.weightGrams
      ? latestGrowth.weightGrams - previousGrowth.weightGrams
      : 0;

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
    return median(feedingGaps);
  }, [feedingGaps]);

  const completedSleeps = useMemo(
    () => sortedActivities
      .filter((activity) => activity.type === "sleep" && activity.endedAt)
      .slice(0, 24),
    [sortedActivities],
  );
  const wakeGaps = useMemo(() => {
    const chronological = [...completedSleeps].sort(
      (a, b) => new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime(),
    );
    return chronological
      .slice(1)
      .map((sleep, index) => Math.round(
        (new Date(sleep.startedAt).getTime() - new Date(chronological[index].endedAt!).getTime()) / 60_000,
      ))
      .filter((minutes) => minutes >= 20 && minutes <= 360);
  }, [completedSleeps]);
  const typicalWakeGap = useMemo(() => median(wakeGaps), [wakeGaps]);

  const feedPatternReady = feedingGaps.length >= 3 && Boolean(lastFeed);
  const feedSpread = feedPatternReady
    ? Math.max(15, Math.min(45, median(feedingGaps.map((gap) => Math.abs(gap - typicalGap)))))
    : 20;
  const nextFeedAt = feedPatternReady && lastFeed
    ? new Date(lastFeed.startedAt).getTime() + typicalGap * 60_000
    : null;

  const lastCompletedSleep = completedSleeps[0];
  const sleepPatternReady = wakeGaps.length >= 2 && Boolean(lastCompletedSleep);
  const sleepSpread = sleepPatternReady
    ? Math.max(15, Math.min(40, median(wakeGaps.map((gap) => Math.abs(gap - typicalWakeGap)))))
    : 20;
  const nextSleepAt = sleepPatternReady && lastCompletedSleep?.endedAt
    ? new Date(lastCompletedSleep.endedAt).getTime() + typicalWakeGap * 60_000
    : null;
  const forecastFeedSheet: "bottle" | "nursing" = profile.feedingMode === "breast"
    ? "nursing"
    : profile.feedingMode === "bottle"
      ? "bottle"
      : lastFeed?.type === "nursing" ? "nursing" : "bottle";

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
        sleep: sortedActivities
          .filter((activity) => activity.type === "sleep")
          .reduce((sum, activity) => sum + minutesOnDay(activity, date), 0),
      };
    });
  }, [sortedActivities]);

  const filteredTimeline = useMemo(
    () => sortedActivities.filter((activity) => timelineFilter === "all" || activity.type === timelineFilter),
    [sortedActivities, timelineFilter],
  );
  const timelineGroups = useMemo(() => {
    const groups = new Map<string, Activity[]>();
    filteredTimeline.slice(0, timelineLimit).forEach((activity) => {
      const date = new Date(activity.startedAt);
      const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
      const current = groups.get(key) ?? [];
      current.push(activity);
      groups.set(key, current);
    });
    return [...groups.values()];
  }, [filteredTimeline, timelineLimit]);
  const babyAgeMonths = ageInMonths(profile.birthDate);

  const maxMl = Math.max(...weekly.map((day) => day.ml), 1);
  const averageFeeds = Math.round(
    weekly.reduce((sum, day) => sum + day.feeds.length, 0) / weekly.length,
  );

  function showToast(message: string, undo?: () => void) {
    toast(message, {
      duration: 4_200,
      action: undo ? { label: "Undo", onClick: undo } : undefined,
    });
  }

  function persistSnapshot(
    nextActivities: Activity[],
    nextProfile: Profile = profile,
    nextNightMode: boolean = nightMode,
    nextReminders: ReminderSettings = reminders,
    nextOnboardingComplete: boolean = bootState === "ready",
  ) {
    try {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ activities: nextActivities, profile: nextProfile, nightMode: nextNightMode, reminders: nextReminders, onboardingComplete: nextOnboardingComplete }),
      );
      setStorageWarning(null);
      return true;
    } catch {
      setStorageWarning("This browser could not save the latest change. Your previous data is still intact.");
      showToast("Could not save on this device. Nothing was changed.");
      return false;
    }
  }

  function addActivity(activity: Activity, message: string) {
    const previous = activities;
    const previousProfile = profile;
    const nextProfile = profile;
    const next = [activity, ...activities];
    if (!persistSnapshot(next, nextProfile)) return false;
    setActivities(next);
    setProfile(nextProfile);
    showToast(message, () => {
      if (!persistSnapshot(previous, previousProfile)) return;
      setActivities(previous);
      setProfile(previousProfile);
      showToast("Last change undone");
    });
    return true;
  }

  function openSheet(next: Exclude<Sheet, null>) {
    sheetTriggerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setLogTime(localDateInput(new Date()));
    setEndTime("");
    setEntryNote("");
    setFormError(null);
    setEditingActivity(null);
    if (next === "nursing") setNursingSide("left");
    if (next === "diaper") setDiaperKind("wet");
    if (next === "growth") {
      setWeightGrams("");
      setLengthCm("");
      setHeadCm("");
    }
    if (next === "health") setTemperatureC("");
    setSheet(next);
  }

  function showFormError(message: string) {
    setFormError(message);
    window.requestAnimationFrame(() => invalidFieldRef.current?.focus());
  }

  function openEdit(activity: Activity) {
    sheetTriggerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setEditingActivity(activity);
    setLogTime(localDateInput(new Date(activity.startedAt)));
    setEndTime(activity.endedAt ? localDateInput(new Date(activity.endedAt)) : "");
    setEntryNote(activity.note ?? "");
    setBottleAmount(activity.amount ?? 90);
    setMilkType(activity.milkType ?? "formula");
    setNursingSide(activity.side ?? "left");
    setDiaperKind(activity.diaperKind ?? "wet");
    setWeightGrams(activity.weightGrams ? String(activity.weightGrams) : "");
    setLengthCm(activity.lengthCm ? String(activity.lengthCm) : "");
    setHeadCm(activity.headCm ? String(activity.headCm) : "");
    setTemperatureC(activity.temperatureC ? String(activity.temperatureC) : "");
    setFormError(null);
    setSheet("edit");
  }

  function saveEditedActivity() {
    if (!editingActivity) return;
    const start = new Date(logTime);
    const end = endTime ? new Date(endTime) : null;
    if (!Number.isFinite(start.getTime()) || start.getTime() > Date.now()) {
      showFormError("Choose a valid start time that is not in the future.");
      return;
    }
    if (end && (!Number.isFinite(end.getTime()) || end.getTime() < start.getTime() || end.getTime() > Date.now())) {
      showFormError("The end time must be after the start and not in the future.");
      return;
    }

    const next: Activity = {
      ...editingActivity,
      startedAt: start.toISOString(),
      endedAt: editingActivity.type === "sleep" || editingActivity.type === "nursing"
        ? end?.toISOString()
        : undefined,
      note: entryNote.trim() || undefined,
    };

    if (next.type === "bottle") {
      if (!Number.isFinite(bottleAmount) || bottleAmount < 1 || bottleAmount > 1_000) {
        showFormError("Enter a bottle amount between 1 and 1,000 ml.");
        return;
      }
      next.amount = Math.round(bottleAmount);
      next.milkType = milkType;
    }
    if (next.type === "nursing") next.side = nursingSide;
    if (next.type === "diaper") next.diaperKind = diaperKind;
    if (next.type === "growth") {
      const weight = Number(weightGrams);
      const length = lengthCm ? Number(lengthCm) : undefined;
      const head = headCm ? Number(headCm) : undefined;
      if (!Number.isFinite(weight) || weight < 500 || weight > 30_000) {
        showFormError("Enter a weight between 500 and 30,000 grams.");
        return;
      }
      if (length !== undefined && (!Number.isFinite(length) || length < 20 || length > 130)) {
        showFormError("Enter a length between 20 and 130 centimetres.");
        return;
      }
      if (head !== undefined && (!Number.isFinite(head) || head < 20 || head > 80)) {
        showFormError("Enter a head measurement between 20 and 80 centimetres.");
        return;
      }
      next.weightGrams = Math.round(weight);
      next.lengthCm = length === undefined ? undefined : Math.round(length * 10) / 10;
      next.headCm = head === undefined ? undefined : Math.round(head * 10) / 10;
    }
    if (next.type === "health") {
      const temperature = temperatureC ? Number(temperatureC) : undefined;
      if (temperature === undefined && !next.note) {
        showFormError("Add a temperature or a note.");
        return;
      }
      if (temperature !== undefined && (!Number.isFinite(temperature) || temperature < 30 || temperature > 45)) {
        showFormError("Enter a temperature between 30 and 45 °C.");
        return;
      }
      next.temperatureC = temperature === undefined ? undefined : Math.round(temperature * 10) / 10;
    }

    const nextActivities = activities.map((activity) => activity.id === next.id ? next : activity);
    if (!persistSnapshot(nextActivities)) return;
    setActivities(nextActivities);
    setSheet(null);
    showToast(`${activityTitle(next)} updated`);
  }

  function saveBottle() {
    const entry: Activity = {
      id: makeId(),
      type: "bottle",
      startedAt: new Date(logTime || Date.now()).toISOString(),
      amount: bottleAmount,
      milkType,
      note: entryNote.trim() || undefined,
    };
    if (addActivity(entry, `${bottleAmount} ml bottle saved`)) setSheet(null);
  }

  function startNursing(side: "left" | "right") {
    const entry: Activity = {
      id: makeId(),
      type: "nursing",
      startedAt: new Date(logTime || Date.now()).toISOString(),
      side,
      note: entryNote.trim() || undefined,
    };
    if (addActivity(entry, `${side === "left" ? "Left" : "Right"} timer started`)) setSheet(null);
  }

  function stopNursing() {
    if (!activeNursing) return;
    const nextActivities = activities.map((activity) =>
        activity.id === activeNursing.id
          ? { ...activity, endedAt: new Date().toISOString() }
          : activity,
    );
    if (!persistSnapshot(nextActivities)) return;
    setActivities(nextActivities);
    showToast("Nursing session saved");
  }

  function saveDiaper(kind: DiaperKind) {
    const entry: Activity = {
      id: makeId(),
      type: "diaper",
      diaperKind: kind,
      startedAt: new Date(logTime || Date.now()).toISOString(),
      note: entryNote.trim() || undefined,
    };
    if (addActivity(entry, `${kind === "both" ? "Wet + dirty" : kind === "dirty" ? "Dirty" : "Wet"} diaper saved`)) setSheet(null);
  }

  function saveGrowth() {
    const weight = Number(weightGrams);
    const length = lengthCm ? Number(lengthCm) : undefined;
    const head = headCm ? Number(headCm) : undefined;

    if (!Number.isFinite(weight) || weight < 500 || weight > 30_000) {
      showFormError("Enter a weight between 500 and 30,000 grams.");
      return;
    }
    if (length !== undefined && (!Number.isFinite(length) || length < 20 || length > 130)) {
      showFormError("Enter a length between 20 and 130 centimetres.");
      return;
    }
    if (head !== undefined && (!Number.isFinite(head) || head < 20 || head > 80)) {
      showFormError("Enter a head measurement between 20 and 80 centimetres.");
      return;
    }

    const entry: Activity = {
      id: makeId(),
      type: "growth",
      startedAt: new Date(logTime || Date.now()).toISOString(),
      weightGrams: Math.round(weight),
      lengthCm: length === undefined ? undefined : Math.round(length * 10) / 10,
      headCm: head === undefined ? undefined : Math.round(head * 10) / 10,
      note: entryNote.trim() || undefined,
    };
    if (addActivity(entry, `${(weight / 1_000).toFixed(2)} kg saved`)) setSheet(null);
  }

  function saveHealthNote() {
    const temperature = temperatureC ? Number(temperatureC) : undefined;
    const note = entryNote.trim();

    if (temperature === undefined && !note) {
      showFormError("Add a temperature or a note.");
      return;
    }
    if (
      temperature !== undefined &&
      (!Number.isFinite(temperature) || temperature < 30 || temperature > 45)
    ) {
      showFormError("Enter a temperature between 30 and 45 °C.");
      return;
    }

    const entry: Activity = {
      id: makeId(),
      type: "health",
      startedAt: new Date(logTime || Date.now()).toISOString(),
      temperatureC:
        temperature === undefined ? undefined : Math.round(temperature * 10) / 10,
      note: note || undefined,
    };
    if (addActivity(entry, temperature === undefined ? "Health note saved" : "Temperature saved")) setSheet(null);
  }

  function toggleSleep() {
    if (activeSleep) {
      const nextActivities = activities.map((activity) =>
          activity.id === activeSleep.id
            ? { ...activity, endedAt: new Date().toISOString() }
            : activity,
      );
      if (!persistSnapshot(nextActivities)) return;
      setActivities(nextActivities);
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
    const previous = activities;
    const next = previous.filter((item) => item.id !== activity.id);
    if (!persistSnapshot(next)) return false;
    setActivities(next);
    showToast("Entry removed", () => {
      if (!persistSnapshot(previous)) return;
      setActivities(previous);
      showToast("Entry restored");
    });
    return true;
  }

  function changeNightMode(enabled: boolean) {
    if (!persistSnapshot(activities, profile, enabled)) return;
    setNightMode(enabled);
  }

  function saveProfile(nextProfile: Profile) {
    if (!persistSnapshot(activities, nextProfile)) return false;
    setProfile(nextProfile);
    return true;
  }

  function completeOnboarding(nextProfile: Profile) {
    if (!persistSnapshot([], nextProfile, nightMode, reminders, true)) return false;
    setActivities([]);
    setProfile(nextProfile);
    setStorageWarning(null);
    setBootState("ready");
    return true;
  }

  async function changeFeedReminders(enabled: boolean) {
    if (!enabled) {
      const next = { ...reminders, feedEnabled: false };
      if (!persistSnapshot(activities, profile, nightMode, next)) return;
      setReminders(next);
      showToast("Feed reminders off");
      return;
    }

    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setNotificationPermission("unsupported");
      showToast("Notifications are not supported in this browser");
      return;
    }

    const permission = Notification.permission === "default"
      ? await Notification.requestPermission()
      : Notification.permission;
    setNotificationPermission(permission);
    if (permission !== "granted") {
      showToast("Notifications were not enabled. You can allow them in browser settings.");
      return;
    }

    const next = { ...reminders, feedEnabled: true };
    if (!persistSnapshot(activities, profile, nightMode, next)) return;
    setReminders(next);
    showToast("Feed reminders on");
  }

  function changeFeedReminderInterval(minutes: number) {
    if (![120, 180, 240].includes(minutes)) return;
    const next = { ...reminders, feedIntervalMinutes: minutes };
    if (!persistSnapshot(activities, profile, nightMode, next)) return;
    setReminders(next);
  }

  function exportData() {
    const payload = JSON.stringify({ profile, activities, nightMode, reminders, onboardingComplete: true, exportedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `baby-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("Private backup downloaded");
  }

  function downloadRecovery() {
    try {
      const raw = window.localStorage.getItem(RECOVERY_KEY) ?? window.localStorage.getItem(STORAGE_KEY);
      if (!raw) throw new Error("No recovery data");
      const blob = new Blob([raw], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `baby-tracker-recovery-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      showToast("Recovery data is unavailable in this browser");
    }
  }

  function resetUnreadableData() {
    if (!window.confirm("Reset the unreadable local copy? Download recovery first if you may need it.")) return;
    try {
      window.localStorage.removeItem(STORAGE_KEY);
      setActivities([]);
      setProfile(EMPTY_PROFILE);
      setStorageWarning(null);
      setBootState("onboarding");
      showToast("Local copy reset. Start with a clean tracker.");
    } catch {
      showToast("This browser is still blocking local storage");
    }
  }

  function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      showToast("That backup is too large to import safely");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = parseStoredData(String(reader.result));
        if (bootState === "ready" && !window.confirm("Replace the current timeline with this backup? This cannot be undone unless you download the current backup first.")) {
          return;
        }
        let recoveryCreated = true;
        if (bootState === "ready") {
          try {
            window.localStorage.setItem(
              RECOVERY_KEY,
              JSON.stringify({ profile, activities, nightMode, reminders, onboardingComplete: true }),
            );
          } catch {
            recoveryCreated = false;
          }
        }
        if (!recoveryCreated && !window.confirm("This browser cannot create a recovery copy. Restore anyway and replace the current timeline without rollback?")) {
          return;
        }
        if (parsed.legacyDemo) throw new Error("Preview backups are not importable");
        const nextProfile = parsed.profile;
        const nextReminders = parsed.reminders ?? DEFAULT_REMINDERS;
        if (!persistSnapshot(parsed.activities, nextProfile, Boolean(parsed.nightMode), nextReminders, true)) return;
        setProfile(nextProfile);
        setActivities(parsed.activities);
        setNightMode(Boolean(parsed.nightMode));
        setReminders(nextReminders);
        setStorageWarning(null);
        setBootState("ready");
        showToast("Backup restored");
      } catch {
        showToast("That backup could not be read");
      }
    };
    reader.onerror = () => showToast("That backup could not be opened");
    reader.readAsText(file);
    event.target.value = "";
  }

  if (bootState === "loading") {
    return (
      <main className="loading-screen" aria-label="Loading Baby Tracker">
        <div className="brand-mark"><Baby size={24} /></div>
        <span>Baby Tracker</span>
      </main>
    );
  }

  if (bootState === "onboarding" || bootState === "recovery") {
    return (
      <OnboardingScreen
        mode={bootState}
        profile={profile}
        nightMode={nightMode}
        storageWarning={storageWarning}
        onNightModeChange={changeNightMode}
        onComplete={completeOnboarding}
        onRestore={(event) => importData(event)}
        onDownloadRecovery={downloadRecovery}
        onResetRecovery={resetUnreadableData}
      />
    );
  }

  return (
    <SidebarProvider defaultOpen={sidebarDefaultOpen} className="numa-shell">
      <AppSidebar
        activeTab={activeTab}
        onNavigate={setActiveTab}
        profile={profile}
        onProfile={() => openSheet("profile")}
        nightMode={nightMode}
        onNightModeChange={changeNightMode}
      />
      <SidebarInset className="app-frame">
        <header className="topbar">
          <div className="topbar-start">
            <SidebarTrigger className="sidebar-trigger" aria-label="Open navigation" />
            <Separator orientation="vertical" className="topbar-separator" />
            <span className="topbar-page-title">
              {activeTab === "more" ? "Settings" : activeTab[0].toUpperCase() + activeTab.slice(1)}
            </span>
            <div className="wordmark" aria-label="Baby Tracker">
              <span className="wordmark-mark"><Baby size={20} /></span>
              <span className="wordmark-copy">
                <strong>Baby Tracker</strong>
                <small>Private family log</small>
              </span>
            </div>
          </div>
          <Button variant="ghost" className="baby-identity" onClick={() => openSheet("profile")}>
            <span className="baby-avatar"><Baby size={19} /></span>
            <span>
              <strong>{profile.name}</strong>
              <small>Your private log</small>
            </span>
            <ChevronRight size={16} />
          </Button>
        </header>

        {storageWarning && (
          <div className="banner-stack">
            <div className="storage-banner" role="alert">
              <ShieldCheck size={19} />
              <span><strong>Local data needs attention.</strong> {storageWarning}</span>
              <div>
                <Button onClick={downloadRecovery}>Download recovery</Button>
                <Button onClick={resetUnreadableData}>Reset local copy</Button>
              </div>
            </div>
          </div>
        )}

        <main className="content">
          {activeTab === "today" && (
            <section className="screen today-screen" aria-labelledby="today-heading">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Today</p>
                  <h1 id="today-heading">{greeting()}, {profile.name}.</h1>
                  <p className="page-subtitle">Everything that matters today, without having to remember it.</p>
                </div>
              </div>

              <div className="today-dashboard">
                <div className="today-primary">
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

              <Card size="sm" className="now-card">
                <CardHeader className="now-card-top">
                  <Badge variant="secondary" className="status-pill"><span /> Last feed</Badge>
                  <span className="now-time">{lastFeed ? formatTime(lastFeed.startedAt) : "—"}</span>
                </CardHeader>
                <CardContent className="now-main">
                  <div>
                    <strong>{timeAgo(lastFeed?.startedAt, minuteClock)}</strong>
                    <p>{lastFeed ? `${activityTitle(lastFeed)} · ${activityDetail(lastFeed)}` : "Log the first feed when it happens."}</p>
                  </div>
                  <Milk size={36} strokeWidth={1.7} />
                </CardContent>
                {typicalGap > 0 && (
                  <CardFooter className="usual-row">
                    <Clock size={15} />
                    <span>Usual gap from your logs: {humanDuration(typicalGap)}</span>
                  </CardFooter>
                )}
              </Card>

              <Card size="sm" className="summary-grid" aria-label="Today's summary">
                <div><strong>{feedsToday.length}</strong><span>feeds</span></div>
                <div><strong>{bottleMlToday}</strong><span>ml logged</span></div>
                <div><strong>{diapersToday}</strong><span>diapers</span></div>
                <div><strong>{humanDuration(sleepMinutesToday)}</strong><span>sleep</span></div>
              </Card>

              <Card size="sm" className="care-forecast" aria-labelledby="care-forecast-title">
                <CardHeader className="care-forecast-heading">
                  <div>
                    <p>From {profile.name}’s rhythm</p>
                    <CardTitle id="care-forecast-title">What may be next</CardTitle>
                  </div>
                  <CardAction><Badge variant="outline">On-device</Badge></CardAction>
                </CardHeader>
                <CardContent className="forecast-grid">
                  <div className="forecast-item forecast-feed">
                    <span className="forecast-icon"><Milk size={21} /></span>
                    <div className="forecast-copy">
                      <span>Next likely feed</span>
                      <strong>{nextFeedAt ? forecastRelative(nextFeedAt, minuteClock) : "Learning the pattern"}</strong>
                      <small>{nextFeedAt
                        ? `${forecastRange(nextFeedAt, feedSpread)} · ${feedingGaps.length + 1} recent feeds`
                        : "Log at least 4 feeds to estimate a window"}</small>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => openSheet(forecastFeedSheet)}>Log</Button>
                  </div>
                  <div className="forecast-item forecast-sleep">
                    <span className="forecast-icon"><Moon size={21} /></span>
                    <div className="forecast-copy">
                      <span>{activeSleep ? "Current sleep" : "Next likely sleep"}</span>
                      <strong>{activeSleep
                        ? "Sleeping now"
                        : nextSleepAt ? forecastRelative(nextSleepAt, minuteClock) : "Learning the pattern"}</strong>
                      <small>{activeSleep
                        ? `Started ${formatTime(activeSleep.startedAt)}`
                        : nextSleepAt
                          ? `${forecastRange(nextSleepAt, sleepSpread)} · ${wakeGaps.length + 1} wake periods`
                          : "Log at least 3 complete sleeps to estimate a window"}</small>
                    </div>
                    <Button variant="outline" size="sm" onClick={toggleSleep}>{activeSleep ? "Stop" : "Start"}</Button>
                  </div>
                </CardContent>
                <CardFooter className="forecast-guidance">
                  <span><Clock size={15} /> Patterns, not a schedule — cues and your clinician’s care plan come first.</span>
                  <span><ShieldCheck size={15} /> Safe sleep: back, firm flat surface, clear sleep space.</span>
                </CardFooter>
              </Card>

              <div className="recent-section">
                <div className="mini-heading">
                  <h2>Recent</h2>
                  <Button onClick={() => setActiveTab("timeline")}>See all <ChevronRight size={15} /></Button>
                </div>
                <Card size="sm" className="activity-list recent-list">
                  <CardContent className="activity-list-content">
                    <ItemGroup>
                      {sortedActivities.slice(0, 6).map((activity, index) => (
                        <div role="listitem" key={activity.id}>
                          {index > 0 && <ItemSeparator />}
                          <ActivityRow activity={activity} onEdit={openEdit} />
                        </div>
                      ))}
                    </ItemGroup>
                    {!sortedActivities.length && <EmptyState text="Your day will appear here as you log it." />}
                  </CardContent>
                </Card>
              </div>
                </div>

              <Card size="sm" className="quick-section">
                <CardHeader className="quick-section-header">
                  <div>
                    <CardTitle>Quick log</CardTitle>
                    <CardDescription>One tap now. Details only when you need them.</CardDescription>
                  </div>
                  <CardAction><Badge variant="secondary">Private</Badge></CardAction>
                </CardHeader>
                <CardContent className="quick-section-content">
                  <ItemGroup className="action-grid">
                  {profile.feedingMode !== "breast" && (
                    <QuickAction
                      className="action-feed"
                      title="Bottle"
                      description="Log amount and milk"
                      icon={<Milk />}
                      onClick={() => openSheet("bottle")}
                    />
                  )}
                  {profile.feedingMode !== "bottle" && (
                    <QuickAction
                      className="action-nurse"
                      title={activeNursing ? "Stop nursing" : "Nursing"}
                      description={activeNursing ? liveDuration(activeNursing.startedAt, minuteClock) : "Start a side timer"}
                      icon={<Heart />}
                      onClick={activeNursing ? stopNursing : () => openSheet("nursing")}
                      trailing={activeNursing ? <Square fill="currentColor" /> : <Plus />}
                    />
                  )}
                  <QuickAction
                    className="action-diaper"
                    title="Diaper"
                    description="Wet, dirty, or both"
                    icon={<Droplet />}
                    onClick={() => openSheet("diaper")}
                  />
                  <QuickAction
                    className={`action-sleep ${activeSleep ? "is-active" : ""}`}
                    title={activeSleep ? "Wake up" : "Sleep"}
                    description={activeSleep ? liveDuration(activeSleep.startedAt, minuteClock) : "Start sleep timer"}
                    icon={<Moon />}
                    onClick={toggleSleep}
                    trailing={activeSleep ? <Square fill="currentColor" /> : <Plus />}
                  />
                  </ItemGroup>
                  <Separator />
                  <ItemGroup className="secondary-actions" aria-label="Measurements and health">
                    <QuickAction className="action-growth" title="Growth" description="Weight, length, head" icon={<Weight />} onClick={() => openSheet("growth")} trailing={<ChevronRight />} />
                    <QuickAction className="action-health" title="Health note" description="Temperature or note" icon={<Thermometer />} onClick={() => openSheet("health")} trailing={<ChevronRight />} />
                  </ItemGroup>
                </CardContent>
              </Card>

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
                <Badge variant="outline" className="count-badge">{filteredTimeline.length} logs</Badge>
              </div>
              <ToggleGroup
                type="single"
                value={timelineFilter}
                className="filter-row"
                aria-label="Filter timeline"
                onValueChange={(value) => {
                  if (!value) return;
                  setTimelineFilter(value as "all" | ActivityType);
                  setTimelineLimit(80);
                }}
              >
                {(["all", "bottle", "nursing", "diaper", "sleep", "growth", "health"] as const).map((filter) => (
                  <ToggleGroupItem
                    key={filter}
                    value={filter}
                    aria-label={`Show ${filter} logs`}
                  >
                    {filter === "all" ? "All" : filter[0].toUpperCase() + filter.slice(1)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <div className="timeline-date"><span>Latest first</span><span>Open any entry to correct its details</span></div>
              <div className="timeline-groups">
                {timelineGroups.map((group) => (
                  <section className="timeline-day" key={new Date(group[0].startedAt).toDateString()}>
                    <div className="timeline-day-heading">
                      <h2>{formatTimelineDay(group[0].startedAt)}</h2>
                      <span>{group.length} {group.length === 1 ? "log" : "logs"}</span>
                    </div>
                    <Card size="sm" className="activity-list timeline-list">
                      <CardContent className="activity-list-content">
                        <ItemGroup>
                          {group.map((activity, index) => (
                            <div role="listitem" key={activity.id}>
                              {index > 0 && <ItemSeparator />}
                              <ActivityRow activity={activity} onEdit={openEdit} />
                            </div>
                          ))}
                        </ItemGroup>
                      </CardContent>
                    </Card>
                  </section>
                ))}
                {!filteredTimeline.length && <EmptyState text="No matching logs yet." />}
              </div>
              {filteredTimeline.length > timelineLimit && (
                <Button className="load-more" onClick={() => setTimelineLimit((value) => value + 80)}>
                  Show more entries
                </Button>
              )}
            </section>
          )}

          {activeTab === "insights" && (
            <section className="screen insights-screen" aria-labelledby="insights-heading">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Last 7 days</p>
                  <h1 id="insights-heading">Patterns, calmly</h1>
                </div>
              </div>

              <Card size="sm" className="insight-summary">
                <div><span>Typical feed gap</span><strong>{typicalGap ? humanDuration(typicalGap) : "—"}</strong></div>
                <div><span>Feeds / day</span><strong>{averageFeeds}</strong></div>
                <div><span>Today’s bottle</span><strong>{bottleMlToday} ml</strong></div>
                <div><span>Latest weight</span><strong>{latestGrowth?.weightGrams ? `${(latestGrowth.weightGrams / 1_000).toFixed(2)} kg` : "—"}</strong></div>
              </Card>

              <Card size="sm" className="chart-card">
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
              </Card>

              <Card size="sm" className="chart-card rhythm-card">
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
              </Card>

              <GrowthChart activities={growthEntries} change={weightChange} onAdd={() => openSheet("growth")} />

              <Card className="gentle-note">
                <ShieldCheck size={20} />
                <p><strong>Useful, not judgmental.</strong> Baby Tracker summarizes what you logged. It never scores your parenting or replaces medical advice.</p>
              </Card>
            </section>
          )}

          {activeTab === "more" && (
            <section className="screen more-screen" aria-labelledby="more-heading">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">Device & data</p>
                  <h1 id="more-heading">Settings</h1>
                  <p className="page-subtitle">Profile, privacy and backups in one place.</p>
                </div>
                <div className="theme-switch">
                  <span>{nightMode ? <Moon size={17} /> : <Sun size={17} />} Dark mode</span>
                  <Switch checked={nightMode} onCheckedChange={changeNightMode} aria-label="Use night mode" />
                </div>
              </div>

              <Card className="privacy-card">
                <span><ShieldCheck size={25} /></span>
                <div><strong>Private on this device</strong><p>Your baby’s entries stay in this browser. Export a backup anytime.</p></div>
                <Check size={19} />
              </Card>

              <Card className="settings-group">
                <CardHeader>
                  <CardTitle>Baby profile</CardTitle>
                  <CardDescription>The details used to personalise your tracker.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ItemGroup>
                    <SettingsAction title={profile.name} description={`${profile.feedingMode} feeding`} icon={<Baby />} onClick={() => openSheet("profile")} />
                  </ItemGroup>
                </CardContent>
              </Card>

              <Card className="settings-group reminder-settings">
                <CardHeader>
                  <CardTitle>Care reminders</CardTitle>
                  <CardDescription>Optional prompts, scheduled privately on this device.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ItemGroup>
                    <Item size="sm" className="reminder-row">
                      <ItemMedia variant="icon" className="glyph-bottle"><Bell /></ItemMedia>
                      <ItemContent>
                        <ItemTitle>Feed reminder</ItemTitle>
                        <ItemDescription>
                          {notificationPermission === "denied"
                            ? "Blocked in browser settings"
                            : reminders.feedEnabled && feedReminderTargetAt && feedReminderTargetAt > minuteClock
                              ? `Next prompt around ${formatTime(new Date(feedReminderTargetAt).toISOString())}`
                              : "Prompt after the next feed you log"}
                        </ItemDescription>
                      </ItemContent>
                      <ItemActions>
                        <Switch
                          checked={reminders.feedEnabled}
                          disabled={notificationPermission === "unsupported"}
                          onCheckedChange={(checked) => void changeFeedReminders(checked)}
                          aria-label="Use feed reminders"
                        />
                      </ItemActions>
                    </Item>
                    {reminders.feedEnabled && (
                      <>
                        <ItemSeparator />
                        <div className="reminder-options">
                          <span>Remind after</span>
                          <ToggleGroup
                            type="single"
                            value={String(reminders.feedIntervalMinutes)}
                            aria-label="Feed reminder interval"
                            onValueChange={(value) => value && changeFeedReminderInterval(Number(value))}
                          >
                            <ToggleGroupItem value="120">2 hours</ToggleGroupItem>
                            <ToggleGroupItem value="180">3 hours</ToggleGroupItem>
                            <ToggleGroupItem value="240">4 hours</ToggleGroupItem>
                          </ToggleGroup>
                          <p>Local reminders work while Baby Tracker remains active. Follow your baby’s cues and clinician’s care plan.</p>
                        </div>
                      </>
                    )}
                  </ItemGroup>
                </CardContent>
              </Card>

              <Card className="settings-group">
                <CardHeader>
                  <CardTitle>Your data</CardTitle>
                  <CardDescription>Portable backups you own and control.</CardDescription>
                </CardHeader>
                <CardContent>
                  <ItemGroup>
                    <SettingsAction title="Download private backup" description="JSON file you control" icon={<Download />} onClick={exportData} />
                    <ItemSeparator />
                    <SettingsAction title="Restore a backup" description="Import from this or another device" icon={<Upload />} onClick={() => importRef.current?.click()} />
                  </ItemGroup>
                </CardContent>
                <Input ref={importRef} className="hidden-input" type="file" accept="application/json" onChange={importData} />
              </Card>

              <Card className="pro-card">
                <div className="pro-kicker"><Users size={17} /> Planned · Family Pro</div>
                <h2>Share care.<br />Keep data private.</h2>
                <p>Encrypted partner sync, shared live timers and automatic backups for the people caring for your baby.</p>
                <div className="pro-feature-list" aria-label="Family Pro features">
                  <Badge variant="outline">Partner sync</Badge><Badge variant="outline">Live timers</Badge><Badge variant="outline">Auto backup</Badge>
                </div>
                <div className="pro-price"><strong>€19.99</strong><span>once · yours forever</span></div>
                <Button onClick={() => showToast("Family Pro is next on the roadmap")}>Coming soon</Button>
              </Card>

              <p className="version-note">Baby Tracker · Local-first and private</p>
            </section>
          )}
        </main>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as Tab)} asChild>
          <nav className="bottom-nav" aria-label="Primary navigation">
            <TabsList className="bottom-nav-list" aria-label="Primary navigation views">
              <NavButton value="today" label="Today" icon={<Home size={20} />} />
              <NavButton value="timeline" label="Timeline" icon={<Clock size={20} />} />
              <NavButton value="insights" label="Insights" icon={<BarChart3 size={20} />} />
              <NavButton value="more" label="Settings" icon={<Settings size={20} />} />
            </TabsList>
          </nav>
        </Tabs>

        <Toaster theme={nightMode ? "dark" : "light"} position="bottom-center" closeButton />

        <Dialog open={Boolean(sheet)} onOpenChange={(open) => { if (!open) setSheet(null); }}>
          {sheet && (
            <DialogContent
              className="bottom-sheet"
              onOpenAutoFocus={(event) => {
                event.preventDefault();
                window.requestAnimationFrame(() => {
                  document.querySelector<HTMLElement>(".bottom-sheet [data-initial-focus]")?.focus();
                });
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                sheetTriggerRef.current?.focus();
              }}
            >
              <div className="sheet-handle" />

              {sheet === "bottle" && (
                <SheetForm onSubmit={saveBottle}>
                  <LogDialogHeader icon={<Milk />} eyebrow="Quick log" title="Bottle" description="Record the amount now; adjust details only if needed." />
                  <Field className="amount-field">
                    <FieldLabel>Amount</FieldLabel>
                    <ButtonGroup className="amount-control" aria-label="Bottle amount">
                      <Button type="button" variant="outline" aria-label="Decrease amount" onClick={() => setBottleAmount((value) => Math.max(10, value - 10))}><Minus /></Button>
                      <ButtonGroupText><strong>{bottleAmount}</strong><span>ml</span></ButtonGroupText>
                      <Button type="button" variant="outline" aria-label="Increase amount" onClick={() => setBottleAmount((value) => Math.min(400, value + 10))}><Plus /></Button>
                    </ButtonGroup>
                  </Field>
                  <ToggleGroup type="single" value={String(bottleAmount)} className="preset-row" onValueChange={(value) => value && setBottleAmount(Number(value))}>
                    {bottlePresets.map((amount, index) => <ToggleGroupItem autoFocus={index === 0} data-initial-focus={index === 0 ? "" : undefined} value={String(amount)} aria-label={`${amount} millilitres`} key={amount}>{amount}</ToggleGroupItem>)}
                  </ToggleGroup>
                  <ToggleGroup type="single" value={milkType} className="segmented" onValueChange={(value) => value && setMilkType(value as "formula" | "expressed")}>
                    <ToggleGroupItem value="formula">Formula</ToggleGroupItem>
                    <ToggleGroupItem value="expressed">Breast milk</ToggleGroupItem>
                  </ToggleGroup>
                  <TimeField value={logTime} onChange={setLogTime} />
                  <NoteField value={entryNote} onChange={setEntryNote} />
                  <DialogFooter><Button type="submit" className="primary-button sheet-primary">Save {bottleAmount} ml</Button></DialogFooter>
                </SheetForm>
              )}

              {sheet === "nursing" && (
                <SheetForm onSubmit={() => startNursing(nursingSide)}>
                  <LogDialogHeader icon={<Heart />} eyebrow="Start timer" title="Which side?" description="The timer keeps running if you close the app." />
                  <ToggleGroup type="single" value={nursingSide} className="side-grid" onValueChange={(value) => value && setNursingSide(value as "left" | "right")}>
                    <ToggleGroupItem autoFocus data-initial-focus value="left"><span>L</span><strong>Left</strong></ToggleGroupItem>
                    <ToggleGroupItem value="right"><span>R</span><strong>Right</strong></ToggleGroupItem>
                  </ToggleGroup>
                  <TimeField value={logTime} onChange={setLogTime} />
                  <NoteField value={entryNote} onChange={setEntryNote} />
                  <p className="sheet-footnote">The timer stays active if you close the app.</p>
                  <DialogFooter><Button type="submit" className="primary-button sheet-primary">Start {nursingSide} timer</Button></DialogFooter>
                </SheetForm>
              )}

              {sheet === "diaper" && (
                <SheetForm onSubmit={() => saveDiaper(diaperKind)}>
                  <LogDialogHeader icon={<Droplet />} eyebrow="Quick log" title="What was it?" description="Choose the closest match and save." />
                  <ToggleGroup type="single" value={diaperKind} className="diaper-grid" onValueChange={(value) => value && setDiaperKind(value as DiaperKind)}>
                    <ToggleGroupItem autoFocus data-initial-focus value="wet"><Droplet size={22} /><strong>Wet</strong></ToggleGroupItem>
                    <ToggleGroupItem value="dirty"><span className="dot-icon">●</span><strong>Dirty</strong></ToggleGroupItem>
                    <ToggleGroupItem value="both"><span className="both-icon"><Droplet size={18} />●</span><strong>Both</strong></ToggleGroupItem>
                  </ToggleGroup>
                  <TimeField value={logTime} onChange={setLogTime} />
                  <NoteField value={entryNote} onChange={setEntryNote} />
                  <DialogFooter><Button type="submit" className="primary-button sheet-primary">Save {diaperKind === "both" ? "wet + dirty" : diaperKind} diaper</Button></DialogFooter>
                </SheetForm>
              )}

              {sheet === "growth" && (
                <SheetForm onSubmit={saveGrowth}>
                  <LogDialogHeader icon={<Weight />} eyebrow="Growth check" title="Add measurement" description="Record measurements consistently to make the trend useful." />
                  <FieldGroup className="measurement-fields">
                    <UnitField label="Weight" value={weightGrams} unit="g" min={500} max={30000} step={1} inputRef={invalidFieldRef} autoFocus invalid={Boolean(formError)} onChange={(value) => { setWeightGrams(value); setFormError(null); }} placeholder="3500" className="measurement-primary" />
                    <div className="measurement-row">
                      <UnitField label="Length" optional value={lengthCm} unit="cm" min={20} max={130} step={0.1} onChange={setLengthCm} placeholder="51.5" />
                      <UnitField label="Head" optional value={headCm} unit="cm" min={20} max={80} step={0.1} onChange={setHeadCm} placeholder="35.1" />
                    </div>
                  </FieldGroup>
                  <TimeField value={logTime} onChange={setLogTime} />
                  <NoteField value={entryNote} onChange={setEntryNote} placeholder="Clinic, home scale, or anything useful" />
                  <p className="sheet-advice">Measure consistently and use the trend as context for your paediatrician.</p>
                  <FormError message={formError} />
                  <DialogFooter><Button type="submit" className="primary-button sheet-primary">Save growth check</Button></DialogFooter>
                </SheetForm>
              )}

              {sheet === "health" && (
                <SheetForm onSubmit={saveHealthNote}>
                  <LogDialogHeader icon={<Thermometer />} eyebrow="Health log" title="Temperature or note" description="Keep a time-stamped note you can refer back to." />
                  <UnitField label="Temperature" optional value={temperatureC} unit="°C" min={30} max={45} step={0.1} inputRef={invalidFieldRef} autoFocus invalid={Boolean(formError)} onChange={(value) => { setTemperatureC(value); setFormError(null); }} placeholder="36.7" />
                  {Number(temperatureC) >= 38 && (
                    <div className="health-alert" role="alert"><Thermometer size={18} /><p>{babyAgeMonths !== null && babyAgeMonths < 3 ? <><strong>38 °C or higher</strong> in a baby under 3 months needs urgent medical advice.</> : <><strong>Temperature recorded.</strong> If your baby seems unwell or you are concerned, seek medical advice.</>}</p></div>
                  )}
                  <NoteField value={entryNote} onChange={setEntryNote} placeholder="Medicine, spit-up, rash, question for the doctor…" />
                  <TimeField value={logTime} onChange={setLogTime} />
                  <FormError message={formError} />
                  <DialogFooter><Button type="submit" className="primary-button sheet-primary">Save health log</Button></DialogFooter>
                </SheetForm>
              )}

              {sheet === "edit" && editingActivity && (
                <EditActivityForm
                  activity={editingActivity}
                  bottleAmount={bottleAmount}
                  setBottleAmount={setBottleAmount}
                  milkType={milkType}
                  setMilkType={setMilkType}
                  nursingSide={nursingSide}
                  setNursingSide={setNursingSide}
                  diaperKind={diaperKind}
                  setDiaperKind={setDiaperKind}
                  weightGrams={weightGrams}
                  setWeightGrams={setWeightGrams}
                  lengthCm={lengthCm}
                  setLengthCm={setLengthCm}
                  headCm={headCm}
                  setHeadCm={setHeadCm}
                  temperatureC={temperatureC}
                  setTemperatureC={setTemperatureC}
                  logTime={logTime}
                  setLogTime={setLogTime}
                  endTime={endTime}
                  setEndTime={setEndTime}
                  note={entryNote}
                  setNote={setEntryNote}
                  error={formError}
                  clearError={() => setFormError(null)}
                  invalidFieldRef={invalidFieldRef}
                  onSave={saveEditedActivity}
                  onDelete={() => {
                    if (removeActivity(editingActivity)) setSheet(null);
                  }}
                />
              )}

              {sheet === "profile" && (
                <ProfileForm
                  profile={profile}
                  onChange={saveProfile}
                  onDone={() => setSheet(null)}
                />
              )}
            </DialogContent>
          )}
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  );
}

function OnboardingScreen({
  mode,
  profile,
  nightMode,
  storageWarning,
  onNightModeChange,
  onComplete,
  onRestore,
  onDownloadRecovery,
  onResetRecovery,
}: {
  mode: "onboarding" | "recovery";
  profile: Profile;
  nightMode: boolean;
  storageWarning: string | null;
  onNightModeChange: (enabled: boolean) => void;
  onComplete: (profile: Profile) => boolean;
  onRestore: (event: ChangeEvent<HTMLInputElement>) => void;
  onDownloadRecovery: () => void;
  onResetRecovery: () => void;
}) {
  const [draft, setDraft] = useState(profile);
  const nameId = useId();
  const birthDateId = useId();
  const restoreRef = useRef<HTMLInputElement>(null);

  return (
    <main className="onboarding-shell">
      <header className="onboarding-header">
        <div className="onboarding-brand">
          <span className="wordmark-mark"><Baby /></span>
          <span><strong>Baby Tracker</strong><small>Private family log</small></span>
        </div>
        <div className="onboarding-theme">
          {nightMode ? <Moon size={17} /> : <Sun size={17} />}
          <span>Dark mode</span>
          <Switch checked={nightMode} onCheckedChange={onNightModeChange} aria-label="Use dark mode" />
        </div>
      </header>

      {mode === "recovery" ? (
        <Card className="recovery-card">
          <CardHeader>
            <span className="onboarding-card-icon"><ShieldCheck /></span>
            <CardTitle>Your local log needs attention</CardTitle>
            <CardDescription>
              The saved copy could not be read, so Baby Tracker left it untouched. Download it before starting over, or restore a valid backup.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {storageWarning && <div className="onboarding-alert" role="alert">{storageWarning}</div>}
            <div className="recovery-actions">
              <Button onClick={onDownloadRecovery}><Download /> Download recovery</Button>
              <Button variant="outline" onClick={() => restoreRef.current?.click()}><Upload /> Restore backup</Button>
              <Button variant="ghost" onClick={onResetRecovery}>Reset and start clean</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="onboarding-layout">
          <section className="onboarding-intro" aria-labelledby="onboarding-title">
            <p className="eyebrow">Private by default</p>
            <h1 id="onboarding-title">The whole day,<br />without the mental load.</h1>
            <p>Log feeds, diapers, sleep and growth in seconds. No account, no cloud, no fake data.</p>
            <div className="onboarding-points">
              <div><span className="glyph-bottle"><Milk /></span><p><strong>One-tap logging</strong><small>Details only when you need them.</small></p></div>
              <div><span className="glyph-sleep"><Clock /></span><p><strong>Live timers and patterns</strong><small>See what happened and what may be next.</small></p></div>
              <div><span className="onboarding-private-icon"><ShieldCheck /></span><p><strong>Only on this device</strong><small>Export a private backup anytime.</small></p></div>
            </div>
          </section>

          <Card className="onboarding-card">
            <CardHeader>
              <span className="onboarding-card-icon"><Baby /></span>
              <CardTitle>Set up your baby</CardTitle>
              <CardDescription>Everything is optional. You can change it later.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="onboarding-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  onComplete({ ...draft, name: draft.name.trim() || "Baby" });
                }}
              >
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor={nameId}>Name <span className="optional-label">Optional</span></FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id={nameId}
                        autoFocus
                        maxLength={80}
                        value={draft.name}
                        placeholder="Baby’s name"
                        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
                      />
                    </InputGroup>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={birthDateId}>Date of birth <span className="optional-label">Optional</span></FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id={birthDateId}
                        type="date"
                        value={draft.birthDate}
                        max={new Date().toISOString().slice(0, 10)}
                        onChange={(event) => setDraft({ ...draft, birthDate: event.target.value })}
                      />
                    </InputGroup>
                  </Field>
                  <Field>
                    <FieldLabel>Feeding</FieldLabel>
                    <ToggleGroup
                      type="single"
                      value={draft.feedingMode}
                      className="segmented three-way"
                      aria-label="Feeding method"
                      onValueChange={(value) => value && setDraft({ ...draft, feedingMode: value as FeedingMode })}
                    >
                      {(["breast", "bottle", "mixed"] as FeedingMode[]).map((feedingMode) => (
                        <ToggleGroupItem key={feedingMode} value={feedingMode}>
                          {feedingMode[0].toUpperCase() + feedingMode.slice(1)}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    <FieldDescription>This only changes the quick actions you see.</FieldDescription>
                  </Field>
                </FieldGroup>

                {storageWarning && <div className="onboarding-alert" role="alert">{storageWarning}</div>}
                <Button type="submit" size="lg" className="onboarding-primary">Start tracking <ChevronRight /></Button>
                <Button type="button" variant="ghost" onClick={() => restoreRef.current?.click()}><Upload /> Restore a backup</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      <Input ref={restoreRef} className="hidden-input" type="file" accept="application/json" onChange={onRestore} />
      <Toaster theme={nightMode ? "dark" : "light"} position="bottom-center" closeButton />
    </main>
  );
}

function AppSidebar({
  activeTab,
  onNavigate,
  profile,
  onProfile,
  nightMode,
  onNightModeChange,
}: {
  activeTab: Tab;
  onNavigate: (tab: Tab) => void;
  profile: Profile;
  onProfile: () => void;
  nightMode: boolean;
  onNightModeChange: (enabled: boolean) => void;
}) {
  const { isMobile, setOpenMobile, state } = useSidebar();
  const navItems: Array<{ value: Tab; label: string; icon: React.ReactNode }> = [
    { value: "today", label: "Today", icon: <Home /> },
    { value: "timeline", label: "Timeline", icon: <Clock /> },
    { value: "insights", label: "Insights", icon: <BarChart3 /> },
    { value: "more", label: "Settings", icon: <Settings /> },
  ];

  const navigate = (tab: Tab) => {
    onNavigate(tab);
    setOpenMobile(false);
  };

  return (
    <Sidebar variant="sidebar" collapsible="icon" className="numa-sidebar">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              tooltip="Baby Tracker"
              aria-label="Baby Tracker"
              className="app-sidebar-brand"
              onClick={() => navigate("today")}
            >
              <span className="wordmark-mark"><Baby /></span>
              <span className="app-sidebar-brand-copy">
                <strong>Baby Tracker</strong>
                <small>Private family log</small>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Tracker</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.value}>
                  <SidebarMenuButton
                    size="lg"
                    tooltip={item.label}
                    aria-label={item.label}
                    isActive={activeTab === item.value}
                    onClick={() => navigate(item.value)}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem className="sidebar-theme-item">
            {state === "collapsed" && !isMobile ? (
              <SidebarMenuButton
                size="lg"
                className="sidebar-theme-toggle"
                tooltip={nightMode ? "Use light mode" : "Use dark mode"}
                aria-label={nightMode ? "Use light mode" : "Use dark mode"}
                aria-pressed={nightMode}
                onClick={() => onNightModeChange(!nightMode)}
              >
                {nightMode ? <Sun /> : <Moon />}
                <span>{nightMode ? "Light mode" : "Dark mode"}</span>
              </SidebarMenuButton>
            ) : (
              <div className="sidebar-theme-control">
                <span>{nightMode ? <Sun /> : <Moon />}<span><strong>Appearance</strong><small>{nightMode ? "Dark" : "Light"} theme</small></span></span>
                <Switch checked={nightMode} onCheckedChange={onNightModeChange} aria-label="Use dark mode" />
              </div>
            )}
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className="sidebar-profile-button" tooltip="Baby profile" aria-label="Baby profile" onClick={onProfile}>
              <span className="baby-avatar"><Baby /></span>
              <span className="sidebar-profile-copy">
                <strong>{profile.name}</strong>
                <small>Private profile</small>
              </span>
              <ChevronRight />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function ActivityRow({ activity, onEdit }: { activity: Activity; onEdit: (activity: Activity) => void }) {
  return (
    <Item asChild size="sm" className="activity-row">
      <Button variant="ghost" className="activity-open" onClick={() => onEdit(activity)} aria-label={`Edit ${activityTitle(activity)} from ${formatTime(activity.startedAt)}`}>
        <ItemMedia variant="icon" className={`activity-glyph glyph-${activity.type}`}><ActivityGlyph type={activity.type} /></ItemMedia>
        <ItemContent className="activity-copy">
          <ItemTitle>{activityTitle(activity)}</ItemTitle>
          <ItemDescription>{activityDetail(activity)}</ItemDescription>
        </ItemContent>
        <ItemActions className="activity-meta">
          <time dateTime={activity.startedAt}>{formatTime(activity.startedAt)}</time>
          <Pencil className="activity-row-action" aria-hidden="true" />
        </ItemActions>
      </Button>
    </Item>
  );
}

function QuickAction({
  title,
  description,
  icon,
  onClick,
  className = "",
  trailing = <Plus />,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  className?: string;
  trailing?: React.ReactNode;
}) {
  return (
    <Item asChild variant="outline" className={`quick-action ${className}`}>
      <Button variant="ghost" onClick={onClick}>
        <ItemMedia variant="icon" className="action-icon">{icon}</ItemMedia>
        <ItemContent>
          <ItemTitle>{title}</ItemTitle>
          <ItemDescription>{description}</ItemDescription>
        </ItemContent>
        <ItemActions>{trailing}</ItemActions>
      </Button>
    </Item>
  );
}

function SettingsAction({
  title,
  description,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Item asChild size="sm" className="settings-action">
      <Button variant="ghost" onClick={onClick}>
        <ItemMedia variant="icon">{icon}</ItemMedia>
        <ItemContent>
          <ItemTitle>{title}</ItemTitle>
          <ItemDescription>{description}</ItemDescription>
        </ItemContent>
        <ItemActions><ChevronRight /></ItemActions>
      </Button>
    </Item>
  );
}

function ActiveTimerCard({ activity, onStop }: { activity: Activity; onStop: () => void }) {
  const [now, setNow] = useState(Date.now);
  const isSleep = activity.type === "sleep";
  const title = isSleep
    ? "Sleeping"
    : `Nursing · ${activity.side === "left" ? "Left" : "Right"}`;
  const elapsed = liveDuration(activity.startedAt, now);

  useEffect(() => {
    const update = () => setNow(Date.now());
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") update();
    }, 1_000);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  return (
    <Card className={`active-card active-${activity.type}`}>
      <span className="active-icon"><ActivityGlyph type={activity.type} /></span>
      <div className="active-copy">
        <strong>{title}</strong>
        <span>Started at {formatTime(activity.startedAt)} · {formatTime(activity.startedAt)} → now</span>
      </div>
      <div className="active-elapsed">
        <small>Elapsed</small>
        <strong>{elapsed}</strong>
      </div>
      <Button onClick={onStop} aria-label={`Stop ${title.toLowerCase()} timer`}>
        <Square size={14} fill="currentColor" /> Stop
      </Button>
    </Card>
  );
}

function GrowthChart({
  activities,
  change,
  onAdd,
}: {
  activities: Activity[];
  change: number;
  onAdd: () => void;
}) {
  const visible = activities.slice(-7);
  const weights = visible.map((activity) => activity.weightGrams ?? 0);
  const minimum = weights.length ? Math.min(...weights) : 0;
  const maximum = weights.length ? Math.max(...weights) : 1;
  const range = Math.max(100, maximum - minimum);
  const latest = visible[visible.length - 1];
  const firstTime = visible.length ? new Date(visible[0].startedAt).getTime() : 0;
  const lastTime = visible.length ? new Date(visible[visible.length - 1].startedAt).getTime() : 1;
  const timeRange = Math.max(1, lastTime - firstTime);
  const points = visible.map((activity) => {
    const weight = activity.weightGrams ?? 0;
    const x = 32 + ((new Date(activity.startedAt).getTime() - firstTime) / timeRange) * 576;
    const y = 150 - ((weight - minimum) / range) * 112;
    return { activity, weight, x, y };
  });

  return (
    <Card className="chart-card growth-card">
      <div className="chart-title growth-title">
        <div><span>Growth</span><strong>Measurements over time</strong></div>
        <Button onClick={onAdd}><Plus size={15} /> Add measurement</Button>
      </div>

      {!visible.length ? (
        <div className="growth-empty">
          <Weight size={25} />
          <p>Your baby’s weight trend will appear after the first measurement.</p>
        </div>
      ) : (
        <>
          <div className="growth-overview">
            <div>
              <span>Latest</span>
              <strong>{((latest.weightGrams ?? 0) / 1_000).toFixed(2)} kg</strong>
            </div>
            <div>
              <span>Since last check</span>
              <strong className={change < 0 ? "is-negative" : ""}>
                {activities.length < 2 ? "First check" : `${change > 0 ? "+" : ""}${change} g`}
              </strong>
            </div>
            <div>
              <span>Length / head</span>
              <strong>{latest.lengthCm ? `${latest.lengthCm} cm` : "—"} / {latest.headCm ? `${latest.headCm} cm` : "—"}</strong>
            </div>
          </div>
          <div className="growth-line-chart">
            <svg viewBox="0 0 640 180" role="img" aria-labelledby="growth-chart-title growth-chart-description">
              <title id="growth-chart-title">Recent weight measurements</title>
              <desc id="growth-chart-description">A date-proportional line from {(minimum / 1_000).toFixed(2)} to {(maximum / 1_000).toFixed(2)} kilograms.</desc>
              <line className="growth-gridline" x1="32" x2="608" y1="150" y2="150" />
              {points.length > 1 && <polyline className="growth-line" points={points.map((point) => `${point.x},${point.y}`).join(" ")} />}
              {points.map(({ activity, weight, x, y }) => (
                <g key={activity.id}>
                  <circle className="growth-point" cx={x} cy={y} r="7" />
                  <text className="growth-value" x={x} y={Math.max(18, y - 14)} textAnchor="middle">{(weight / 1_000).toFixed(2)}</text>
                  <text className="growth-date" x={x} y="173" textAnchor="middle">{new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(activity.startedAt))}</text>
                </g>
              ))}
            </svg>
          </div>
          <table className="sr-only">
            <caption>Recent weight measurements</caption>
            <thead><tr><th>Date</th><th>Weight</th><th>Length</th><th>Head</th></tr></thead>
            <tbody>
              {visible.map((activity) => (
                <tr key={activity.id}>
                  <td>{new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(new Date(activity.startedAt))}</td>
                  <td>{activity.weightGrams} g</td>
                  <td>{activity.lengthCm ? `${activity.lengthCm} cm` : "Not logged"}</td>
                  <td>{activity.headCm ? `${activity.headCm} cm` : "Not logged"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <p className="growth-note">Trends are useful context for your paediatrician. A single measurement is not a diagnosis.</p>
    </Card>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state"><Baby size={24} /><p>{text}</p></div>;
}

function NavButton({ value, label, icon }: { value: Tab; label: string; icon: React.ReactNode }) {
  return <TabsTrigger value={value}>{icon}<span>{label}</span></TabsTrigger>;
}

function LogDialogHeader({
  icon,
  eyebrow,
  title,
  description,
  tone = "",
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  tone?: string;
}) {
  return (
    <DialogHeader className="log-dialog-header">
      <span className={`sheet-symbol ${tone}`}>{icon}</span>
      <div>
        <span className="dialog-eyebrow">{eyebrow}</span>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>{description}</DialogDescription>
      </div>
    </DialogHeader>
  );
}

function TimeField({
  value,
  onChange,
  label = "When",
  inputRef,
  error = false,
  autoFocus = false,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  error?: boolean;
  autoFocus?: boolean;
}) {
  const id = useId();
  return (
    <Field className="time-field" data-invalid={error || undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup>
        <InputGroupInput id={id} ref={inputRef} autoFocus={autoFocus} data-initial-focus={autoFocus ? "" : undefined} type="datetime-local" value={value} max={localDateInput(new Date())} aria-invalid={error} aria-describedby={error ? "sheet-error" : undefined} onChange={(event) => onChange(event.target.value)} />
      </InputGroup>
    </Field>
  );
}

function NoteField({
  value,
  onChange,
  placeholder = "Anything worth remembering",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const id = useId();
  return (
    <Field className="note-field">
      <FieldLabel htmlFor={id}>Note <span className="optional-label">Optional</span></FieldLabel>
      <InputGroup>
        <InputGroupTextarea
        id={id}
        value={value}
        maxLength={240}
        rows={2}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
      </InputGroup>
    </Field>
  );
}

function UnitField({
  label,
  value,
  onChange,
  unit,
  placeholder,
  min,
  max,
  step,
  optional = false,
  inputRef,
  autoFocus = false,
  invalid = false,
  className = "",
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  unit: string;
  placeholder?: string;
  min: number;
  max: number;
  step: number;
  optional?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  autoFocus?: boolean;
  invalid?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <Field className={`unit-field ${className}`} data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>{label}{optional && <span className="optional-label">Optional</span>}</FieldLabel>
      <InputGroup>
        <InputGroupInput
          id={id}
          ref={inputRef}
          autoFocus={autoFocus}
          data-initial-focus={autoFocus ? "" : undefined}
          inputMode="decimal"
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-invalid={invalid}
          aria-describedby={invalid ? "sheet-error" : undefined}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
        <InputGroupAddon align="inline-end"><InputGroupText>{unit}</InputGroupText></InputGroupAddon>
      </InputGroup>
    </Field>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <FieldError className="form-error" id="sheet-error">{message}</FieldError>;
}

type EditActivityFormProps = {
  activity: Activity;
  bottleAmount: number;
  setBottleAmount: React.Dispatch<React.SetStateAction<number>>;
  milkType: "formula" | "expressed";
  setMilkType: (value: "formula" | "expressed") => void;
  nursingSide: "left" | "right";
  setNursingSide: (value: "left" | "right") => void;
  diaperKind: DiaperKind;
  setDiaperKind: (value: DiaperKind) => void;
  weightGrams: string;
  setWeightGrams: (value: string) => void;
  lengthCm: string;
  setLengthCm: (value: string) => void;
  headCm: string;
  setHeadCm: (value: string) => void;
  temperatureC: string;
  setTemperatureC: (value: string) => void;
  logTime: string;
  setLogTime: (value: string) => void;
  endTime: string;
  setEndTime: (value: string) => void;
  note: string;
  setNote: (value: string) => void;
  error: string | null;
  clearError: () => void;
  invalidFieldRef: React.RefObject<HTMLInputElement | null>;
  onSave: () => void;
  onDelete: () => void;
};

function SheetForm({ children, onSubmit }: { children: React.ReactNode; onSubmit: () => void }) {
  return (
    <form
      className="sheet-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {children}
    </form>
  );
}

function EditActivityForm({
  activity,
  bottleAmount,
  setBottleAmount,
  milkType,
  setMilkType,
  nursingSide,
  setNursingSide,
  diaperKind,
  setDiaperKind,
  weightGrams,
  setWeightGrams,
  lengthCm,
  setLengthCm,
  headCm,
  setHeadCm,
  temperatureC,
  setTemperatureC,
  logTime,
  setLogTime,
  endTime,
  setEndTime,
  note,
  setNote,
  error,
  clearError,
  invalidFieldRef,
  onSave,
  onDelete,
}: EditActivityFormProps) {
  const isTimed = activity.type === "nursing" || activity.type === "sleep";
  return (
    <SheetForm onSubmit={onSave}>
      <LogDialogHeader
        icon={<ActivityGlyph type={activity.type} />}
        eyebrow="Edit log"
        title={activityTitle(activity)}
        description={`${formatTimelineDay(activity.startedAt)} at ${formatTime(activity.startedAt)}`}
        tone={`glyph-${activity.type}`}
      />

      {activity.type === "bottle" && (
        <>
          <UnitField label="Amount" value={bottleAmount} unit="ml" min={1} max={1000} step={1} inputRef={invalidFieldRef} autoFocus invalid={Boolean(error)} onChange={(value) => { setBottleAmount(Number(value)); clearError(); }} className="measurement-primary" />
          <ToggleGroup type="single" value={String(bottleAmount)} className="preset-row" onValueChange={(value) => { if (value) setBottleAmount(Number(value)); clearError(); }}>
            {bottlePresets.map((amount) => <ToggleGroupItem value={String(amount)} aria-label={`${amount} millilitres`} key={amount}>{amount}</ToggleGroupItem>)}
          </ToggleGroup>
          <ToggleGroup type="single" value={milkType} className="segmented" onValueChange={(value) => value && setMilkType(value as "formula" | "expressed")}>
            <ToggleGroupItem value="formula">Formula</ToggleGroupItem>
            <ToggleGroupItem value="expressed">Breast milk</ToggleGroupItem>
          </ToggleGroup>
        </>
      )}

      {activity.type === "nursing" && (
        <ToggleGroup type="single" value={nursingSide} className="side-grid" onValueChange={(value) => value && setNursingSide(value as "left" | "right")}>
          <ToggleGroupItem autoFocus data-initial-focus value="left"><span>L</span><strong>Left</strong></ToggleGroupItem>
          <ToggleGroupItem value="right"><span>R</span><strong>Right</strong></ToggleGroupItem>
        </ToggleGroup>
      )}

      {activity.type === "diaper" && (
        <ToggleGroup type="single" value={diaperKind} className="diaper-grid" onValueChange={(value) => value && setDiaperKind(value as DiaperKind)}>
          <ToggleGroupItem autoFocus data-initial-focus value="wet"><Droplet size={22} /><strong>Wet</strong></ToggleGroupItem>
          <ToggleGroupItem value="dirty"><span className="dot-icon">●</span><strong>Dirty</strong></ToggleGroupItem>
          <ToggleGroupItem value="both"><span className="both-icon"><Droplet size={18} />●</span><strong>Both</strong></ToggleGroupItem>
        </ToggleGroup>
      )}

      {activity.type === "growth" && (
        <FieldGroup className="measurement-fields">
          <UnitField label="Weight" value={weightGrams} unit="g" min={500} max={30000} step={1} inputRef={invalidFieldRef} autoFocus invalid={Boolean(error)} onChange={(value) => { setWeightGrams(value); clearError(); }} className="measurement-primary" />
          <div className="measurement-row">
            <UnitField label="Length" optional value={lengthCm} unit="cm" min={20} max={130} step={0.1} onChange={(value) => { setLengthCm(value); clearError(); }} />
            <UnitField label="Head" optional value={headCm} unit="cm" min={20} max={80} step={0.1} onChange={(value) => { setHeadCm(value); clearError(); }} />
          </div>
        </FieldGroup>
      )}

      {activity.type === "health" && (
        <UnitField label="Temperature" optional value={temperatureC} unit="°C" min={30} max={45} step={0.1} inputRef={invalidFieldRef} autoFocus invalid={Boolean(error)} onChange={(value) => { setTemperatureC(value); clearError(); }} placeholder="36.7" />
      )}

      <div className={isTimed ? "measurement-row edit-time-row" : ""}>
        <TimeField value={logTime} label={isTimed ? "Started" : "When"} autoFocus={activity.type === "sleep"} inputRef={activity.type === "sleep" || activity.type === "nursing" || activity.type === "diaper" ? invalidFieldRef : undefined} error={Boolean(error)} onChange={(value) => { setLogTime(value); clearError(); }} />
        {isTimed && <TimeField value={endTime} label="Ended (leave empty if running)" error={Boolean(error)} onChange={(value) => { setEndTime(value); clearError(); }} />}
      </div>
      <NoteField value={note} onChange={(value) => { setNote(value); clearError(); }} />
      <FormError message={error} />
      <DialogFooter><Button type="submit" className="primary-button sheet-primary">Save changes</Button></DialogFooter>

      <AlertDialog>
        <div className="edit-danger">
          <AlertDialogTrigger asChild>
            <Button type="button" variant="ghost"><Trash2 size={17} /> Delete this log</Button>
          </AlertDialogTrigger>
        </div>
        <AlertDialogContent className="delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {activityTitle(activity)}?</AlertDialogTitle>
            <AlertDialogDescription>
              {formatTimelineDay(activity.startedAt)} at {formatTime(activity.startedAt)}. You can undo immediately after deletion.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep log</AlertDialogCancel>
            <AlertDialogAction className="confirm-remove" onClick={onDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SheetForm>
  );
}

function ProfileForm({ profile, onChange, onDone }: { profile: Profile; onChange: (profile: Profile) => boolean; onDone: () => void }) {
  const [draft, setDraft] = useState(profile);
  const nameId = useId();
  const birthDateId = useId();
  return (
    <SheetForm onSubmit={() => {
      if (onChange({ ...draft, name: draft.name.trim() || "Baby" })) onDone();
    }}>
      <LogDialogHeader icon={<Baby />} eyebrow="Keep it personal" title="Baby profile" description="Used only in this browser to personalise your tracker." />
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor={nameId}>Name</FieldLabel>
          <InputGroup><InputGroupInput id={nameId} autoFocus data-initial-focus maxLength={80} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Baby’s name" /></InputGroup>
        </Field>
        <Field>
          <FieldLabel htmlFor={birthDateId}>Date of birth</FieldLabel>
          <InputGroup><InputGroupInput id={birthDateId} type="date" value={draft.birthDate} max={new Date().toISOString().slice(0, 10)} onChange={(event) => setDraft({ ...draft, birthDate: event.target.value })} /></InputGroup>
        </Field>
        <Field>
          <FieldLabel>How are you feeding?</FieldLabel>
          <ToggleGroup type="single" value={draft.feedingMode} className="segmented three-way" aria-label="Feeding method" onValueChange={(value) => value && setDraft({ ...draft, feedingMode: value as FeedingMode })}>
            {(["breast", "bottle", "mixed"] as FeedingMode[]).map((mode) => <ToggleGroupItem key={mode} value={mode}>{mode[0].toUpperCase() + mode.slice(1)}</ToggleGroupItem>)}
          </ToggleGroup>
          <FieldDescription>This changes which quick actions are shown.</FieldDescription>
        </Field>
      </FieldGroup>
      <DialogFooter><Button type="submit" className="primary-button sheet-primary">Save profile</Button></DialogFooter>
    </SheetForm>
  );
}
