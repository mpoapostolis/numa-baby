// Where a scanned invite lands on a brand-new phone.
//
// The partner's phone is almost always empty — that is the whole point of
// pairing — so a QR that dropped them into onboarding would ask them to
// invent a baby that already exists, and quietly discard the code on the way.
// This screen replaces onboarding for exactly that case: the code is already
// in hand, one tap joins, and the profile and the whole history arrive over
// the sync a moment later.

// Ships with this lazy chunk, not the app shell — the budget rule.
import "../styles/screens/settings.css";
import { useState } from "react";
import { Users } from "lucide-react";
import { Button } from "./ui/button";
import { BabyFace } from "./illustrations";
import { track } from "../domain/analytics";
import { FamilySync } from "../hooks/useFamilySync";
import { t } from "../i18n";

type JoinFamilyScreenProps = {
  code: string;
  familySync: FamilySync;
  /** Marks this phone ready so the sync engine can pull the family history. */
  onJoined: () => boolean;
  /** Called when the parent would rather set this phone up on its own. */
  onSkip: () => void;
};

export default function JoinFamilyScreen({ code, familySync, onJoined, onSkip }: JoinFamilyScreenProps) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // Almost always zero (a fresh phone is the whole point) — but a phone that
  // HAS been logging deserves to know a join merges, before the tap.
  const [localCount] = useState(() => familySync.localEntryCount());

  async function handleJoin() {
    setBusy(true);
    setFailed(false);
    const joined = await familySync.joinFamily(code, t("This phone"));
    track("family_join_attempted", { ok: joined, source: "scanned_qr" });
    if (joined) onJoined();
    else setFailed(true);
    setBusy(false);
  }

  return (
    <main className="screen join-screen" aria-labelledby="join-heading">
      <span className="join-art" aria-hidden="true"><BabyFace size={72} /></span>
      <p className="t-label">{t("Invite scanned")}</p>
      <h1 id="join-heading" className="t-title-1">{t("Join your family log")}</h1>
      <p className="t-body join-copy">
        {t("This phone will share one log with the phone that showed you the code — every feed, diaper and note, on both.")}
      </p>
      <p className="join-code figure">{code}</p>

      {localCount > 0 && (
        <p className="t-meta">
          {localCount === 1
            ? t("The 1 entry already on this phone will be merged into the family log — nothing is deleted.")
            : t("The {n} entries already on this phone will be merged into the family log — nothing is deleted.", { n: localCount })}
        </p>
      )}

      {failed && (
        <p className="join-error" role="alert">
          {t("The join did not go through — the code may have expired (codes from a partner’s phone last 15 minutes and work once), or this phone may be offline. Nothing changed; try again or ask for a fresh code.")}
        </p>
      )}

      <Button className="join-action" disabled={busy} onClick={() => void handleJoin()}>
        <Users size={16} aria-hidden="true" /> {busy ? t("Joining…") : t("Join the family")}
      </Button>
      <Button variant="ghost" onClick={onSkip}>{t("Set this phone up on its own")}</Button>
    </main>
  );
}
