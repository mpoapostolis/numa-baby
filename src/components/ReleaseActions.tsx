// The buttons under a release note: the thing it announces, one tap away.
// "Months is on Today, under your baby's name" is directions; a button that
// opens Months is the thing itself. Shared by the card on Today and the News
// archive.

import "../styles/screens/news-actions.css";
import { Camera, Droplets, Images, Syringe } from "lucide-react";
import type { ReleaseAction } from "../domain/changelog";
import { track } from "../domain/analytics";

const ICON = { months: Images, vaccines: Syringe, profile: Camera, pump: Droplets } as const;

export function ReleaseActions({
  actions,
  from,
  onAction,
}: {
  actions: ReleaseAction[] | undefined;
  from: "card" | "news";
  onAction: ((to: ReleaseAction["to"]) => void) | undefined;
}) {
  if (!actions?.length || !onAction) return null;
  return (
    <div className="release-actions">
      {actions.map((action) => {
        const Icon = ICON[action.to];
        return (
          <button
            key={action.to}
            type="button"
            className={`release-action is-${action.to}`}
            onClick={() => {
              track("release_action", { to: action.to, from });
              onAction(action.to);
            }}
          >
            <Icon size={14} aria-hidden="true" />
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
