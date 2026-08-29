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
import { ChangeEvent, Suspense, lazy, useId, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { InputGroup, InputGroupInput } from "../components/ui/input-group";
import { Toaster } from "../components/ui/sonner";
import { Switch } from "../components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "../components/ui/toggle-group";
import { localDateInput } from "../domain/time";
import { handoffPeers, handoffSendUrl, moveTarget, originLabel } from "../domain/handoff";
import { inAppBrowser } from "../domain/install";
import { FeedingMode, Profile } from "../domain/types";
import { FamilySync } from "../hooks/useFamilySync";

const RestoreWithGoogle = lazy(() =>
  import("../components/GoogleRecovery").then((m) => ({ default: m.RestoreWithGoogle })),
);

const HANDOFF_OFFER_SEEN = "numalog-handoff-offer-v1";

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
  const [handoffOffer, setHandoffOffer] = useState(() => {
    if (!handoffPeers(window.location.origin).length) return false;
    // Only at the app's home address: on the OLD origin the same dialog read
    // backwards — "already using numalog.app?" — and offered to pull a log in
    // the wrong direction. And never inside a social-app webview: the escape
    // notice owns that moment, and a handoff steered INTO the webview would
    // land the entries in its walled-off storage.
    if (moveTarget(window.location.origin) !== null || inAppBrowser()) return false;
    try {
      return window.localStorage.getItem(HANDOFF_OFFER_SEEN) === null;
    } catch {
      return true;
    }
  });
  function declineHandoffOffer() {
    setHandoffOffer(false);
    try {
      window.localStorage.setItem(HANDOFF_OFFER_SEEN, "1");
    } catch {
      // Remembering is a courtesy; the session state above still closes it.
    }
  }

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
                  {/* First, and not labelled "optional" — not because it is
                      required (nothing here is) but because it is the one
                      answer that changes what the app can do. Without a birth
                      date there is no age, so the day count, the age-matched
                      stage list and every sourced fact simply do not render:
                      the app looks emptier than it is, for want of one tap. */}
                  <Field>
                    <FieldLabel htmlFor={birthDateId}>Date of birth</FieldLabel>
                    <InputGroup>
                      <InputGroupInput
                        id={birthDateId}
                        type="date"
                        value={draft.birthDate}
                        max={localDateInput(new Date()).slice(0, 10)}
                        onChange={(event) => setDraft({ ...draft, birthDate: event.target.value })}
                      />
                    </InputGroup>
                    <FieldDescription>
                      Does the day count, and matches the guidance to this exact week. You can skip it.
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
                <Button type="button" variant="ghost" onClick={() => restoreRef.current?.click()}><Upload /> Restore a backup</Button>
                {/* The disaster door: a verified Google sign-in re-joins the
                    family whose guard it is, and everything comes back over
                    the sync. Lazy — Google's script loads only on the tap. */}
                <Suspense fallback={null}>
                  <RestoreWithGoogle familySync={familySync} onRestored={onGoogleRestored} />
                </Suspense>
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

      {mode === "onboarding" && handoffFrom && (
        <Dialog open={handoffOffer} onOpenChange={(open) => { if (!open) declineHandoffOffer(); }}>
          <DialogContent className="handoff-offer">
            <DialogTitle>Already using {originLabel(handoffFrom)}?</DialogTitle>
            <DialogDescription>
              Numalog moved here. Your entries are still safe at the old address — one tap
              brings your whole log over, and nothing is deleted from the old one. If you
              used the installed app from your home screen, move with a backup file
              instead: its entries can’t travel by link. Either way, keep the old app or
              icon until you can SEE your entries here — an installed app’s storage is
              deleted with it.
            </DialogDescription>
            <DialogFooter>
              <Button
                size="lg"
                onClick={() => { window.location.href = handoffSendUrl(handoffFrom, window.location.origin); }}
              >
                <ArrowLeftRight /> Bring my log over
              </Button>
              <Button variant="ghost" onClick={declineHandoffOffer}>
                I’m new here — start fresh
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <Input ref={restoreRef} className="hidden-input" type="file" accept="application/json" onChange={onRestore} />
      <Toaster theme={nightMode ? "dark" : "light"} position="bottom-center" closeButton />
    </main>
  );
}
