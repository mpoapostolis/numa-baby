import { useEffect, useState } from "react";
import { Copy, Users } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { InputGroup, InputGroupInput } from "./ui/input-group";
import { QrCode } from "./QrCode";
import { FamilySync } from "../hooks/useFamilySync";
import { ProtectWithGoogle } from "./GoogleRecovery";
import { track } from "../domain/analytics";
import { inviteLink } from "../domain/familyPairing";
import { FamilyDevice, InviteResult } from "../domain/syncTransport";
import { formatTime } from "../domain/time";
import { Profile } from "../domain/types";

// The Family Sync card: one phone creates the family and reads a six-digit
// code to the other; the other joins with it. Paired state shows sync health
// and the escape hatches. All copy stays calm — sync is a comfort, never a
// chore.

type FamilySyncCardProps = {
  familySync: FamilySync;
  profile: Profile;
  /** A code carried in from a scanned invite link, if any. */
  incomingCode?: string | null;
  onIncomingCodeUsed?: () => void;
  /** Live entries on this phone — the number the safety line quotes. */
  entryCount: number;
};


type View = "closed" | "code" | "join";

const deviceDayFormat = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });

/** The worker clips ISO stamps to "2026-08-30T11:42" (UTC) for last-seen and
    a bare date for joined. Re-inflate them and speak LOCAL time — a raw UTC
    string with a literal T is machine text, not a sentence. Unparseable
    values fall back to the raw string. */
function humanStamp(raw: string): string {
  const iso = raw.length === 16 ? `${raw}:00Z` : raw.length === 10 ? `${raw}T12:00:00Z` : raw;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return raw;
  const day = deviceDayFormat.format(new Date(ms));
  return raw.length === 10 ? day : `${day}, ${formatTime(new Date(ms).toISOString())}`;
}

function statusLine(phase: string, lastSyncAt: string | null, entryCount: number): string {
  if (phase === "syncing") return "Syncing…";
  if (phase === "offline") return "Offline — will catch up on its own when you're back";
  if (phase === "revoked") return "Reconnect needed — ask the other phone for a fresh code";
  // The sentence a parent actually needs. Not sync jargon — the promise,
  // with the number that makes it concrete. "Backing up" rather than "all
  // safe": the count is this phone's, and its newest minutes may still be
  // riding the next push — a promise the next sync makes true is honest,
  // a completed one it hasn't made yet is not.
  if (lastSyncAt) {
    return `Backing up ${entryCount} ${entryCount === 1 ? "entry" : "entries"} to the cloud · synced ${formatTime(lastSyncAt)}`;
  }
  return "Waiting for the first sync";
}

export function FamilySyncCard({
  familySync,
  profile,
  entryCount,
  incomingCode = null,
  onIncomingCodeUsed,
}: FamilySyncCardProps) {
  const { pairing, status, createFamily, createInvite, joinFamily, leaveFamily, listDevices, revokeDevice } = familySync;
  const [devices, setDevices] = useState<FamilyDevice[] | null>(null);
  // A scanned link lands straight on the join step with the code already in
  // the box: the partner's whole job becomes one tap on Join.
  const [view, setView] = useState<View>(incomingCode ? "join" : "closed");
  const [invite, setInvite] = useState<InviteResult | null>(null);
  const [joinValue, setJoinValue] = useState(incomingCode ?? "");
  const [busy, setBusy] = useState(false);

  const deviceLabel = profile.name.trim() ? `${profile.name.trim()}’s tracker` : "This phone";

  // Fetched once the card is paired, and refreshed after a revocation so the
  // list never shows a phone that no longer holds a key. The unpaired case
  // needs no reset — `paired` already gates the whole block from rendering.
  useEffect(() => {
    if (!pairing) return;
    let cancelled = false;
    void listDevices().then((found) => {
      if (!cancelled) setDevices(found);
    });
    return () => { cancelled = true; };
  }, [pairing, listDevices]);

  async function removeDevice(target: { deviceId: string } | { all: true }) {
    const confirmed = "all" in target
      ? window.confirm("Sign out every other phone? They will each need a fresh invite code to come back.")
      : window.confirm("Remove this phone from the family? It keeps its own data but stops syncing.");
    if (!confirmed) return;
    track("device_revoked", { scope: "all" in target ? "all_others" : "one" });
    if (await revokeDevice(target)) setDevices(await listDevices());
  }
  const paired = Boolean(pairing);
  const partnerJoined = (status.deviceCount ?? 0) >= 2;

  async function handleCreate() {
    setBusy(true);
    const created = await createFamily(deviceLabel);
    track("family_create_attempted", { ok: created });
    if (created) {
      const code = await createInvite();
      if (code) {
        setInvite(code);
        setView("code");
      }
    }
    setBusy(false);
  }

  async function handleNewCode() {
    track("invite_code_requested");
    setBusy(true);
    const code = await createInvite();
    if (code) {
      setInvite(code);
      setView("code");
    }
    setBusy(false);
  }

  async function handleJoin() {
    if (!/^\d{6}$/.test(joinValue)) return;
    setBusy(true);
    const joined = await joinFamily(joinValue, deviceLabel);
    track("family_join_attempted", { ok: joined, source: "typed_code" });
    if (joined) {
      setView("closed");
      setJoinValue("");
      onIncomingCodeUsed?.();
    }
    setBusy(false);
  }

  function handleLeave() {
    if (!window.confirm("Leave Family Sync? This phone keeps its data but stops syncing.")) return;
    track("family_left");
    setView("closed");
    setInvite(null);
    leaveFamily();
  }

  return (
    <Card className="settings-group family-card">
      <CardHeader>
        <CardTitle asChild><h2>Family Sync</h2></CardTitle>
        <CardDescription>
          {paired
            ? "Both phones see the same log, automatically."
            : "Right now your log lives on this phone only. Sync it to keep it safe in the cloud and share it with a partner."}
        </CardDescription>
      </CardHeader>
      <CardContent className="family-card-content">
        {/* A scanned invite landing on a phone that is already in a family
            used to vanish without a word — the person had just been handed a
            code and the app pretended nothing happened. */}
        {paired && incomingCode && (
          <p className="join-error" role="alert">
            This phone is already in a family, so the scanned code was not
            used. To join the other family instead, leave this one below
            first, then scan the code again.
          </p>
        )}
        {!paired && view !== "join" && (
          <div className="family-actions">
            <Button variant="outline" className="log-quiet" disabled={busy} onClick={() => void handleCreate()}>
              Create family
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => setView("join")}>
              Join with a code
            </Button>
          </div>
        )}

        {!paired && view === "join" && (
          <div className="family-join">
            <label className="t-label" htmlFor="family-join-code">Code from the other phone</label>
            <div className="family-join-row">
              <InputGroup>
                <InputGroupInput
                  id="family-join-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  placeholder="123456"
                  value={joinValue}
                  onChange={(event) => setJoinValue(event.target.value.replace(/\D/g, "").slice(0, 6))}
                />
              </InputGroup>
              <Button
                variant="outline"
                className="log-quiet"
                disabled={busy || joinValue.length !== 6}
                onClick={() => void handleJoin()}
              >
                Join
              </Button>
            </div>
            <Button variant="ghost" className="family-back" onClick={() => setView("closed")}>Back</Button>
          </div>
        )}

        {paired && (view === "code" || !partnerJoined) && invite && (
          <div className="family-code-view" aria-live="polite">
            <p className="t-label">Scan this with the other phone</p>
            <div className="family-qr">
              <QrCode
                value={inviteLink(window.location.origin, invite.code)}
                label={`QR code containing the invite code ${invite.code.split("").join(" ")}`}
              />
            </div>
            <p className="t-meta family-qr-hint">
              Open the camera on the other phone and point it here. No app to install.
            </p>
            <p className="family-code-label t-label">Or type this code</p>
            <p className="family-code figure">{invite.code}</p>
            <p className="t-meta">Valid for 15 minutes · single use</p>
            <p className="t-meta family-waiting">
              {partnerJoined ? "Paired! Both phones are syncing." : "Waiting for the other phone…"}
            </p>
            <div className="family-actions">
              <Button variant="outline" disabled={busy} onClick={() => void handleNewCode()}>
                <Copy size={15} /> New code
              </Button>
              {partnerJoined && (
                <Button variant="ghost" onClick={() => { setView("closed"); setInvite(null); }}>Done</Button>
              )}
            </div>
          </div>
        )}

        {paired && view !== "code" && (partnerJoined || !invite) && (
          <div className="family-status">
            <span className="family-status-icon"><Users size={18} /></span>
            <div className="family-status-copy">
              <strong>
                Family Sync on
                {status.deviceCount
                  ? ` · ${status.deviceCount === 1 ? "just this phone" : `${status.deviceCount} phones`}`
                  : ""}
              </strong>
              <small>{statusLine(status.phase, status.lastSyncAt, entryCount)}</small>
            </div>
            <div className="family-actions">
              <Button variant="outline" disabled={busy} onClick={() => void handleNewCode()}>Show invite code</Button>
              <Button variant="ghost" className="family-leave" onClick={handleLeave}>Leave family</Button>
            </div>
          </div>
        )}

        {/* Phones with a key to this family. Until this list existed, a lost
            phone kept syncing for ever — "Leave family" only ever spoke to
            the phone doing the leaving. */}
        {paired && devices && devices.length > 0 && (
          <div className="family-devices">
            <p className="t-label">Phones in this family</p>
            <ul className="family-device-list">
              {devices.map((device) => (
                <li key={device.id}>
                  <span className="family-device-name">
                    {device.label || "A phone"}
                    {device.isThisDevice && <span className="family-device-you"> · this one</span>}
                  </span>
                  <span className="family-device-meta">
                    {device.last_seen
                      ? `last synced ${humanStamp(device.last_seen)}`
                      : `joined ${humanStamp(device.joined)}`}
                  </span>
                  {!device.isThisDevice && device.revocable > 0 && (
                    <Button
                      variant="ghost"
                      className="family-device-remove"
                      onClick={() => void removeDevice({ deviceId: device.id })}
                    >
                      Remove
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            {devices.length > 1 && (
              <Button
                variant="outline"
                className="family-revoke-all"
                onClick={() => void removeDevice({ all: true })}
              >
                Lost a phone? Sign out all the others
              </Button>
            )}
          </div>
        )}
        {/* The guard rides the same card as the sync it protects. With no
            pairing yet, its one tap creates the family first — cloud copy
            and recovery in a single gesture. */}
        <ProtectWithGoogle familySync={familySync} />
      </CardContent>
    </Card>
  );
}
