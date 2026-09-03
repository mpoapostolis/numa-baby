import { BarChart3, ChevronRight, Clock, Home, Newspaper, Ruler, Settings, ShieldCheck, Stethoscope } from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useRef, useState, useMemo } from "react";
import { toast } from "./lib/toast";
import { Button } from "./components/ui/button";
import { Dialog, DialogContent } from "./components/ui/dialog";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "./components/ui/sidebar";
import { AppSidebar } from "./components/AppSidebar";
import { BabyFace, SleepingBaby } from "./components/illustrations";
import { ConsentBanner } from "./components/ConsentBanner";
import { InAppEscape } from "./components/InAppEscape";
import { Milestone, milestoneFor, milestoneSeen } from "./domain/milestones";
import { lifetimeTotals } from "./domain/lifetime";
import { shouldOfferNightHelp } from "./domain/nightAlone";
import { useStableCallback } from "./hooks/useStableCallback";
import { FeedbackBubble } from "./components/FeedbackBubble";
// Lazy: a returning family boots straight to Today and never downloads the
// welcome pitch; only a genuinely fresh (or recovering) visit pays for it.
const OnboardingScreen = lazy(() => import("./screens/OnboardingScreen"));
import TodayScreen from "./screens/TodayScreen";
import { Activity, ActivityType, Profile, Sheet, Tab } from "./domain/types";
import { JOIN_CODE_PATTERN } from "./domain/familyPairing";
import { track, suppressTracking } from "./domain/analytics";
import { LATEST_RELEASE_ID, unseenReleases } from "./domain/changelog";
import { parseStoredData } from "./domain/validate";
// Static, all of it: the module is on the boot path anyway for the routing
// half, so the dynamic imports that used to fetch the codec half moved no
// bytes and only earned a build warning.
import {
  HANDOFF_PATH,
  handoffReturnUrl,
  packHandoff,
  readHandoffPayload,
  readHandoffTarget,
  unpackHandoff,
} from "./domain/handoff";
import { backupNudge } from "./domain/backupNudge";
import { reminderNudge } from "./domain/reminderNudge";
import { onConsentChange, readConsent } from "./domain/consent";
import { ageInDays } from "./domain/time";
import { dayKey } from "./domain/daySummary";
import { useActivityStats } from "./hooks/useActivityStats";
import { useFamilySync } from "./hooks/useFamilySync";
import { useMinuteClock } from "./hooks/useMinuteClock";
import { useCloseOnBack } from "./hooks/useCloseOnBack";
import { LAST_BACKUP_KEY, useTrackerStore } from "./hooks/useTrackerStore";

// The chart-heavy screens load on first visit; Today never pays for them.
// Settings rides along: nobody opens it at 3am, so it stays off the
// initial bundle too.
const TimelineScreen = lazy(() => import("./screens/TimelineScreen"));
const InsightsScreen = lazy(() => import("./screens/InsightsScreen"));
const GrowthGuideScreen = lazy(() => import("./screens/GrowthGuideScreen"));
const SettingsScreen = lazy(() => import("./screens/SettingsScreen"));
// Only ever rendered for someone arriving from a scanned invite.
const JoinFamilyScreen = lazy(() => import("./components/JoinFamilyScreen"));
// Read once and dismissed for ever — not worth the critical path.
const WhatsNew = lazy(() => import("./components/WhatsNew").then((m) => ({ default: m.WhatsNew })));
// Every form in the app. The one-tap paths never open it, and the paths that
// do are the deliberate slow ones — so it loads on the first sheet, not on
// the boot a parent waits through at 3am.
const LogSheet = lazy(() => import("./components/LogSheet").then((m) => ({ default: m.LogSheet })));
// Only reached by someone deliberately moving their log to the app's other web
// address, which most people will do once or never.
const HandoffScreen = lazy(() => import("./screens/HandoffScreen").then((m) => ({ default: m.HandoffScreen })));
// Shown after twenty entries and then rarely. The decision to show it is a
// pure function and stays here; the card itself has no business in the bundle
// a parent downloads at 3am.
const BackupNudgeCard = lazy(() => import("./components/BackupNudge").then((m) => ({ default: m.BackupNudgeCard })));
const ReminderNudgeCard = lazy(() => import("./components/ReminderNudge").then((m) => ({ default: m.ReminderNudgeCard })));
// The one-time cloud-protection announcement for families that predate it.
const NightHelp = lazy(() => import("./components/NightHelp").then((m) => ({ default: m.NightHelp })));
const ProtectIntro = lazy(() => import("./components/ProtectIntro").then((m) => ({ default: m.ProtectIntro })));
const NewsDialog = lazy(() => import("./components/NewsDialog").then((m) => ({ default: m.NewsDialog })));
const RecoverLinkDialog = lazy(() => import("./components/RecoverLinkDialog"));
// The toast library rides its own chunk and attaches to lib/toast when it
// mounts; nothing on the boot path needs it before the first tap, and a
// toast fired before then simply waits for it.
const Toaster = lazy(() => import("./components/ui/sonner").then((m) => ({ default: m.Toaster })));

// The milestone is decided ONCE per calendar day and frozen for the visit.
// The party card marks its id seen the moment it mounts, so re-reading
// storage on every render made the milestone vanish on the next minute tick
// — and let the what's-new card and the protect offer land on top of it,
// the very stacking the moment chain below exists to prevent.
function pendingMilestone(profile: Profile, now: number): Milestone | null {
  const found = milestoneFor(profile.birthDate, profile.name, now);
  return found !== null && !milestoneSeen(found.id) ? found : null;
}

// A future-dated feed from a restored backup must never arm a timer that wraps
// the 32-bit setTimeout ceiling and fires instantly.
const MAX_REMINDER_DELAY_MS = 24 * 60 * 60_000;

const bottomNavItems: Array<{ value: Tab; label: string; icon: React.ReactNode }> = [
  { value: "today", label: "Today", icon: <Home size={20} /> },
  { value: "timeline", label: "Timeline", icon: <Clock size={20} /> },
  { value: "insights", label: "Insights", icon: <BarChart3 size={20} /> },
  { value: "guide", label: "Guide", icon: <Ruler size={20} /> },
  { value: "more", label: "Settings", icon: <Settings size={20} /> },
];

// One fallback for every lazy screen: visible loading, announced to SR.
const screenFallback = (
  <div className="screen loading-screen screen-fallback" role="status" aria-label="Loading">
    <SleepingBaby size={48} aria-hidden="true" />
  </div>
);

// The trigger's name must survive both states; SidebarTrigger alone can't
// know them, so this tiny wrapper reads the provider.
function NavTrigger() {
  const { open, openMobile, isMobile } = useSidebar();
  return (
    <SidebarTrigger
      className="sidebar-trigger"
      aria-label="Toggle navigation"
      aria-expanded={isMobile ? openMobile : open}
    />
  );
}

const SEEN_RELEASE_KEY = "numa-baby-seen-release-v1";
const BACKUP_DISMISSED_KEY = "numa-baby-backup-nudge-v1";
/** "Not now" on the reminders announcement. */
const REMINDER_NUDGE_KEY = "numalog-reminder-nudge-v1";
/** A fact about this browser, not a piece of state: it cannot change while
    the page is open, and asking it in an effect would only be a render. */
const PUSH_CAPABLE = "serviceWorker" in navigator && "PushManager" in window;
/** Asked once for a second phone at 3am; the value is only ever "1". */
const NIGHT_HELP_KEY = "numalog-night-help-v1";

function readStamp(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

// A scanned invite arrives as "/#join=123456". Read once at boot and strip it
// from the URL, so a refresh (or a shared screenshot of the address bar) never
// replays a join that already happened.
function readIncomingJoinCode(): string | null {
  const match = JOIN_CODE_PATTERN.exec(window.location.hash);
  if (!match) return null;
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return match[1];
}

// Magic-link taps arrive the same way: "/#confirm-email=…" binds an address,
// "/#recover=…" restores a family onto a fresh phone. Read once, strip, so a
// refresh never replays a redeem that already spent its token.
function readMagicToken(): { purpose: "confirm" | "recover"; token: string } | null {
  const match = /#(confirm-email|recover)=([0-9a-f]{32})$/.exec(window.location.hash);
  if (!match) return null;
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return { purpose: match[1] === "recover" ? "recover" : "confirm", token: match[2] };
}

// Read (and strip) at module load — exactly once per page visit, before any
// render can race it.
const tappedMagicLink = readMagicToken();

// A home-screen shortcut (manifest.shortcuts) arrives as "/?log=diaper":
// press-and-hold on the icon, one tap, and the sheet is open before the app
// has finished saying hello. Read once at boot and stripped, so a refresh
// never re-opens a sheet the parent already closed.
const SHORTCUT_SHEETS: ReadonlyArray<Exclude<Sheet, null>> = ["bottle", "nursing", "diaper", "sleep"];
function readShortcut(): Exclude<Sheet, null> | null {
  const params = new URLSearchParams(window.location.search);
  const wanted = params.get("log");
  if (wanted === null) return null;
  params.delete("log");
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  const found = SHORTCUT_SHEETS.find((sheet) => sheet === wanted);
  return found ?? null;
}
const tappedShortcut = readShortcut();

// Where this visit came from — a milestone card, a week picture, a friend's
// message — tagged by shareLink() and stripped here, so the analytics can
// say which picture brings families in and the address stays clean.
function readArrival(): string | null {
  const params = new URLSearchParams(window.location.search);
  const via = params.get("via");
  if (via === null) return null;
  params.delete("via");
  const query = params.toString();
  window.history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  return via.slice(0, 32) || null;
}
const arrivedVia = readArrival();

export default function HomePage() {
  const [debugMode] = useState(() => {
    const on = new URLSearchParams(window.location.search).has("debug");
    if (on) suppressTracking();
    return on;
  });
  const [incomingJoinCode, setIncomingJoinCode] = useState(readIncomingJoinCode);
  const magicTokenRef = useRef(tappedMagicLink);
  const shortcutRef = useRef(tappedShortcut);
  const arrivalRef = useRef(arrivedVia);
  // Fresh from onboarding: the protect offer earns its one showing NOW, at
  // the moment the parent has just invested in the setup — not after five
  // entries like families that predate the feature.
  const [justOnboarded, setJustOnboarded] = useState(false);
  // The on-this-phone-only pill summons the protect dialog directly —
  // incremented per tap so a re-tap remounts a fresh one.
  const [protectAsk, setProtectAsk] = useState(0);
  // A recovery link tapped on a phone that already holds a log — the token
  // waits here while the person decides in a real dialog.
  const [recoverAsk, setRecoverAsk] = useState<string | null>(null);
  const [newsOpen, setNewsOpen] = useState(false);
  // The topbar badge's own "read" flag for THIS visit. The what's-new card
  // deliberately writes only storage when it marks itself seen (so it can
  // stay on screen), which would leave the badge lit all visit — this flag
  // is how both the card showing and the dialog opening turn it off now.
  const [newsSeen, setNewsSeen] = useState(false);
  // Stateful, not read-once: the intro unmounts whenever a sheet opens, and
  // a boot-time snapshot meant every sheet close REMOUNTED it, open again,
  // for anyone who had said "maybe later" this visit.
  const [protectIntroDone, setProtectIntroDone] = useState(() => {
    try {
      return window.localStorage.getItem("numalog-protect-intro-v1") !== null;
    } catch {
      return true;
    }
  });
  // A scanned link opens straight on Settings, where Family Sync lives. Read
  // from the state above, never from the hash — by now it has been stripped.
  const [activeTab, setActiveTab] = useState<Tab>(incomingJoinCode ? "more" : "today");
  const [sheet, setSheet] = useState<Sheet>(null);
  // null = never asked. The banner shows only then, so a parent is asked once
  // rather than on every one of the six visits they make in a night.
  const [consent, setConsent] = useState(readConsent);
  // The Settings toggle answers the same question — when it does, the
  // floating banner must fold up too, not linger asking what was answered.
  useEffect(() => onConsentChange(setConsent), []);
  const [seenRelease, setSeenRelease] = useState(() => {
    try {
      return window.localStorage.getItem(SEEN_RELEASE_KEY);
    } catch {
      // Storage blocked: treat every release as already seen rather than
      // showing the same card on every single visit.
      return LATEST_RELEASE_ID;
    }
  });
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [nursingInitialMode, setNursingInitialMode] = useState<"timer" | "manual">("timer");
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission | "unsupported">(
    () => "Notification" in window ? Notification.permission : "unsupported",
  );
  const [timelineFilter, setTimelineFilter] = useState<"all" | ActivityType>("all");
  const [timelineLimit, setTimelineLimit] = useState(80);
  const [sidebarDefaultOpen] = useState(() => !document.cookie.split("; ").includes("sidebar_state=false"));
  const sheetTriggerRef = useRef<HTMLElement | null>(null);
  const minuteClock = useMinuteClock();

  const [backupDismissedAt, setBackupDismissedAt] = useState(() => readStamp(BACKUP_DISMISSED_KEY));
  const [reminderDismissedAt, setReminderDismissedAt] = useState(() => readStamp(REMINDER_NUDGE_KEY));
  // Null until asked. The announcement promises reminders that survive a
  // closed app, so it must not appear where the deployment cannot deliver
  // one — and that is only knowable by asking for the signing key.
  const [pushReady, setPushReady] = useState<boolean | null>(null);
  /** The server is holding this phone's alarm, so nothing in the page should
      also be holding it. */
  const [pushArmed, setPushArmed] = useState(false);

  const closeSheet = useCallback(() => setSheet(null), []);
  // On Android, back is how you leave a screen — and a sheet is a screen.
  // Without this it pops the app's own (empty) history and closes everything.
  useCloseOnBack(Boolean(sheet), closeSheet);
  // And a tab is a screen too: back from Timeline, Insights, the Guide or
  // Settings returns to Today instead of leaving the installed app.
  const backToToday = useCallback(() => setActiveTab("today"), []);
  useCloseOnBack(activeTab !== "today", backToToday);

  function showToast(message: string, undo?: () => void) {
    toast(message, {
      // A toast that carries Undo stays twice as long: on a touchscreen the
      // timer never pauses (nothing hovers), and the mis-tap it exists for —
      // Wet for Dirty, four pixels apart — is found with the eyes, in the
      // dark, after the baby has been settled.
      duration: undo ? 8_000 : 4_200,
      action: undo ? { label: "Undo", onClick: undo } : undefined,
    });
  }

  const {
    bootState,
    activities,
    profile,
    nightMode,
    reminders,
    storageWarning,
    storagePersisted,
    recoveredNotice,
    addActivity,
    updateActivity,
    removeActivity,
    stopTimer,
    changeNightMode,
    themeChoice,
    changeTheme,
    saveProfile,
    completeOnboarding,
    completeJoin,
    changeFeedReminders,
    changeFeedReminderInterval,
    changeDiaperReminders,
    changeDiaperReminderInterval,
    persistVersion,
    backfillVersion,
    backfillOldestAt,
    mergeRemote,
    readPersisted,
    stampProfileForSync,
    demoteProfileForJoin,
    dropLocalForAdoption,
    exportData,
    exportPayload,
    sharePartner,
    importData,
    mergeBackupText,
    downloadRecovery,
    resetUnreadableData,
    dismissRecoveredNotice,
    eraseAllData,
  } = useTrackerStore({ debugMode, showToast, onNotificationPermission: setNotificationPermission });

  const familySync = useFamilySync({
    debugMode,
    bootState,
    persistVersion,
    backfillVersion,
    backfillOldestAt,
    readPersisted,
    stampProfileForSync,
    demoteProfileForJoin,
    dropLocalForAdoption,
    mergeRemote,
    showToast,
  });

  // A tapped home-screen shortcut opens its sheet the moment the log is
  // readable. Deferred to a timer so no state changes inside the effect body.
  useEffect(() => {
    if (bootState === "ready" && arrivalRef.current) {
      track("arrived_via", { via: arrivalRef.current });
      arrivalRef.current = null;
    }
    const wanted = shortcutRef.current;
    if (!wanted || bootState !== "ready") return;
    shortcutRef.current = null;
    track("shortcut_opened", { sheet: wanted });
    const timer = window.setTimeout(() => openSheet(wanted), 0);
    return () => window.clearTimeout(timer);
  }, [bootState]);

  // A tapped magic link. The confirm kind is safe in any state — it only
  // marks an address as this family's guard. The recover kind REPLACES the
  // pairing, so it only acts on a phone with nothing to lose (onboarding);
  // anywhere else it explains itself instead of silently mixing two logs.
  useEffect(() => {
    const tapped = magicTokenRef.current;
    if (!tapped || bootState === "loading") return;
    magicTokenRef.current = null;
    if (tapped.purpose === "recover") {
      if (bootState === "recovery") {
        // recovery boot: the local copy is unreadable and downloading it
        // comes first — the restore doors are on the screen already.
        showToast("Save this phone's copy first — then use the restore options right here.");
      } else {
        // A phone WITH a log tapped a recovery link: that is the standard
        // merge-or-adopt decision, and it gets the standard real dialog —
        // not a four-second toast that spends the link's one moment on a
        // dead end. An EMPTY phone gets the same dialog with one button:
        // the token is spent by a tap, never by a page load, because the
        // browsers that open links inside mail scanners run JavaScript too.
        // Cancel leaves the token unspent and this phone whole.
        setRecoverAsk(tapped.token);
      }
      return;
    }
    void familySync.emailRedeem(tapped.token, "This phone").then((outcome) => {
      track("magic_link_redeemed", { purpose: tapped.purpose, ok: outcome !== null });
      if (outcome === "confirmed") showToast("Recovery email confirmed — your log is protected.");
      if (outcome === "recovered") completeJoin();
    });
    // Runs once per tapped link, as soon as boot settles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootState]);

  // Asked once there is something worth losing, and not before — the rules
  // live in domain/backupNudge.ts. Recomputed on the minute clock so a
  // fortnight-old dismissal expires without needing a reload.
  const pendingBackupNudge = backupNudge(
    {
      entries: activities.length,
      lastBackupAt: readStamp(LAST_BACKUP_KEY),
      synced: Boolean(familySync.pairing),
      storagePersisted,
      dismissedAt: backupDismissedAt,
    },
    minuteClock,
  );

  useEffect(() => {
    // Theme changes swap every surface color at once — transitions would
    // smear a cream flash across the dark room. Suppress them for the swap.
    const root = document.documentElement;
    root.classList.add("theme-switching");
    root.classList.toggle("dark", nightMode);
    const settle = window.setTimeout(() => root.classList.remove("theme-switching"), 50);
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute("content", nightMode ? "#120c0f" : "#fdf5f2");
    return () => window.clearTimeout(settle);
  }, [nightMode]);

  // The companion's lullaby loops are paused while a sheet covers it (see
  // companion.css): six infinite SVG animations repaint every frame, and
  // under an overlay nobody sees them. A class on <html> is what CSS reads.
  useEffect(() => {
    document.documentElement.classList.toggle("sheet-open", sheet !== null);
  }, [sheet]);

  function markReleasesSeen() {
    try {
      window.localStorage.setItem(SEEN_RELEASE_KEY, LATEST_RELEASE_ID);
    } catch {
      // Nothing to do — the card simply reappears next time.
    }
    setSeenRelease(LATEST_RELEASE_ID);
  }

  const stats = useActivityStats(activities, profile, minuteClock);
  const { sortedActivities, feedCount, lastFeed, lastBottle, activeNursing, babyAgeMonths } = stats;

  // A fresh install is latched the first time it is seen, not re-tested on
  // every render: without the latch the parent's very first entry made the
  // count non-zero and the whole release history arrived as "New".
  const [freshInstall, setFreshInstall] = useState(false);
  if (!freshInstall && seenRelease === null && bootState === "ready" && sortedActivities.length === 0) {
    setFreshInstall(true);
  }
  const releasesToShow = seenRelease === null && (freshInstall || sortedActivities.length === 0)
    ? []
    : unseenReleases(seenRelease);
  // ---- The moment chain -------------------------------------------------
  // Four surfaces used to compete for the same first glance — a birthday
  // party, the protect announcement, the what's-new card and the backup
  // nudge could all land on one open. One voice at a time, priority by
  // urgency: a milestone has a date, protect happens once in an app's life,
  // news can wait an open, and the nudge is quiet forever once the cloud
  // holds a copy. Whatever yields today simply speaks on the next open.
  // Re-decided when the calendar day (or the baby) changes, never on a tick.
  // Adjusting state during render is React's own idiom for "derive from the
  // previous render" — one render, no effect, no storage read per tick.
  const milestoneKey = `${new Date(minuteClock).toDateString()}|${profile.birthDate}|${profile.name}`;
  const [milestoneGate, setMilestoneGate] = useState(() => ({
    key: milestoneKey,
    milestone: pendingMilestone(profile, minuteClock),
  }));
  if (milestoneGate.key !== milestoneKey) {
    setMilestoneGate({ key: milestoneKey, milestone: pendingMilestone(profile, minuteClock) });
  }
  const celebration = milestoneGate.milestone;
  const milestoneToday = celebration !== null;
  // The party's picture says what the family has done since day one. Summed
  // only on a milestone day; every other day this is null and costs nothing.
  const milestoneTotals = useMemo(() => (celebration ? lifetimeTotals(activities) : null), [celebration, activities]);
  const dismissCelebration = useCallback(() => setMilestoneGate((gate) => ({ ...gate, milestone: null })), []);
  // The first morning. A family's first night is the moment the other parent
  // wakes up not knowing when the last feed was — the one sentence that
  // explains why a second phone matters — so the offer comes the day after
  // the first entry, not after five entries.
  const oldestEntry = sortedActivities[sortedActivities.length - 1];
  const firstMorning = oldestEntry !== undefined && dayKey(new Date(oldestEntry.startedAt)) !== dayKey(new Date(minuteClock));
  // The 3am offer: a second phone, at the hour the reason for it is obvious.
  // Once in the life of this phone, and never while it is already shared.
  const [nightHelpAsked, setNightHelpAsked] = useState(() => {
    try {
      return window.localStorage.getItem(NIGHT_HELP_KEY) !== null;
    } catch {
      return true;
    }
  });
  const nightHelp = shouldOfferNightHelp({
    activities: sortedActivities,
    now: minuteClock,
    paired: Boolean(familySync.pairing),
    askedBefore: nightHelpAsked,
  });
  function closeNightHelp() {
    try { window.localStorage.setItem(NIGHT_HELP_KEY, "1"); } catch { /* storage blocked */ }
    setNightHelpAsked(true);
  }
  const protectMoment =
    !milestoneToday && consent !== null && sheet === null && !protectIntroDone &&
    (justOnboarded || firstMorning || activities.length >= 5);
  const showWhatsNew =
    activeTab === "today" && releasesToShow.length > 0 && !milestoneToday && !protectMoment && !nightHelp;

  useEffect(() => {
    // Everything is new to someone who just arrived; greeting them with a
    // changelog is noise. Record the latest and say nothing. The latch above
    // covers this visit even where storage refuses the write.
    if (!freshInstall) return;
    try {
      window.localStorage.setItem(SEEN_RELEASE_KEY, LATEST_RELEASE_ID);
    } catch {
      // Nothing to do.
    }
  }, [freshInstall]);

  useEffect(() => {
    // A log arriving from the app's other web address. The fragment is cleared
    // FIRST — before anything is decoded — so a refresh cannot import twice and
    // a family's entries do not sit in the address bar a moment longer than
    // they have to.
    if (bootState === "loading") return;
    const payload = readHandoffPayload(window.location.hash);
    if (!payload) return;
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    let cancelled = false;
    void unpackHandoff(payload)
      .then((text) => {
        if (cancelled) return;
        // The same validation and rollback copy as a backup file opened by
        // hand — see mergeBackupText — and, because this arrived in a link
        // rather than from a file the parent picked, ALWAYS a confirmation.
        // The prompt names what is about to arrive: "412 entries for Mia" is
        // something a person can recognise or reject; "merge this data?" is not.
        const arriving = parseStoredData(text);
        const count = arriving.activities.length;
        const whose = arriving.profile.name.trim();
        mergeBackupText(
          text,
          `Bring ${count} ${count === 1 ? "entry" : "entries"}${whose ? ` for ${whose}` : ""} across from the app's other address? Existing entries stay; newer versions win.`,
          "link",
        );
      })
      .catch(() => showToast("That log could not be read"));
    return () => { cancelled = true; };
    // Runs once the store is readable; mergeBackupText is stable for this.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootState === "loading"]);

  useEffect(() => {
    // Being shown IS being seen. The card is marked read a moment after it
    // appears, so it never greets the same person twice — whether or not they
    // ever tapped the X. Only storage is written, not state: it stays on
    // screen for the rest of this visit so it can actually be read.
    if (!showWhatsNew) return;
    const settle = window.setTimeout(() => {
      setNewsSeen(true);
      try {
        window.localStorage.setItem(SEEN_RELEASE_KEY, LATEST_RELEASE_ID);
      } catch {
        // Storage blocked. It will come back next time, and that is the
        // lesser of the two failures.
      }
    }, 1_200);
    return () => window.clearTimeout(settle);
  }, [showWhatsNew]);


  // Reminders that survive a closed app are new, and off by default, so the
  // people who would most want them are the ones who will never find them.
  // The rules for when this is worth interrupting anyone live in
  // domain/reminderNudge.ts.
  // Asked once with the key assumed present: everything except the one
  // condition that costs a request. Null here means the banner was never
  // going to show, and the key is never asked for.
  const wouldNudge = reminderNudge(
    {
      pushReady: PUSH_CAPABLE,
      permission: notificationPermission,
      remindersOn: reminders.feedEnabled || Boolean(reminders.diaperEnabled),
      feeds: feedCount,
      dismissedAt: reminderDismissedAt,
    },
    minuteClock,
  );

  useEffect(() => {
    if (!wouldNudge || pushReady !== null) return;
    let alive = true;
    fetch("/api/push/key")
      .then((response) => (response.ok ? (response.json() as Promise<{ key?: string }>) : null))
      .then((body) => { if (alive) setPushReady(Boolean(body?.key)); })
      .catch(() => { if (alive) setPushReady(false); });
    return () => { alive = false; };
  }, [wouldNudge, pushReady]);

  const pendingReminderNudge = pushReady ? wouldNudge : null;

  const lastDiaperAt = sortedActivities.find((a) => a.type === "diaper")?.startedAt;
  const diaperReminderTargetAt = lastDiaperAt && reminders.diaperEnabled
    ? new Date(lastDiaperAt).getTime() + (reminders.diaperIntervalMinutes ?? 120) * 60_000
    : null;

  const feedReminderTargetAt = lastFeed
    ? new Date(lastFeed.startedAt).getTime() + reminders.feedIntervalMinutes * 60_000
    : null;

  // The half that survives the app being closed.
  //
  // Once the server HAS the alarm it owns it outright, and the in-page timers
  // below stand down (see pushArmed). They used to run alongside it, relying
  // on a shared notification tag to collapse the two — which is not the same
  // as one reminder: the phone still alerts twice, and being buzzed a second
  // time for a feed you already knew about is exactly the kind of thing that
  // gets an app's notifications turned off. The cost is that a reminder can
  // now be up to five minutes late while the app is open, since the cron is
  // what rings it; that is the right way round, because a parent with the app
  // open is already looking at the thing the reminder would tell them.
  //
  // The timers remain the fallback for a phone with no subscription — no
  // signing key, a refused subscribe — where the alternative is no reminder.
  //
  // What the server is told is two timestamps and nothing else: not the
  // baby, not the entry, not how long it has been. It is an alarm clock.
  useEffect(() => {
    if (notificationPermission !== "granted") return;
    const feedDueAt = reminders.feedEnabled && feedReminderTargetAt !== null
      ? new Date(feedReminderTargetAt).toISOString()
      : null;
    const diaperDueAt = reminders.diaperEnabled && diaperReminderTargetAt !== null
      ? new Date(diaperReminderTargetAt).toISOString()
      : null;
    // Fetched on the tap that needs it: a phone that never allowed
    // notifications should not carry the subscription code in its first
    // download, and by the time this runs the app has long since opened.
    void import("./domain/pushClient").then(async (push) => {
      if (feedDueAt === null && diaperDueAt === null) {
        await push.stopPush();
        setPushArmed(false);
        return;
      }
      // False means the server does not have it — no key, no subscription, a
      // refused permission, a request that failed — and the in-page timers
      // are the only thing left.
      setPushArmed(await push.sendSchedule({ feedDueAt, diaperDueAt }));
    });
  }, [
    notificationPermission,
    reminders.feedEnabled,
    reminders.diaperEnabled,
    feedReminderTargetAt,
    diaperReminderTargetAt,
  ]);

  useEffect(() => {
    // The server has it: one alarm, one alert. See the schedule effect above.
    if (pushArmed) return;
    if (
      !reminders.feedEnabled ||
      notificationPermission !== "granted" ||
      !feedReminderTargetAt ||
      !("serviceWorker" in navigator)
    ) return;

    const delay = feedReminderTargetAt - Date.now();
    if (delay <= 0 || delay > MAX_REMINDER_DELAY_MS) return;
    const timer = window.setTimeout(() => {
      void navigator.serviceWorker.ready
        .then((registration) => registration.showNotification("Time to check feeding cues", {
          // No name on a lock screen — the notification may show in a shared room.
          body: "A feed reminder is due. Follow your baby’s cues and care plan.",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: "feed-reminder",
          data: { url: "/" },
        }))
        .catch(() => undefined);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [feedReminderTargetAt, lastFeed?.id, notificationPermission, pushArmed, reminders.feedEnabled]);

  useEffect(() => {
    if (pushArmed) return;
    if (
      !reminders.diaperEnabled ||
      notificationPermission !== "granted" ||
      !diaperReminderTargetAt ||
      !("serviceWorker" in navigator)
    ) return;

    const delay = diaperReminderTargetAt - Date.now();
    if (delay <= 0 || delay > MAX_REMINDER_DELAY_MS) return;
    const timer = window.setTimeout(() => {
      void navigator.serviceWorker.ready
        .then((registration) => registration.showNotification("Diaper check", {
          // No name on a lock screen — this may show in a shared room.
          body: "It has been a while since the last change.",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: "diaper-reminder",
          data: { url: "/" },
        }))
        .catch(() => undefined);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [diaperReminderTargetAt, lastDiaperAt, notificationPermission, pushArmed, reminders.diaperEnabled]);

  // Every navigation leaves the guide, so returning to Insights later starts
  // at the Insights content — never a stale sub-screen.
  const navigateTo = useCallback((tab: Tab) => {
    track("tab_viewed", { tab });
    setActiveTab(tab);
  }, []);

  function openSheet(next: Exclude<Sheet, null>, nursingMode: "timer" | "manual" = "timer") {
    track("sheet_opened", { sheet: next, mode: nursingMode });
    sheetTriggerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setEditingActivity(null);
    setNursingInitialMode(nursingMode);
    setSheet(next);
  }

  const openEdit = useCallback((activity: Activity) => {
    track("entry_edit_opened", { type: activity.type });
    sheetTriggerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setEditingActivity(activity);
    setSheet("edit");
  }, []);

  // Stable identities for everything Today receives, so React.memo on the
  // screen holds: the store's actions are fresh closures every render, and a
  // fresh function is a fresh prop.
  const onAdd = useStableCallback(addActivity);
  const onStopTimer = useStableCallback(stopTimer);
  const onOpenSheet = useStableCallback((next: Exclude<Sheet, null>) => openSheet(next));
  const onManualNursing = useStableCallback(() => openSheet("nursing", "manual"));
  const onSeeTimeline = useStableCallback(() => navigateTo("timeline"));
  const onOpenProtection = useStableCallback(() => {
    track("cloud_note_tapped", { synced: Boolean(familySync.pairing) });
    // Unprotected -> the doors, right here. Synced -> the details.
    if (familySync.pairing) navigateTo("more");
    else setProtectAsk((n) => n + 1);
  });
  const cloudState = !familySync.pairing
    ? "none"
    : familySync.status.phase === "revoked"
      ? "revoked"
      : familySync.status.phase === "offline"
        ? "offline"
        : familySync.status.phase === "syncing" ? "syncing" : "synced";

  function exitDebugPreview() {
    const url = new URL(window.location.href);
    url.searchParams.delete("debug");
    window.location.replace(url.toString());
  }

  if (bootState === "loading") {
    return (
      <main className="loading-screen" aria-label="Loading Numalog">
        <SleepingBaby size={64} aria-hidden="true" />
        <span>Numalog</span>
      </main>
    );
  }

  // Someone is moving their log to the app's other web address, and this is
  // the address holding it. readHandoffTarget has already refused anything not
  // on the allowlist; what remains is asking the person whose log it is.
  const handoffTarget = window.location.pathname === HANDOFF_PATH
    ? readHandoffTarget(window.location.hash, window.location.origin)
    : null;
  if (handoffTarget) {
    return (
      <Suspense fallback={screenFallback}>
        <HandoffScreen
          target={handoffTarget}
          babyName={profile.name.trim()}
          entryCount={activities.filter((activity) => !activity.deleted).length}
          onDownloadInstead={exportData}
          onCancel={() => window.location.replace("/")}
          onSend={async () => {
            track("handoff_sent");
            try {
              const packed = await packHandoff(exportPayload());
              if (!packed) return "too-large" as const;
              window.location.replace(handoffReturnUrl(handoffTarget, packed));
              return "sent" as const;
            } catch {
              return "failed" as const;
            }
          }}
        />
      </Suspense>
    );
  }

  // A scanned invite on an empty phone skips onboarding entirely: the profile
  // and the whole history are about to arrive over the sync, so asking this
  // parent to type a name and a birth date would be asking them to invent a
  // baby that already exists.
  if (bootState === "onboarding" && incomingJoinCode && !familySync.pairing) {
    return (
      <Suspense fallback={screenFallback}>
        <JoinFamilyScreen
          code={incomingJoinCode}
          familySync={familySync}
          onJoined={completeJoin}
          onSkip={() => setIncomingJoinCode(null)}
        />
      </Suspense>
    );
  }

  if (bootState === "onboarding" || bootState === "recovery") {
    return (
      <>
      <Suspense fallback={screenFallback}>
      <OnboardingScreen
        mode={bootState}
        profile={profile}
        nightMode={nightMode}
        storageWarning={storageWarning}
        familySync={familySync}
        onGoogleRestored={completeJoin}
        onNightModeChange={changeNightMode}
        onComplete={(nextProfile) => {
          const done = completeOnboarding(nextProfile);
          if (done) setJustOnboarded(true);
          return done;
        }}
        onRestore={(event) => importData(event)}
        onDownloadRecovery={downloadRecovery}
        onResetRecovery={resetUnreadableData}
      />
      </Suspense>
      {recoverAsk && (
        <Suspense fallback={null}>
          <RecoverLinkDialog
            token={recoverAsk}
            familySync={familySync}
            onRecovered={() => { completeJoin(); }}
            onClosed={() => setRecoverAsk(null)}
          />
        </Suspense>
      )}
      {/* No consent question on this screen, deliberately.
          This is the first ten seconds for everyone who arrives from a link,
          and it is a good ten seconds — an illustration, a headline, three
          lines about what the app does. A permissions dialog landing across
          the middle of it was the SECOND thing a stranger saw, before the app
          had given them anything, and it made a handsome page look broken.
          Nothing is lost by waiting: analytics stays denied until somebody
          says otherwise, so no measurement happens in the meantime. The
          question is asked once they are in the app and it means something. */}
      </>
    );
  }

  return (
    <SidebarProvider defaultOpen={sidebarDefaultOpen} className="numa-shell">
      <AppSidebar
        activeTab={activeTab}
        onNavigate={navigateTo}
        profile={profile}
        onProfile={() => openSheet("profile")}
      />
      <SidebarInset className="app-frame">
        <header className="topbar">
          <div className="topbar-start">
            <NavTrigger />
            <span className="topbar-page-title">
              {activeTab === "more"
                ? "Settings"
                : activeTab[0].toUpperCase() + activeTab.slice(1)}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="topbar-news"
            aria-label={releasesToShow.length > 0 && !newsSeen ? "News and updates — something new" : "News and updates"}
            onClick={() => {
              track("news_opened", { from: "topbar" });
              setNewsOpen(true);
              // Opening the archive IS reading the news: badge off, and the
              // what's-new card stands down for this release too.
              setNewsSeen(true);
              try {
                window.localStorage.setItem(SEEN_RELEASE_KEY, LATEST_RELEASE_ID);
              } catch { /* storage blocked — the badge returns next visit */ }
            }}
          >
            <Newspaper />
            {releasesToShow.length > 0 && !newsSeen && <span className="news-badge" aria-hidden="true" />}
          </Button>
          <Button variant="ghost" className="baby-identity" aria-label="Baby profile" onClick={() => openSheet("profile")}>
            <span className="baby-avatar"><BabyFace size={22} /></span>
            <span>
              <strong>{profile.name}</strong>
              <small>Baby profile</small>
            </span>
            <ChevronRight size={16} />
          </Button>
        </header>

        {debugMode && (
          <div className="banner-stack">
            <div className="debug-banner" role="status">
              <span><Stethoscope /><span><strong>Debug preview</strong><small>Fake data only · your saved tracker is untouched</small></span></span>
              <Button variant="outline" size="sm" onClick={exitDebugPreview}>Exit preview</Button>
            </div>
          </div>
        )}

        {storageWarning && (
          <div className="banner-stack">
            <div className="storage-banner" role="alert">
              <ShieldCheck size={19} />
              <span><strong>Back up your entries.</strong> {storageWarning}</span>
              <div>
                <Button onClick={exportData}>Download backup</Button>
              </div>
            </div>
          </div>
        )}

        <InAppEscape />

        {recoveredNotice && (
          <div className="banner-stack">
            {/* Its own class: the debug banner clips its small text to one
                line with an ellipsis, which is fine for "Fake data only" and
                wrong for a sentence explaining that entries could not be read.
                A message about lost data must not itself be cut off. */}
            <div className="debug-banner recovered-banner" role="alert">
              <span><ShieldCheck /><span><strong>Some entries were skipped</strong><small>{recoveredNotice}</small></span></span>
              <Button variant="outline" size="sm" onClick={dismissRecoveredNotice}>OK</Button>
            </div>
          </div>
        )}

        {/* Asked once there is something worth losing, and not before. The
            rules live in domain/backupNudge.ts so they can be tested rather
            than argued about. */}
        {/* Gated on releases EXISTING, not on the tab-dependent showWhatsNew
            flag — otherwise the nudge shows on Timeline and vanishes the
            moment the person returns to Today, which reads as a glitch. */}
        {nightHelp && activeTab === "today" && !milestoneToday && !protectMoment && (
          <Suspense fallback={null}>
            <NightHelp
              name={profile.name}
              onInvite={() => { track("night_help_accepted"); closeNightHelp(); navigateTo("more"); }}
              onDismiss={() => { track("night_help_dismissed"); closeNightHelp(); }}
            />
          </Suspense>
        )}

        {pendingBackupNudge && !pendingReminderNudge && !nightHelp && !milestoneToday && !protectMoment && releasesToShow.length === 0 && !familySync.pairing && (
          <Suspense fallback={null}>
          <BackupNudgeCard
            nudge={pendingBackupNudge}
            onBackup={() => { track("backup_nudge_accepted"); exportData(); }}
            onDismiss={() => {
              track("backup_nudge_dismissed");
              const at = new Date().toISOString();
              try { window.localStorage.setItem(BACKUP_DISMISSED_KEY, at); } catch { /* storage blocked */ }
              setBackupDismissedAt(at);
            }}
          />
          </Suspense>
        )}

        {/* Last in the stack, and never alongside the changelog that already
            announces it — one mention of a new thing is an announcement, two
            is nagging. */}
        {/* Ahead of the backup nudge, and NOT held back by the changelog.
            Both of those were here and both were wrong: the backup nudge
            returns every fortnight for ever while this is a one-off that a
            single tap resolves, so deferring to it meant a phone with an
            overdue backup never saw this at all — and the changelog card
            lives further down the page, so waiting for it to be gone was
            waiting on something that was never in the way. Only the moments
            that own the whole screen still come first. */}
        {pendingReminderNudge && !nightHelp && !milestoneToday && !protectMoment && activeTab === "today" && (
          <Suspense fallback={null}>
            <ReminderNudgeCard
              nudge={pendingReminderNudge}
              onEnable={() => { track("reminder_nudge_accepted"); void changeFeedReminders(true); }}
              onDismiss={() => {
                track("reminder_nudge_dismissed");
                const at = new Date().toISOString();
                try { window.localStorage.setItem(REMINDER_NUDGE_KEY, at); } catch { /* storage blocked */ }
                setReminderDismissedAt(at);
              }}
            />
          </Suspense>
        )}

        <main className="content">
          {showWhatsNew && (
            <Suspense fallback={null}>
            <WhatsNew
              releases={releasesToShow}
              onDismiss={() => {
                track("whats_new_dismissed", { release: LATEST_RELEASE_ID });
                markReleasesSeen();
              }}
            />
            </Suspense>
          )}

          {activeTab === "today" && (
            <TodayScreen
              profile={profile}
              nightMode={nightMode}
              minuteClock={minuteClock}
              stats={stats}
              celebration={celebration}
              milestoneTotals={milestoneTotals}
              onDismissCelebration={dismissCelebration}
              onAdd={onAdd}
              onStopTimer={onStopTimer}
              onOpenSheet={onOpenSheet}
              onManualNursing={onManualNursing}
              onEdit={openEdit}
              onSeeTimeline={onSeeTimeline}
              cloudState={cloudState}
              onOpenProtection={onOpenProtection}
            />
          )}

          {activeTab === "timeline" && (
            <Suspense fallback={screenFallback}>
              <TimelineScreen
                activities={sortedActivities}
                minuteClock={minuteClock}
                filter={timelineFilter}
                limit={timelineLimit}
                onFilterChange={(value) => {
                  setTimelineFilter(value);
                  setTimelineLimit(80);
                }}
                onShowMore={() => setTimelineLimit((value) => value + 80)}
                onEdit={openEdit}
              />
            </Suspense>
          )}

          {activeTab === "insights" && (
            <Suspense fallback={screenFallback}>
              <InsightsScreen
                activities={activities}
                profile={profile}
                ageDays={ageInDays(profile.birthDate, minuteClock)}
                feedingMode={profile.feedingMode}
                minuteClock={minuteClock}
                stats={stats}
                onAddGrowth={() => openSheet("growth")}
                onOpenGuide={() => navigateTo("guide")}
              />
            </Suspense>
          )}

          {activeTab === "guide" && (
            <Suspense fallback={screenFallback}>
              <GrowthGuideScreen
                profile={profile}
                latestGrowth={stats.latestGrowth}
                minuteClock={minuteClock}
              />
            </Suspense>
          )}

          {activeTab === "more" && (
            <Suspense fallback={screenFallback}>
              <SettingsScreen
                entryCount={activities.filter((activity) => !activity.deleted).length}
                profile={profile}
                themeChoice={themeChoice}
                reminders={reminders}
                notificationPermission={notificationPermission}
                feedReminderTargetAt={feedReminderTargetAt}
                minuteClock={minuteClock}
                onThemeChange={changeTheme}
                onFeedRemindersChange={changeFeedReminders}
                onFeedIntervalChange={changeFeedReminderInterval}
                onDiaperRemindersChange={changeDiaperReminders}
                onDiaperIntervalChange={changeDiaperReminderInterval}
                diaperReminderTargetAt={diaperReminderTargetAt}
                onExport={exportData}
                onShare={() => void sharePartner()}
                onImport={importData}
                onOpenProfile={() => openSheet("profile")}
                onEraseAll={() => {
                  // ONE confirm gates EVERYTHING. The audit caught the
                  // original order committing the worst possible sin: leave
                  // and sweep ran before/regardless of the confirm, so
                  // CANCEL still unpaired the phone and deleted the blob —
                  // cancel-as-wipe. Now nothing at all happens unless
                  // eraseAllData reports that the person confirmed and the
                  // blob is gone; only then does the device leave its
                  // family and every numa-/numalog- key follow. The cloud
                  // copy belongs to the family's other devices either way.
                  if (!eraseAllData()) return;
                  familySync.leaveFamily();
                  try {
                    const doomed: string[] = [];
                    for (let i = 0; i < window.localStorage.length; i += 1) {
                      const key = window.localStorage.key(i);
                      if (key && (key.startsWith("numa-") || key.startsWith("numalog-"))) doomed.push(key);
                    }
                    doomed.forEach((key) => window.localStorage.removeItem(key));
                  } catch {
                    // The blob is already gone; the sweep is best-effort.
                  }
                }}
                familySync={familySync}
                incomingJoinCode={incomingJoinCode}
                onIncomingCodeUsed={() => setIncomingJoinCode(null)}
              />
            </Suspense>
          )}
        </main>

        <nav className="bottom-nav" aria-label="Primary navigation">
          {bottomNavItems.map((item) => (
            <button
              key={item.value}
              type="button"
              className="bottom-nav-item"
              aria-current={activeTab === item.value ? "page" : undefined}
              onClick={() => navigateTo(item.value)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        {/* Hidden while the consent banner owns the same corner, and while a
            log sheet is open — nothing competes with the 3am flow. On every
            tab otherwise, by the owner's explicit call: with this many real
            families writing in, being reachable beats the corner it costs. */}
        <FeedbackBubble hidden={consent === null || sheet !== null} />

        {/* The protect announcement: once, only to a settled family (real
            entries, consent question answered, no sheet open), never during
            its own first minutes. The component retires itself for families
            already guarded. */}
        {newsOpen && (
          <Suspense fallback={null}>
            <NewsDialog open={newsOpen} onOpenChange={setNewsOpen} />
          </Suspense>
        )}
        {protectAsk > 0 && (
          <Suspense fallback={null}>
            <ProtectIntro key={protectAsk} familySync={familySync} forced fresh={activities.length === 0} onClosed={() => setProtectAsk(0)} onInvitePartner={() => navigateTo("more")} />
          </Suspense>
        )}
        {recoverAsk && (
          <Suspense fallback={null}>
            <RecoverLinkDialog
              token={recoverAsk}
              familySync={familySync}
              onClosed={() => setRecoverAsk(null)}
            />
          </Suspense>
        )}
        {protectMoment && protectAsk === 0 && (
          <Suspense fallback={null}>
            <ProtectIntro familySync={familySync} fresh={activities.length === 0} onClosed={() => setProtectIntroDone(true)} onInvitePartner={() => navigateTo("more")} />
          </Suspense>
        )}

        {consent === null && sheet === null && (
          <ConsentBanner
            onChoose={(choice) => {
              setConsent(choice);
              track("consent_answered", { choice });
            }}
          />
        )}

        <Suspense fallback={null}>
          <Toaster
            theme={nightMode ? "dark" : "light"}
            position="bottom-center"
            closeButton
            mobileOffset={{
              // The consent banner owns the bottom band until answered —
              // toasts lift above it rather than landing on its Allow button.
              bottom: consent === null ? "calc(248px + env(safe-area-inset-bottom))" : "calc(96px + env(safe-area-inset-bottom))",
              left: "12px",
              right: "12px",
            }}
            offset={{ bottom: "24px" }}
          />
        </Suspense>

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
              {/* The grab pill is the universal "pull me down" affordance, and
                  it did nothing at all. Now it closes — so there is an exit at
                  the BOTTOM of the sheet, where the thumb already is, instead
                  of only the X in the far top corner. */}
              <button
                type="button"
                className="sheet-handle"
                aria-label="Close"
                onClick={() => setSheet(null)}
              />
              <Suspense fallback={null}>
              <LogSheet
                key={sheet === "edit" ? editingActivity?.id : sheet}
                sheet={sheet}
                editingActivity={editingActivity}
                initialNursingMode={nursingInitialMode}
                lastBottle={lastBottle}
                activeNursing={activeNursing}
                activities={activities}
                babyAgeMonths={babyAgeMonths}
                profile={profile}
                onAdd={addActivity}
                onUpdate={updateActivity}
                onRemove={removeActivity}
                onSaveProfile={saveProfile}
                onClose={() => setSheet(null)}
                showToast={showToast}
              />
              </Suspense>
            </DialogContent>
          )}
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  );
}
