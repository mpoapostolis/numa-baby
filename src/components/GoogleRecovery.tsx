// The two faces of "Continue with Google" — protecting a log, and getting
// one back — plus the any-email door beside each. Lazy on purpose: nobody
// talks to Google until they open one of these, and someone who never
// touches the feature never loads its script.

import "../styles/screens/recovery.css";
import { useEffect, useRef, useState } from "react";
import { Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { InputGroup, InputGroupInput } from "./ui/input-group";
import { loadAuthHint } from "../domain/authHint";
import { emailRecoverRequest } from "../domain/syncTransport";
import { mountGoogleButton } from "../domain/googleButton";
import { track } from "../domain/analytics";
import { FamilySync } from "../hooks/useFamilySync";

/** Offline is not an error, but neither door works without the network —
    say so plainly instead of loading a button that cannot succeed, and come
    back to life on our own the moment the connection returns. */
function useOnline(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);
  return online;
}

function OfflineNote({ what }: { what: string }) {
  return (
    <p className="google-blocked" role="status">
      You’re offline — {what} needs the internet. Your entries are safe on
      this phone meanwhile; this will wake up by itself when you’re back.
    </p>
  );
}

/** The Google button, mounted with an honest failure state. */
function GoogleButtonHost({ onCredential }: { onCredential: (credential: string) => void }) {
  const host = useRef<HTMLDivElement | null>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    let cancelled = false;
    mountGoogleButton(node, onCredential).catch(() => {
      if (!cancelled) setBlocked(true);
    });
    return () => {
      cancelled = true;
    };
    // onCredential is stable for the life of each surface below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (blocked) {
    return (
      <p className="google-blocked" role="alert">
        Google’s sign-in could not load — an ad blocker or offline moment,
        probably. Your backup file works regardless: Settings → Download backup.
      </p>
    );
  }
  return <div className="google-host" ref={host} />;
}

/** An email field and a send button; what the send DOES differs per surface. */
function EmailRow({
  label,
  onSend,
  defaultEmail = "",
}: {
  label: string;
  onSend: (email: string) => Promise<boolean>;
  defaultEmail?: string;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [state, setState] = useState<"idle" | "busy" | "sent">("idle");
  if (state === "sent") {
    return (
      <p className="google-sent" role="status">
        <Mail aria-hidden="true" /> Check your inbox — the link works once and
        expires in 15 minutes.
      </p>
    );
  }
  return (
    <form
      className="email-protect-row"
      onSubmit={(event) => {
        event.preventDefault();
        if (!email.trim()) return;
        setState("busy");
        void onSend(email.trim()).then((ok) => setState(ok ? "sent" : "idle"));
      }}
    >
      <InputGroup>
        <InputGroupInput
          type="email"
          value={email}
          placeholder="your@email.com"
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
        />
      </InputGroup>
      <Button type="submit" variant="outline" disabled={state === "busy"}>{label}</Button>
    </form>
  );
}

/**
 * Settings: bind (or unbind) the account that guards this family.
 * The one-tap promise: with no pairing yet, the tap creates the family
 * first — cloud copy and guard in a single gesture.
 */
export function ProtectWithGoogle({ familySync, immediate = false }: { familySync: FamilySync; immediate?: boolean }) {
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Google's script loads only after this tap — opening Settings costs
  // nothing. The intro modal passes immediate: opening IT was the tap. A
  // device that has authenticated before skips the tap too — familiarity is
  // the whole point of remembering.
  const [hint] = useState(loadAuthHint);
  const [revealed, setRevealed] = useState(immediate || hint !== null);
  const online = useOnline();
  const paired = Boolean(familySync.pairing);

  useEffect(() => {
    if (!paired) return;
    let cancelled = false;
    void familySync.recoveryEmail().then((found) => {
      if (!cancelled) setEmail(found);
    });
    return () => {
      cancelled = true;
    };
    // Re-check when pairing flips; the function identity is per-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paired]);

  async function handleCredential(credential: string) {
    setBusy(true);
    // The lesson of the owner's own two phones: if this account already
    // guards a family, "protect" on a new device means JOIN IT — creating a
    // fresh family first left his second device green-pilled on an orphan
    // copy while the real log lived elsewhere. Probe before creating.
    if (!familySync.pairing) {
      const outcome = await familySync.googleContinue(credential, "This phone");
      track("google_protect_probe", { outcome });
      if (outcome === "joined") {
        const guard = await familySync.recoveryEmail();
        if (guard) setEmail(guard);
        setBusy(false);
        return;
      }
      if (outcome === "failed") {
        setBusy(false);
        return;
      }
      // "none": genuinely the first device — create, then bind below.
      if (!(await familySync.createFamily("This phone"))) {
        setBusy(false);
        return;
      }
    }
    const linked = await familySync.googleProtect(credential);
    track("google_protect", { ok: Boolean(linked) });
    if (linked) setEmail(linked);
    setBusy(false);
  }

  if (email) {
    return (
      <div className="google-protected">
        <p><ShieldCheck aria-hidden="true" /> Protected — a lost phone can be recovered with <strong>{email}</strong>.</p>
        <Button
          variant="ghost"
          size="sm"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            void familySync.googleUnprotect().then((ok) => {
              track("google_unprotect", { ok });
              if (ok) setEmail(null);
              setBusy(false);
            });
          }}
        >
          Remove
        </Button>
      </div>
    );
  }

  return (
    <div className="google-protect">
      {!online ? (
        <OfflineNote what="protecting your log" />
      ) : revealed ? (
        <>
          {hint?.method === "email" && hint.email && (
            <p className="t-meta">Last time you used <strong>{hint.email}</strong>.</p>
          )}
          <GoogleButtonHost onCredential={(credential) => void handleCredential(credential)} />
          <p className="t-meta">…or with any email address:</p>
          <EmailRow
            label="Send link"
            defaultEmail={hint?.method === "email" ? hint.email ?? "" : ""}
            onSend={async (address) => {
              // The one-tap promise holds here too: no pairing -> create it.
              if (!familySync.pairing && !(await familySync.createFamily("This phone"))) return false;
              const ok = await familySync.emailProtect(address);
              track("email_protect_requested", { ok });
              return ok;
            }}
          />
        </>
      ) : (
        <Button variant="outline" onClick={() => { track("google_protect_opened"); setRevealed(true); }}>
          <ShieldCheck /> Protect my log
        </Button>
      )}
      <p className="t-meta">
        One tap guards your whole log: a lost or wiped phone can get everything
        back. Works with Google or any email address — and nothing from your log
        is ever shared with anyone. The guard is optional and removable.
      </p>
    </div>
  );
}

/** Onboarding: the disaster door. A verified sign-in re-joins the family. */
export function RestoreWithGoogle({
  familySync,
  onRestored,
}: {
  familySync: FamilySync;
  onRestored: () => void;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const [hint] = useState(loadAuthHint);
  const [revealed, setRevealed] = useState(hint !== null);
  const online = useOnline();

  async function handleCredential(credential: string) {
    const ok = await familySync.googleRecover(credential, "This phone");
    track("google_recover_attempted", { ok });
    if (ok) onRestored();
    else setFailed("No log is protected by that Google account — check which address you used, or restore a backup file instead.");
  }

  if (!revealed) {
    return (
      <Button type="button" variant="ghost" onClick={() => { track("google_recover_opened"); setRevealed(true); }}>
        <ShieldCheck /> Restore with Google or email
      </Button>
    );
  }
  if (!online) {
    return <OfflineNote what="restoring" />;
  }
  return (
    <div className="google-protect">
      {hint?.method === "email" && hint.email && (
        <p className="t-meta">Last time you used <strong>{hint.email}</strong>.</p>
      )}
      <GoogleButtonHost onCredential={(credential) => void handleCredential(credential)} />
      <EmailRow
        label="Email me a link"
        defaultEmail={hint?.method === "email" ? hint.email ?? "" : ""}
        onSend={async (address) => {
          track("email_recover_requested");
          try {
            await emailRecoverRequest(address);
            return true;
          } catch {
            toast("Could not reach the server — check your connection and try again.");
            return false;
          }
        }}
      />
      {failed && <p className="join-error" role="alert">{failed}</p>}
    </div>
  );
}
