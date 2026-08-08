import { Baby, Bell, Download, Moon, ShieldCheck, Sun, Trash2, Upload } from "lucide-react";
import { ChangeEvent, useRef } from "react";
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
import { SettingsAction } from "../components/SettingsAction";
import { formatTime } from "../domain/time";
import { Profile, ReminderSettings } from "../domain/types";

type SettingsScreenProps = {
  profile: Profile;
  nightMode: boolean;
  reminders: ReminderSettings;
  notificationPermission: NotificationPermission | "unsupported";
  feedReminderTargetAt: number | null;
  minuteClock: number;
  onNightModeChange: (enabled: boolean) => void;
  onFeedRemindersChange: (enabled: boolean) => Promise<void>;
  onFeedIntervalChange: (minutes: number) => void;
  onExport: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
  onOpenProfile: () => void;
  onEraseAll: () => void;
};

export default function SettingsScreen({
  profile,
  nightMode,
  reminders,
  notificationPermission,
  feedReminderTargetAt,
  minuteClock,
  onNightModeChange,
  onFeedRemindersChange,
  onFeedIntervalChange,
  onExport,
  onImport,
  onOpenProfile,
  onEraseAll,
}: SettingsScreenProps) {
  const importRef = useRef<HTMLInputElement>(null);
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
            onValueChange={(value) => value && onNightModeChange(value === "dark")}
          >
            <ToggleGroupItem value="light"><Sun /><span><strong>Light</strong><small>Bright and clear</small></span></ToggleGroupItem>
            <ToggleGroupItem value="dark"><Moon /><span><strong>Night</strong><small>Warm and dim for 3am</small></span></ToggleGroupItem>
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
            <SettingsAction title={profile.name} description={feedingModeLabel} icon={<Baby />} onClick={onOpenProfile} />
          </ItemGroup>
        </CardContent>
      </Card>

      <Card className="settings-group reminder-settings">
        <CardHeader>
          <CardTitle asChild><h2>Care reminders</h2></CardTitle>
          <CardDescription>Reminders only work while Baby Tracker is open on this device. Don’t rely on them as an alarm.</CardDescription>
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
                  onCheckedChange={(checked) => void onFeedRemindersChange(checked)}
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
          </ItemGroup>
        </CardContent>
      </Card>

      <Card className="settings-group">
        <CardHeader>
          <CardTitle asChild><h2>Your data</h2></CardTitle>
          <CardDescription>Portable backups you own and control.</CardDescription>
        </CardHeader>
        <CardContent>
          <ItemGroup className="settings-action-list" role="group" aria-label="Backup actions">
            <SettingsAction title="Download backup" description="Saves a file with all your entries — keep it in a synced folder to be safe" icon={<Download />} onClick={onExport} />
            <ItemSeparator />
            <SettingsAction title="Restore a backup" description="Choose a backup file from any device" icon={<Upload />} onClick={() => importRef.current?.click()} />
            <ItemSeparator />
            <SettingsAction
              className="settings-action-danger"
              title="Erase everything and start over"
              description="Deletes every entry on this device — download a backup first"
              icon={<Trash2 />}
              onClick={onEraseAll}
            />
          </ItemGroup>
        </CardContent>
        <Input ref={importRef} className="hidden-input" type="file" accept="application/json" onChange={onImport} />
      </Card>

      <Card className="privacy-card">
        <span><ShieldCheck size={18} /></span>
        <div><strong>Private on this device</strong><p>Your baby’s entries stay in this browser. Export a backup anytime.</p></div>
      </Card>

      <p className="version-note">Baby Tracker · Local-first and private</p>
    </section>
  );
}
