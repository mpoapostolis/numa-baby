import {
  ArrowLeftRight,
  Check,
  ChevronRight,
  Clock,
  Download,
  Milk,
  Moon,
  ShieldCheck,
  Sun,
  Upload,
} from "lucide-react";
import { ChangeEvent, useId, useRef, useState } from "react";
import { BabyFace, NurseryScene, TinyStars } from "../components/illustrations";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "../components/ui/field";
import { Input } from "../components/ui/input";
import { InputGroup, InputGroupInput } from "../components/ui/input-group";
import { Toaster } from "../components/ui/sonner";
import { Switch } from "../components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group";
import { localDateInput } from "../domain/time";
import { handoffPeers, handoffSendUrl, originLabel } from "../domain/handoff";
import { FeedingMode, Profile } from "../domain/types";

export default function OnboardingScreen({
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
  const nightModeId = useId();
  const sexLabelId = useId();
  const feedingLabelId = useId();
  const restoreRef = useRef<HTMLInputElement>(null);
  // The app's other web address, if it has one. Storage belongs to an origin,
  // so a log kept at the old address is invisible to this page until someone
  // walks it across.
  const [handoffFrom] = useState(() => handoffPeers(window.location.origin)[0] ?? null);

  return (
    <main className="onboarding-shell">
      <header className="onboarding-header">
        <div className="onboarding-brand">
          <span className="wordmark-mark"><BabyFace /></span>
          <span><strong>Baby Tracker</strong><small>Private family log</small></span>
        </div>
        <label className="onboarding-theme" htmlFor={nightModeId}>
          {nightMode ? <Moon size={17} /> : <Sun size={17} />}
          <span>Night mode</span>
          <Switch id={nightModeId} checked={nightMode} onCheckedChange={onNightModeChange} aria-label="Use night mode" />
        </label>
      </header>

      {mode === "recovery" ? (
        <div className="recovery-region">
          <Card className="recovery-card">
            <CardHeader>
              <span className="onboarding-card-icon"><ShieldCheck /></span>
              <CardTitle asChild><h1>Your local log needs attention</h1></CardTitle>
              <CardDescription>
                The saved copy could not be read, so Baby Tracker left it untouched. Download it before starting over, or restore a valid backup.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {storageWarning && <div className="onboarding-alert" role="alert">{storageWarning}</div>}
              <div className="recovery-actions">
                <Button onClick={onDownloadRecovery}><Download /> Download the saved copy</Button>
                <Button variant="outline" onClick={() => restoreRef.current?.click()}><Upload /> Restore a backup</Button>
                <Button variant="ghost" onClick={onResetRecovery}>Reset and start clean</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="onboarding-layout">
          <section className="onboarding-intro" aria-labelledby="onboarding-title">
            <NurseryScene className="onboarding-scene" />
            <p className="eyebrow">Private by default</p>
            <h1 id="onboarding-title">The whole day,<br />without the mental load.</h1>
            <p>Log feeds, diapers, burping and growth in seconds. No account needed — your entries stay on this device until you choose to share them.</p>
            <div className="onboarding-points">
              <div><span className="glyph-bottle"><Milk /></span><p><strong>One-tap logging</strong><small>Details only when you need them.</small></p></div>
              <div><span className="glyph-burp"><Clock /></span><p><strong>Live timers and patterns</strong><small>See what happened and what may be next.</small></p></div>
              <div><span className="onboarding-private-icon"><ShieldCheck /></span><p><strong>Yours by default</strong><small>Entries stay on this device. Family Sync is opt-in.</small></p></div>
            </div>
          </section>

          <Card className="onboarding-card">
            <CardHeader>
              <span className="onboarding-card-icon onboarding-baby-icon"><BabyFace /><TinyStars /></span>
              <CardTitle asChild><h2>Set up your baby</h2></CardTitle>
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
                        max={localDateInput(new Date()).slice(0, 10)}
                        onChange={(event) => setDraft({ ...draft, birthDate: event.target.value })}
                      />
                    </InputGroup>
                  </Field>
                  <Field>
                    <FieldLabel asChild><span id={sexLabelId}>Girl or boy <span className="optional-label">Optional</span></span></FieldLabel>
                    <ToggleGroup
                      type="single"
                      value={draft.sex ?? "skip"}
                      className="segmented three-way"
                      aria-labelledby={sexLabelId}
                      onValueChange={(value) => value && setDraft({ ...draft, sex: value === "girl" || value === "boy" ? value : undefined })}
                    >
                      <ToggleGroupItem value="girl">Girl<Check className="choice-check" /></ToggleGroupItem>
                      <ToggleGroupItem value="boy">Boy<Check className="choice-check" /></ToggleGroupItem>
                      <ToggleGroupItem value="skip">Skip<Check className="choice-check" /></ToggleGroupItem>
                    </ToggleGroup>
                    <FieldDescription>Used only for the growth guide’s reference ranges.</FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel asChild><span id={feedingLabelId}>Feeding</span></FieldLabel>
                    <ToggleGroup
                      type="single"
                      value={draft.feedingMode}
                      className="segmented three-way"
                      aria-labelledby={feedingLabelId}
                      onValueChange={(value) => value && setDraft({ ...draft, feedingMode: value as FeedingMode })}
                    >
                      {(["breast", "bottle", "mixed"] as FeedingMode[]).map((feedingMode) => (
                        <ToggleGroupItem key={feedingMode} value={feedingMode}>
                          {feedingMode[0].toUpperCase() + feedingMode.slice(1)}
                          <Check className="choice-check" />
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    <FieldDescription>This only changes the quick actions you see.</FieldDescription>
                  </Field>
                </FieldGroup>

                {storageWarning && <div className="onboarding-alert" role="alert">{storageWarning}</div>}
                <Button type="submit" size="lg" className="onboarding-primary">Start tracking <ChevronRight /></Button>
                <Button type="button" variant="ghost" onClick={() => restoreRef.current?.click()}><Upload /> Restore a backup</Button>
                {/* Whoever arrives here from the app's older web address has a
                    full log sitting in a browser store this page cannot see —
                    different origin, different storage. Asking them to invent
                    a baby that already exists is the wrong first screen. */}
                {handoffFrom && (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => { window.location.href = handoffSendUrl(handoffFrom, window.location.origin); }}
                  >
                    <ArrowLeftRight /> Bring my log from {originLabel(handoffFrom)}
                  </Button>
                )}
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
