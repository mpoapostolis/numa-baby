// The card that asks about a backup while there is still something to back up.
//
// Deliberately not a modal and not a toast. A modal at 3am is an obstacle, and
// a toast disappears before a tired person has decided anything. It sits in
// the banner stack, states the number of entries at stake, and offers the one
// action that resolves it — with a "not now" that is honoured for a fortnight.

import { ShieldCheck } from "lucide-react";
import { Button } from "./ui/button";
import { BackupNudge as Nudge } from "../domain/backupNudge";
import { t } from "../i18n";

export function BackupNudgeCard({
  nudge,
  onBackup,
  onDismiss,
}: {
  nudge: Nudge;
  onBackup: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="banner-stack">
      <div className={`backup-nudge tone-${nudge.tone}`} role="status">
        <span className="backup-nudge-icon" aria-hidden="true"><ShieldCheck /></span>
        <div className="backup-nudge-copy">
          <strong>{t(nudge.headline, nudge.vars)}</strong>
          <small>{t(nudge.body)}</small>
        </div>
        <div className="backup-nudge-actions">
          <Button onClick={onBackup}>{t(nudge.action)}</Button>
          <Button variant="ghost" onClick={onDismiss}>{t("Not now")}</Button>
        </div>
      </div>
    </div>
  );
}
