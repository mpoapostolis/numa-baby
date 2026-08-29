import {
  BarChart3,
  ChevronRight,
  Clock,
  Home,
  Ruler,
  Settings,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "./components/ui/button";
import { Dialog, DialogContent } from "./components/ui/dialog";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "./components/ui/sidebar";
import { Toaster } from "./components/ui/sonner";
import { AppSidebar } from "./components/AppSidebar";
import { BabyFace, SleepingBaby } from "./components/illustrations";
import { ConsentBanner } from "./components/ConsentBanner";
import { FeedbackBubble } from "./components/FeedbackBubble";
import OnboardingScreen from "./screens/OnboardingScreen";
import TodayScreen from "./screens/TodayScreen";
import { Activity, ActivityType, Sheet, Tab } from "./domain/types";
import { JOIN_CODE_PATTERN } from "./domain/familyPairing";
import { track, suppressTracking } from "./domain/analytics";
import { LATEST_RELEASE_ID, unseenReleases } from "./domain/changelog";
import { parseStoredData } from "./domain/validate";
import {
  HANDOFF_PATH,
  handoffReturnUrl,
  readHandoffPayload,
  readHandoffTarget,
} from "./domain/handoff";
import { readConsent } from "./domain/consent";
import { ageInDays } from "./domain/time";
import { useActivityStats } from "./hooks/useActivityStats";
import { useFamilySync } from "./hooks/useFamilySync";
import { useMinuteClock } from "./hooks/useMinuteClock";
import { useCloseOnBack } from "./hooks/useCloseOnBack";
import { useTrackerStore } from "./hooks/useTrackerStore";

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

// A scanned invite arrives as "/#join=123456". Read once at boot and strip it
// from the URL, so a refresh (or a shared screenshot of the address bar) never
// replays a join that already happened.
function readIncomingJoinCode(): string | null {
  const match = JOIN_CODE_PATTERN.exec(window.location.hash);
  if (!match) return null;
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return match[1];
}

export default function HomePage() {
  const [debugMode] = useState(() => {
    const on = new URLSearchParams(window.location.search).has("debug");
    if (on) suppressTracking();
    return on;
  });
  const [incomingJoinCode, setIncomingJoinCode] = useState(readIncomingJoinCode);
  // A scanned link opens straight on Settings, where Family Sync lives. Read
  // from the state above, never from the hash — by now it has been stripped.
  const [activeTab, setActiveTab] = useState<Tab>(incomingJoinCode ? "more" : "today");
  const [sheet, setSheet] = useState<Sheet>(null);
  // null = never asked. The banner shows only then, so a parent is asked once
  // rather than on every one of the six visits they make in a night.
  const [consent, setConsent] = useState(readConsent);
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

  const closeSheet = useCallback(() => setSheet(null), []);
  // On Android, back is how you leave a screen — and a sheet is a screen.
  // Without this it pops the app's own (empty) history and closes everything.
  useCloseOnBack(Boolean(sheet), closeSheet);

  function showToast(message: string, undo?: () => void) {
    toast(message, {
      duration: 4_200,
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
    recoveredNotice,
    addActivity,
    updateActivity,
    removeActivity,
    stopTimer,
    changeNightMode,
    saveProfile,
    completeOnboarding,
    completeJoin,
    changeFeedReminders,
    changeFeedReminderInterval,
    changeDiaperReminders,
    changeDiaperReminderInterval,
    persistVersion,
    mergeRemote,
    readPersisted,
    stampProfileForSync,
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
    readPersisted,
    stampProfileForSync,
    mergeRemote,
    showToast,
  });

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

  function markReleasesSeen() {
    try {
      window.localStorage.setItem(SEEN_RELEASE_KEY, LATEST_RELEASE_ID);
    } catch {
      // Nothing to do — the card simply reappears next time.
    }
    setSeenRelease(LATEST_RELEASE_ID);
  }

  const stats = useActivityStats(activities, profile, minuteClock);
  const { sortedActivities, lastFeed, lastBottle, activeNursing, babyAgeMonths } = stats;

  const releasesToShow = seenRelease === null && sortedActivities.length === 0
    ? []
    : unseenReleases(seenRelease);
  const showWhatsNew = activeTab === "today" && releasesToShow.length > 0;

  useEffect(() => {
    // Everything is new to someone who just arrived; greeting them with a
    // changelog is noise. Record the latest and say nothing.
    if (seenRelease === null && bootState === "ready" && sortedActivities.length === 0) {
      try {
        window.localStorage.setItem(SEEN_RELEASE_KEY, LATEST_RELEASE_ID);
      } catch {
        // Nothing to do.
      }
    }
  }, [seenRelease, bootState, sortedActivities.length]);

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
    void import("./domain/handoff")
      .then(({ unpackHandoff }) => unpackHandoff(payload))
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
      try {
        window.localStorage.setItem(SEEN_RELEASE_KEY, LATEST_RELEASE_ID);
      } catch {
        // Storage blocked. It will come back next time, and that is the
        // lesser of the two failures.
      }
    }, 1_200);
    return () => window.clearTimeout(settle);
  }, [showWhatsNew]);


  const lastDiaperAt = sortedActivities.find((a) => a.type === "diaper")?.startedAt;
  const diaperReminderTargetAt = lastDiaperAt && reminders.diaperEnabled
    ? new Date(lastDiaperAt).getTime() + (reminders.diaperIntervalMinutes ?? 120) * 60_000
    : null;

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
    if (delay <= 0 || delay > MAX_REMINDER_DELAY_MS) return;
    const timer = window.setTimeout(() => {
      void navigator.serviceWorker.ready
        .then((registration) => registration.showNotification("Time to check feeding cues", {
          // No name on a lock screen — the notification may show in a shared room.
          body: "A feed reminder is due. Follow your baby’s cues and care plan.",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: `feed-reminder-${lastFeed?.id ?? "latest"}`,
          data: { url: "/" },
        }))
        .catch(() => undefined);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [feedReminderTargetAt, lastFeed?.id, notificationPermission, reminders.feedEnabled]);

  useEffect(() => {
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
        .then((registration) => registration.showNotification("Nappy check", {
          // No name on a lock screen — this may show in a shared room.
          body: "It has been a while since the last change.",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: `diaper-reminder-${lastDiaperAt ?? "latest"}`,
          data: { url: "/" },
        }))
        .catch(() => undefined);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [diaperReminderTargetAt, lastDiaperAt, notificationPermission, reminders.diaperEnabled]);

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

  function exitDebugPreview() {
    const url = new URL(window.location.href);
    url.searchParams.delete("debug");
    window.location.replace(url.toString());
  }

  if (bootState === "loading") {
    return (
      <main className="loading-screen" aria-label="Loading Baby Tracker">
        <SleepingBaby size={64} aria-hidden="true" />
        <span>Baby Tracker</span>
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
              const { packHandoff } = await import("./domain/handoff");
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
      {/* The landing screen is where most first-time visitors stop, so the
          question has to be asked here too — not only once someone has
          finished setting a baby up. */}
      {consent === null && (
        <ConsentBanner
          onChoose={(choice) => {
            setConsent(choice);
            track("consent_answered", { choice, screen: "onboarding" });
          }}
        />
      )}
      <FeedbackBubble hidden={consent === null} />
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

        {recoveredNotice && (
          <div className="banner-stack">
            <div className="debug-banner" role="alert">
              <span><ShieldCheck /><span><strong>Some entries were skipped</strong><small>{recoveredNotice}</small></span></span>
              <Button variant="outline" size="sm" onClick={dismissRecoveredNotice}>OK</Button>
            </div>
          </div>
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
              onAdd={addActivity}
              onStopTimer={stopTimer}
              onOpenSheet={openSheet}
              onManualNursing={() => openSheet("nursing", "manual")}
              onEdit={openEdit}
              onSeeTimeline={() => navigateTo("timeline")}
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
                profile={profile}
                nightMode={nightMode}
                reminders={reminders}
                notificationPermission={notificationPermission}
                feedReminderTargetAt={feedReminderTargetAt}
                minuteClock={minuteClock}
                onNightModeChange={changeNightMode}
                onFeedRemindersChange={changeFeedReminders}
                onFeedIntervalChange={changeFeedReminderInterval}
                onDiaperRemindersChange={changeDiaperReminders}
                onDiaperIntervalChange={changeDiaperReminderInterval}
                diaperReminderTargetAt={diaperReminderTargetAt}
                onExport={exportData}
                onShare={() => void sharePartner()}
                onImport={importData}
                onOpenProfile={() => openSheet("profile")}
                onEraseAll={eraseAllData}
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
            log sheet is open — nothing competes with the 3am flow. */}
        <FeedbackBubble hidden={consent === null || sheet !== null} />

        {consent === null && (
          <ConsentBanner
            onChoose={(choice) => {
              setConsent(choice);
              track("consent_answered", { choice });
            }}
          />
        )}

        <Toaster
          theme={nightMode ? "dark" : "light"}
          position="bottom-center"
          closeButton
          mobileOffset={{ bottom: "calc(96px + env(safe-area-inset-bottom))", left: "12px", right: "12px" }}
          offset={{ bottom: "24px" }}
        />

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
