// Shown only inside the Facebook / Instagram / Messenger webview — where most
// of this app's families first tap the link. That browser cannot install the
// app, and its storage belongs to the Facebook app: clearing or reinstalling
// Facebook takes the log with it. "Ayaw po gumana ng link" under the post
// this app spread through was somebody hitting exactly this wall.
//
// One job: get the person out to a real browser BEFORE they start logging,
// while their record is still empty and moving costs nothing.

import { useState } from "react";
import { toast } from "sonner";
import { SquareArrowOutUpRight } from "lucide-react";
import { Button } from "./ui/button";
import { inAppBrowser } from "../domain/install";
import { track } from "../domain/analytics";

const DISMISSED_KEY = "numalog-inapp-dismissed-v1";

function dismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) !== null;
  } catch {
    return false;
  }
}

export function InAppEscape() {
  const [trapped] = useState(inAppBrowser);
  const [hidden, setHidden] = useState(dismissed);
  if (!trapped || hidden) return null;

  return (
    <div className="inapp-escape" role="status">
      <p>
        <strong>You’re in Facebook’s built-in browser.</strong> It can’t install
        the app, and it keeps your entries inside Facebook — open this in Safari
        or Chrome so your baby’s log is safe. Tap <strong>⋯</strong> →{" "}
        <strong>Open in browser</strong>, or copy the link:
      </p>
      <div className="inapp-escape-actions">
        <Button
          size="sm"
          onClick={() => {
            track("inapp_copy_link");
            void navigator.clipboard?.writeText(window.location.origin).then(
              () => toast("Link copied — paste it in Safari or Chrome"),
              () => toast(window.location.origin),
            );
          }}
        >
          <SquareArrowOutUpRight /> Copy link
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setHidden(true);
            try {
              window.localStorage.setItem(DISMISSED_KEY, "1");
            } catch {
              // Session state still hides it.
            }
          }}
        >
          Continue here anyway
        </Button>
      </div>
    </div>
  );
}
