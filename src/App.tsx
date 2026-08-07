import {
  Baby,
  BarChart3,
  ChevronRight,
  Clock,
  Home,
  Settings,
  ShieldCheck,
  Stethoscope,
} from "lucide-react";
import { Suspense, lazy, useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "./components/ui/button";
import { Dialog, DialogContent } from "./components/ui/dialog";
import { Separator } from "./components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "./components/ui/sidebar";
import { Toaster } from "./components/ui/sonner";
import { AppSidebar } from "./components/AppSidebar";
import { LogSheet } from "./components/LogSheet";
import OnboardingScreen from "./screens/OnboardingScreen";
import SettingsScreen from "./screens/SettingsScreen";
import TodayScreen from "./screens/TodayScreen";
import { Activity, ActivityType, Sheet, Tab } from "./domain/types";
import { useActivityStats } from "./hooks/useActivityStats";
import { useMinuteClock } from "./hooks/useMinuteClock";
import { useTrackerStore } from "./hooks/useTrackerStore";

// The chart-heavy screens load on first visit; Today never pays for them.
const TimelineScreen = lazy(() => import("./screens/TimelineScreen"));
const InsightsScreen = lazy(() => import("./screens/InsightsScreen"));
const GrowthGuideScreen = lazy(() => import("./screens/GrowthGuideScreen"));

// A future-dated feed from a restored backup must never arm a timer that wraps
// the 32-bit setTimeout ceiling and fires instantly.
const MAX_REMINDER_DELAY_MS = 24 * 60 * 60_000;

const bottomNavItems: Array<{ value: Tab; label: string; icon: React.ReactNode }> = [
  { value: "today", label: "Today", icon: <Home size={20} /> },
  { value: "timeline", label: "Timeline", icon: <Clock size={20} /> },
  { value: "insights", label: "Insights", icon: <BarChart3 size={20} /> },
  { value: "more", label: "Settings", icon: <Settings size={20} /> },
];

export default function HomePage() {
  const [debugMode] = useState(() => new URLSearchParams(window.location.search).has("debug"));
  const [activeTab, setActiveTab] = useState<Tab>("today");
  // The Growth guide renders in place of the Insights content — one entry
  // point (the growth figure), a back button, no extra nav tab.
  const [guideOpen, setGuideOpen] = useState(false);
  const [sheet, setSheet] = useState<Sheet>(null);
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
    changeFeedReminders,
    changeFeedReminderInterval,
    exportData,
    importData,
    downloadRecovery,
    resetUnreadableData,
    dismissRecoveredNotice,
  } = useTrackerStore({ debugMode, showToast, onNotificationPermission: setNotificationPermission });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", nightMode);
    document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
      ?.setAttribute("content", nightMode ? "#1d1a15" : "#f7f6f2");
  }, [nightMode]);

  const stats = useActivityStats(activities, profile, minuteClock);
  const { sortedActivities, lastFeed, lastBottle, activeNursing, babyAgeMonths } = stats;

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

  // Every navigation leaves the guide, so returning to Insights later starts
  // at the Insights content — never a stale sub-screen.
  const navigateTo = useCallback((tab: Tab) => {
    setGuideOpen(false);
    setActiveTab(tab);
  }, []);

  function openSheet(next: Exclude<Sheet, null>, nursingMode: "timer" | "manual" = "timer") {
    sheetTriggerRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    setEditingActivity(null);
    setNursingInitialMode(nursingMode);
    setSheet(next);
  }

  const openEdit = useCallback((activity: Activity) => {
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
        onNavigate={navigateTo}
        profile={profile}
        onProfile={() => openSheet("profile")}
      />
      <SidebarInset className="app-frame">
        <header className="topbar">
          <div className="topbar-start">
            <SidebarTrigger className="sidebar-trigger" aria-label="Open navigation" />
            <Separator orientation="vertical" className="topbar-separator" />
            <span className="topbar-page-title">
              {activeTab === "more" ? "Settings" : activeTab[0].toUpperCase() + activeTab.slice(1)}
            </span>
          </div>
          <Button variant="ghost" className="baby-identity" aria-label="Baby profile" onClick={() => openSheet("profile")}>
            <span className="baby-avatar"><Baby size={19} /></span>
            <span>
              <strong>{profile.name}</strong>
              <small>Your private log</small>
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
              <span><strong>Local data needs attention.</strong> {storageWarning}</span>
              <div>
                <Button onClick={exportData}>Download backup</Button>
              </div>
            </div>
          </div>
        )}

        {recoveredNotice && (
          <div className="banner-stack">
            <div className="debug-banner" role="status">
              <span><ShieldCheck /><span><strong>Some entries were skipped</strong><small>{recoveredNotice}</small></span></span>
              <Button variant="outline" size="sm" onClick={dismissRecoveredNotice}>OK</Button>
            </div>
          </div>
        )}

        <main className="content">
          {activeTab === "today" && (
            <TodayScreen
              profile={profile}
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
            <Suspense fallback={null}>
              <TimelineScreen
                activities={sortedActivities}
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
            <Suspense fallback={null}>
              {guideOpen ? (
                <GrowthGuideScreen
                  profile={profile}
                  latestGrowth={stats.latestGrowth}
                  onBack={() => setGuideOpen(false)}
                />
              ) : (
                <InsightsScreen
                  stats={stats}
                  onAddGrowth={() => openSheet("growth")}
                  onOpenGuide={() => setGuideOpen(true)}
                />
              )}
            </Suspense>
          )}

          {activeTab === "more" && (
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
              onExport={exportData}
              onImport={importData}
              onOpenProfile={() => openSheet("profile")}
            />
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
              <div className="sheet-handle" />
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
            </DialogContent>
          )}
        </Dialog>
      </SidebarInset>
    </SidebarProvider>
  );
}
