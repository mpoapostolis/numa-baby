// Ships with this lazy chunk, not the app shell — the budget rule.
import "../styles/screens/onboarding.css";
import {
  ArrowLeftRight,
  CalendarDays,
  Check,
  ChevronRight,
  Clock,
  Download,
  Gift,
  Milk,
  Moon,
  ShieldCheck,
  Sun,
  Upload,
} from "lucide-react";
import { track } from "../domain/analytics";

// Loads only on browsers without a native share sheet.
const ShareNumalogDialog = lazy(() => import("../components/ShareNumalog"));
import { ChangeEvent, Suspense, lazy, useId, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "../components/ui/dialog";
import { BabyFace, NurseryScene, TinyStars } from "../components/illustrations";
import { InAppEscape } from "../components/InAppEscape";
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
import { InputGroup, InputGroupAddon, InputGroupInput } from "../components/ui/input-group";
import { Toaster } from "../components/ui/sonner";
import { Switch } from "../components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group";
import { localDateInput } from "../domain/time";
import { loadAuthHint } from "../domain/authHint";
import { handoffPeers, handoffSendUrl, moveTarget, originLabel } from "../domain/handoff";
import { inAppBrowser } from "../domain/install";
import { FeedingMode, Profile } from "../domain/types";
import { FamilySync } from "../hooks/useFamilySync";

const RestoreWithGoogle = lazy(() =>
  import("../components/GoogleRecovery").then((m) => ({ default: m.RestoreWithGoogle })),
);

export default function OnboardingScreen({
  mode,
  profile,
  nightMode,
  storageWarning,
  familySync,
  onGoogleRestored,
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
  familySync: FamilySync;
  onGoogleRestored: () => void;
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
  // The offer opens itself once. Anyone arriving at the new address from the
  // old one has months of entries a scroll away and no reason to know that
  // web storage is chained to the address it was written under — a quiet
  // button at the bottom of a form is not enough warning that "start
  // tracking" here means starting from zero. Declining is remembered, so it
  // never nags someone who really is new.
  // One dialog holds every way back: whoever has data will open it, whoever
  // is genuinely new is never interrupted. (This replaced an auto-opening
  // "already using the old address?" popup that greeted every stranger from
  // the Facebook post with a question about an address they had never seen.)
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  // A device that has signed in before does NOT get greeted like a
  // stranger: the way back comes first, the blank form second.
  const [returningHint] = useState(loadAuthHint);
  const [freshSetup, setFreshSetup] = useState(false);
  const welcomeBack = mode === "onboarding" && returningHint !== null && !freshSetup;
  const showHandoffDoor =
    handoffFrom !== null && moveTarget(window.location.origin) === null && !inAppBrowser();

  return (
    <main className="onboarding-shell">
      <header className="onboarding-header">
        <div className="onboarding-brand">
          <span className="wordmark-mark"><BabyFace /></span>
          <span><strong>Numalog</strong><small>Private family log</small></span>
        </div>
        <label className="onboarding-theme" htmlFor={nightModeId}>
          {nightMode ? <Moon size={17} /> : <Sun size={17} />}
          <span>Night mode</span>
          <Switch id={nightModeId} checked={nightMode} onCheckedChange={onNightModeChange} aria-label="Use night mode" />
        </label>
      </header>

      <InAppEscape />

      {mode === "recovery" ? (
        <div className="recovery-region">
          <Card className="recovery-card">
            <CardHeader>
              <span className="onboarding-card-icon"><ShieldCheck /></span>
              <CardTitle asChild><h1>Your local log needs attention</h1></CardTitle>
              <CardDescription>
                The saved copy could not be read, so Numalog left it untouched. Download it before starting over, or restore a valid backup.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {storageWarning && <div className="onboarding-alert" role="alert">{storageWarning}</div>}
              <div className="recovery-actions">
                <Button onClick={onDownloadRecovery}><Download /> Download the saved copy</Button>
                <Button variant="outline" onClick={() => restoreRef.current?.click()}><Upload /> Restore a backup</Button>
                <Button variant="ghost" onClick={onResetRecovery}>Reset and start clean</Button>
              </div>
              {/* The cloud way home — for the family whose only good copy
                  lives behind their guard. Below the download on purpose:
                  restoring overwrites the unreadable local copy, so saving
                  it first stays the headline advice. */}
              <p className="t-meta">
                Protected your log with Google or email? After downloading the
                saved copy, you can bring everything back from the cloud:
              </p>
              <Suspense fallback={null}>
                <RestoreWithGoogle familySync={familySync} onRestored={onGoogleRestored} />
              </Suspense>
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
          </section>

          {welcomeBack ? (
            <Card className="onboarding-card">
              <CardHeader>
                <span className="onboarding-card-icon onboarding-baby-icon"><BabyFace /><TinyStars /></span>
                <CardTitle asChild><h2>Welcome back</h2></CardTitle>
                <CardDescription>
                  This device has used Numalog before — continue, and your log
                  comes straight down from the cloud.
                </CardDescription>
              </CardHeader>
              <CardContent className="welcome-back-body">
                <Suspense fallback={null}>
                  <RestoreWithGoogle familySync={familySync} onRestored={onGoogleRestored} />
                </Suspense>
                <Button type="button" variant="ghost" onClick={() => setFreshSetup(true)}>
                  Set up a new baby instead
                </Button>
              </CardContent>
            </Card>
          ) : (
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
                  {/* First, and not labelled "optional" — not because it is
                      required (nothing here is) but because it is the one
                      answer that changes what the app can do. Without a birth
                      date there is no age, so the day count, the age-matched
                      stage list and every sourced fact simply do not render:
                      the app looks emptier than it is, for want of one tap. */}
                  <Field>
                    <FieldLabel htmlFor={birthDateId}>Date of birth</FieldLabel>
                    {/* An empty date input draws nothing at all on iOS — a
                        blank rounded box under a label, with no hint that it
                        opens anything. The calendar mark says what it is, and
                        tapping it opens the picker instead of only focusing. */}
                    <InputGroup>
                      <InputGroupAddon
                        onClick={(event) => {
                          const input = event.currentTarget.parentElement?.querySelector("input");
                          try {
                            input?.showPicker?.();
                          } catch {
                            // No user activation, or a browser without it.
                          }
                          input?.focus();
                        }}
                      >
                        <CalendarDays aria-hidden="true" />
                      </InputGroupAddon>
                      <InputGroupInput
                        id={birthDateId}
                        type="date"
                        value={draft.birthDate}
                        max={localDateInput(new Date()).slice(0, 10)}
                        onChange={(event) => setDraft({ ...draft, birthDate: event.target.value })}
                      />
                    </InputGroup>
                    <FieldDescription>
                      Powers the day counter and matches the guidance to this exact week. You can skip it.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={nameId}>Name <span className="optional-label">Optional</span></FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id={nameId}
                        // No autoFocus. Focusing a field scrolls the page to it,
                        // and this page is a landing page: the drawing, the
                        // eyebrow, the headline and the paragraph saying what
                        // the app IS all sat above the viewport before anyone
                        // saw them — measured at scrollY 442 on a phone, with a
                        // keyboard over what was left. Saving one tap is not
                        // worth throwing away the only ten seconds this app gets
                        // with someone who has never heard of it.
                        maxLength={80}
                        value={draft.name}
                        placeholder="Baby’s name"
                        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
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
                <Button type="button" variant="ghost" onClick={() => setRestoreOpen(true)}>
                  <Upload /> I already have data — bring it back
                </Button>
                {/* Whoever arrives here from the app's older web address has a
                    full log sitting in a browser store this page cannot see —
                    different origin, different storage. Asking them to invent
                    a baby that already exists is the wrong first screen. */}
                
              </form>
            </CardContent>
          </Card>
          )}

          {/* Who builds this, and the offer to pass it on. Below the form in
              DOM order, because on a phone the column stacks: a parent who
              opened the link at 3am must reach "Start tracking" without
              scrolling past a founders' note and a request to share an app
              they have not used yet. */}
          <aside className="onboarding-aside">
            <div className="onboarding-points">
              <div><span className="glyph-bottle"><Milk /></span><p><strong>One-tap logging</strong><small>Details only when you need them.</small></p></div>
              <div><span className="glyph-burp"><Clock /></span><p><strong>Live timers and patterns</strong><small>See what happened and what may be next.</small></p></div>
              <div><span className="onboarding-private-icon"><ShieldCheck /></span><p><strong>Yours by default</strong><small>Entries stay on this device. Family Sync is opt-in.</small></p></div>
            </div>
            {/* The human line, quietly, where a stranger decides whether to
              trust this thing with their baby's nights: who builds it,
              why, and that feedback is how it grows. A note, never a
              popup — the first open stays sacred. */}
          <p className="onboarding-note">
            Built by two parents, for our own daughter — we use it every
            day ourselves. It grows from what parents ask for: if anything
            is broken, missing or annoying, tap the message bubble inside
            and tell us. We read everything. And one rule above all: an app
            can help, but your paediatrician always comes first.
          </p>
          {/* The person most likely to pass it on is the one who just
              arrived from a friend's link — meet them where they are. */}
          <Button
            type="button"
            variant="ghost"
            className="onboarding-share"
            onClick={() => {
              track("app_share_opened", { from: "onboarding" });
              setShareOpen(true);
            }}
          >
            <Gift size={16} aria-hidden="true" /> Know another tired parent? Share Numalog
          </Button>
          </aside>
        </div>
      )}

      {mode === "onboarding" && (
        <Dialog open={restoreOpen} onOpenChange={setRestoreOpen}>
          <DialogContent className="restore-doors">
            <DialogTitle>Bring your log back</DialogTitle>
            <DialogDescription>
              However you kept it, there is a way home. Nothing here deletes
              anything, anywhere.
            </DialogDescription>
            {/* Door one, emphasized: the cloud — everything downloads and
                stays synced from then on. */}
            <Suspense fallback={null}>
              <RestoreWithGoogle familySync={familySync} onRestored={onGoogleRestored} />
            </Suspense>

            <div className="door-divider" aria-hidden="true"><span>or from this phone</span></div>

            <div className="door-rows">
              <Button type="button" variant="ghost" className="door-row" onClick={() => { setRestoreOpen(false); restoreRef.current?.click(); }}>
                <Upload /> Restore a backup file
              </Button>
              {showHandoffDoor && handoffFrom && (
                <Button
                  type="button"
                  variant="ghost"
                  className="door-row"
                  onClick={() => { window.location.href = handoffSendUrl(handoffFrom, window.location.origin); }}
                >
                  <ArrowLeftRight /> Bring my log from {originLabel(handoffFrom)}
                </Button>
              )}
            </div>

            <p className="door-note">
              Entries inside an installed home-screen app can’t travel by
              link — for those, use a backup file or the cloud restore.
            </p>
          </DialogContent>
        </Dialog>
      )}

      <Input ref={restoreRef} className="hidden-input" type="file" accept="application/json" onChange={onRestore} />
      {shareOpen && (
        <Suspense fallback={null}>
          <ShareNumalogDialog open={shareOpen} onOpenChange={setShareOpen} />
        </Suspense>
      )}
      <Toaster theme={nightMode ? "dark" : "light"} position="bottom-center" closeButton />
    </main>
  );
}
