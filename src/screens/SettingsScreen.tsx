// Ships with this lazy chunk, not the app shell — the budget rule.
import "../styles/screens/settings.css";
import { ArrowLeftRight, Baby, Bell, Download, Moon, Ruler, Share2, ShieldCheck, Sun, Trash2, Upload } from "lucide-react";
import { ChangeEvent, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from "../components/ui/item";
import { Switch } from "../components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group";
import { FamilySyncCard } from "../components/FamilySyncCard";
import { FeedbackCard } from "../components/FeedbackCard";
import { AppNews } from "../components/AppNews";
import { InstallGuide } from "../components/InstallGuide";
import { SettingsAction } from "../components/SettingsAction";
import { track } from "../domain/analytics";
import { ConsentChoice, readConsent, saveConsent } from "../domain/consent";
import { UnitSystem, setUnits, useUnits } from "../domain/units";
import { formatTime } from "../domain/time";
import { FamilySync } from "../hooks/useFamilySync";
import { handoffPeers, handoffSendUrl, originLabel } from "../domain/handoff";
import { Profile, ReminderSettings } from "../domain/types";

type SettingsScreenProps = {
  profile: Profile;
  nightMode: boolean;
  reminders: ReminderSettings;
  notificationPermission: NotificationPermission | "unsupported";
  feedReminderTargetAt: number | null;
  diaperReminderTargetAt: number | null;
  minuteClock: number;
  onNightModeChange: (enabled: boolean) => void;
  onFeedRemindersChange: (enabled: boolean) => Promise<void>;
  onFeedIntervalChange: (minutes: number) => void;
  onDiaperRemindersChange: (enabled: boolean) => Promise<void>;
  onDiaperIntervalChange: (minutes: number) => void;
  onExport: () => void;
  onShare: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onOpenProfile: () => void;
  onEraseAll: () => void;
  familySync: FamilySync;
  /** Live entries on this phone, quoted by the cloud-safety line. */
  entryCount: number;
  incomingJoinCode?: string | null;
  onIncomingCodeUsed?: () => void;
};

export default function SettingsScreen({
  profile,
  nightMode,
  reminders,
  notificationPermission,
  feedReminderTargetAt,
  diaperReminderTargetAt,
  minuteClock,
  onNightModeChange,
  onFeedRemindersChange,
  onFeedIntervalChange,
  onDiaperRemindersChange,
  onDiaperIntervalChange,
  onExport,
  onShare,
  onImport,
  onOpenProfile,
  onEraseAll,
  familySync,
  entryCount,
  incomingJoinCode,
  onIncomingCodeUsed,
}: SettingsScreenProps) {
  const importRef = useRef<HTMLInputElement>(null);
  const units = useUnits();
  const [handoffFrom] = useState(() => handoffPeers(window.location.origin)[0] ?? null);
  const [consent, setConsent] = useState<ConsentChoice | null>(readConsent);
  const feedingModeLabel = {
    breast: "Breastfeeding",
    bottle: "Bottle feeding",
    mixed: "Mixed feeding",
  }[profile.feedingMode];

  return (
    <section className="screen more-screen" aria-labelledby="more-heading">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Device & data</p>
          <h1 id="more-heading">Settings</h1>
          <p className="page-subtitle">Profile, privacy and backups in one place.</p>
        </div>
      </div>

      <Card className="settings-group appearance-settings">
        <CardHeader>
          <CardTitle asChild><h2>Appearance</h2></CardTitle>
          <CardDescription>Choose the theme that is easiest on your eyes.</CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleGroup
            type="single"
            value={nightMode ? "dark" : "light"}
            className="appearance-options"
            aria-label="Application appearance"
            onValueChange={(value) => { if (!value) return; track("theme_changed", { theme: value }); onNightModeChange(value === "dark"); }}
          >
            <ToggleGroupItem value="light"><Sun /><span><strong>Light</strong><small>Bright and clear</small></span></ToggleGroupItem>
            <ToggleGroupItem value="dark"><Moon /><span><strong>Night</strong><small>Warm and dim for 3am</small></span></ToggleGroupItem>
          </ToggleGroup>
          {/* Per-device on purpose: one parent thinking in ounces must not
              flip the other parent's phone. Storage stays metric either way,
              so switching back and forth costs nothing. */}
          <ToggleGroup
            type="single"
            value={units}
            className="appearance-options units-options"
            aria-label="Measurement units"
            onValueChange={(value) => { if (!value) return; track("units_changed", { units: value }); setUnits(value as UnitSystem); }}
          >
            <ToggleGroupItem value="metric"><Ruler /><span><strong>Metric</strong><small>ml · kg · cm</small></span></ToggleGroupItem>
            <ToggleGroupItem value="us"><Ruler /><span><strong>US</strong><small>oz · lb · in</small></span></ToggleGroupItem>
          </ToggleGroup>
        </CardContent>
      </Card>

      <Card className="settings-group">
        <CardHeader>
          <CardTitle asChild><h2>Baby profile</h2></CardTitle>
          <CardDescription>The details used to personalise your tracker.</CardDescription>
        </CardHeader>
        <CardContent>
          <ItemGroup className="settings-action-list" role="group" aria-label="Baby profile settings">
            <SettingsAction title={profile.name} description={feedingModeLabel} icon={<Baby />} onClick={() => { track("profile_opened"); onOpenProfile(); }} />
          </ItemGroup>
        </CardContent>
      </Card>

      {/* Rendered only while NOT installed — the component hides itself in
          standalone mode. First thing after the profile because "is this an
          app?" was the most-asked question where these families come from. */}
      <InstallGuide />

      <Card className="settings-group reminder-settings">
        <CardHeader>
          <CardTitle asChild><h2>Care reminders</h2></CardTitle>
          <CardDescription>Reminders only work while Numalog is open on this device. Don’t rely on them as an alarm.</CardDescription>
        </CardHeader>
        <CardContent>
          <ItemGroup role="group" aria-label="Care reminder settings">
            <Item size="sm" className="reminder-row">
              <ItemMedia variant="icon" className="glyph-bottle"><Bell /></ItemMedia>
              <ItemContent>
                <ItemTitle>Feed reminder</ItemTitle>
                <ItemDescription id="feed-reminder-status">
                  {notificationPermission === "unsupported"
                    ? "This browser can’t show notifications"
                    : notificationPermission === "denied"
                      ? "Blocked in browser settings"
                      : reminders.feedEnabled && feedReminderTargetAt && feedReminderTargetAt > minuteClock
                        ? `Around ${formatTime(new Date(feedReminderTargetAt).toISOString())}, if this app is still open`
                        : "Prompt after the next feed you log"}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Switch
                  checked={reminders.feedEnabled}
                  disabled={notificationPermission === "unsupported" || notificationPermission === "denied"}
                  onCheckedChange={(checked) => { track("feed_reminders_toggled", { enabled: checked }); void onFeedRemindersChange(checked); }}
                  aria-label="Use feed reminders"
                  aria-describedby="feed-reminder-status"
                />
              </ItemActions>
            </Item>
            {reminders.feedEnabled && (
              <>
                <ItemSeparator />
                <div className="reminder-options">
                  <span className="field-label">Remind after</span>
                  <ToggleGroup
                    type="single"
                    value={String(reminders.feedIntervalMinutes)}
                    className="segmented three-way"
                    aria-label="Feed reminder interval"
                    onValueChange={(value) => value && onFeedIntervalChange(Number(value))}
                  >
                    <ToggleGroupItem value="120">2 hours</ToggleGroupItem>
                    <ToggleGroupItem value="180">3 hours</ToggleGroupItem>
                    <ToggleGroupItem value="240">4 hours</ToggleGroupItem>
                  </ToggleGroup>
                  <p>Follow your baby’s cues and clinician’s care plan.</p>
                </div>
              </>
            )}

            <ItemSeparator />
            {/* Asked for by a user: "put a reminder to change diaper". Counts
                from the last change, not from a feed. */}
            <Item>
              <ItemContent>
                <ItemTitle>Diaper reminder</ItemTitle>
                <ItemDescription id="diaper-reminder-status">
                  {notificationPermission === "unsupported"
                    ? "Not supported in this browser"
                    : notificationPermission === "denied"
                      ? "Blocked in browser settings"
                      : reminders.diaperEnabled && diaperReminderTargetAt && diaperReminderTargetAt > minuteClock
                        ? `Around ${formatTime(new Date(diaperReminderTargetAt).toISOString())}, if this app is still open`
                        : "Prompt after the next change you log"}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Switch
                  checked={Boolean(reminders.diaperEnabled)}
                  disabled={notificationPermission === "unsupported" || notificationPermission === "denied"}
                  onCheckedChange={(checked) => { track("diaper_reminders_toggled", { enabled: checked }); void onDiaperRemindersChange(checked); }}
                  aria-label="Use diaper reminders"
                  aria-describedby="diaper-reminder-status"
                />
              </ItemActions>
            </Item>
            {reminders.diaperEnabled && (
              <>
                <ItemSeparator />
                <div className="reminder-options">
                  <span className="field-label">Remind after</span>
                  <ToggleGroup
                    type="single"
                    value={String(reminders.diaperIntervalMinutes ?? 120)}
                    className="segmented three-way"
                    aria-label="Diaper reminder interval"
                    onValueChange={(value) => value && onDiaperIntervalChange(Number(value))}
                  >
                    <ToggleGroupItem value="90">90 min</ToggleGroupItem>
                    <ToggleGroupItem value="120">2 hours</ToggleGroupItem>
                    <ToggleGroupItem value="180">3 hours</ToggleGroupItem>
                  </ToggleGroup>
                  <p>A nudge, not a schedule — check whenever your baby seems uncomfortable.</p>
                </div>
              </>
            )}
          </ItemGroup>
        </CardContent>
      </Card>

      <FamilySyncCard
        familySync={familySync}
        entryCount={entryCount}
        profile={profile}
        incomingCode={incomingJoinCode}
        onIncomingCodeUsed={onIncomingCodeUsed}
      />

      <Card className="settings-group">
        <CardHeader>
          <CardTitle asChild><h2>Your data</h2></CardTitle>
          <CardDescription>Portable backups you own and control.</CardDescription>
        </CardHeader>
        <CardContent>
          <ItemGroup className="settings-action-list" role="group" aria-label="Backup actions">
            <AppNews />
            <ItemSeparator />
            <SettingsAction title="Share with partner" description="Send today's log — their app merges it, nothing gets replaced" icon={<Share2 />} onClick={() => { track("data_shared"); onShare(); }} />
            <ItemSeparator />
            <SettingsAction title="Download backup" description="Saves a file with all your entries — keep it in a synced folder to be safe" icon={<Download />} onClick={() => { track("backup_downloaded"); onExport(); }} />
            <ItemSeparator />
            <SettingsAction title="Restore a backup" description="Merges a backup file from any device" icon={<Upload />} onClick={() => { track("backup_restore_opened"); importRef.current?.click(); }} />
            {/* Storage belongs to a web address. A log kept at the app's other
                address is invisible here until someone walks it across. */}
            {handoffFrom && (
              <>
                <ItemSeparator />
                <SettingsAction
                  title={`Bring a log from ${originLabel(handoffFrom)}`}
                  description="Copies your entries across from the app's other web address — nothing is uploaded"
                  icon={<ArrowLeftRight />}
                  onClick={() => {
                    track("handoff_started");
                    window.location.href = handoffSendUrl(handoffFrom, window.location.origin);
                  }}
                />
              </>
            )}
            <ItemSeparator />
            <SettingsAction
              className="settings-action-danger"
              title="Erase everything and start over"
              description="Deletes every entry on this device — download a backup first"
              icon={<Trash2 />}
              onClick={() => { track("erase_all_opened"); onEraseAll(); }}
            />
          </ItemGroup>
        </CardContent>
        <Input ref={importRef} className="hidden-input" type="file" accept="application/json" onChange={onImport} />
      </Card>

      <Card className="settings-group">
        <CardHeader>
          <CardTitle asChild><h2>Usage statistics</h2></CardTitle>
          <CardDescription>
            Anonymous page counts, so I can see which parts of the app get used. Never your
            baby’s entries. You can change this whenever you like.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ToggleGroup
            type="single"
            value={consent ?? "denied"}
            className="filter-row"
            aria-label="Usage statistics"
            onValueChange={(value) => {
              if (!value) return;
              saveConsent(value as ConsentChoice);
              setConsent(value as ConsentChoice);
              track("consent_changed", { choice: value });
            }}
          >
            <ToggleGroupItem value="granted">Allowed</ToggleGroupItem>
            <ToggleGroupItem value="denied">Off</ToggleGroupItem>
          </ToggleGroup>
        </CardContent>
      </Card>

      <FeedbackCard />

      <Card className="privacy-card">
        <span><ShieldCheck size={18} /></span>
        {familySync.pairing ? (
          <div><strong>Shared with your family</strong><p>Entries are stored in your family’s space in the cloud so both phones stay in step. Anonymous usage statistics help improve the app.</p></div>
        ) : (
          <div><strong>On this device</strong><p>Your baby’s entries stay in this browser until you turn on Family Sync. Anonymous usage statistics help improve the app.</p></div>
        )}
      </Card>

      <p className="version-note">Numalog · build {__APP_VERSION__}</p>
    </section>
  );
}
