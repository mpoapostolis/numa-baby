// "Is this an app or just a website?" — asked four times, in public, under
// the post most of these families came from. The answer is a Settings row
// that either triggers the real install dialog (Android), or shows the two
// taps Apple hides behind the Share button (iPhone), or — inside the
// Facebook webview, where installing is impossible — helps the person out to
// a real browser first.

import { useState } from "react";
import { toast } from "sonner";
import { Share, Smartphone, SquareArrowOutUpRight } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { ItemGroup } from "./ui/item";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { SettingsAction } from "./SettingsAction";
import { canPromptInstall, inAppBrowser, isIosSafari, promptInstall } from "../domain/install";
import { isStandalone } from "../domain/platform";
import { track } from "../domain/analytics";

export function InstallGuide() {
  const [explaining, setExplaining] = useState(false);
  // Standalone means the job is done; the row would only invite confusion.
  if (isStandalone()) return null;

  const trapped = inAppBrowser();

  return (
    <Card className="settings-group">
      <CardContent>
        <ItemGroup className="settings-action-list" role="group" aria-label="Install the app">
          <SettingsAction
        title="Install on this phone"
        description="Home-screen icon, full screen, works offline — and your log is safest there"
        icon={<Smartphone />}
        onClick={() => {
          track("install_opened", { trapped, canPrompt: canPromptInstall() });
          if (trapped || !canPromptInstall()) {
            setExplaining(true);
            return;
          }
          void promptInstall().then((outcome) => track("install_prompt_done", { outcome }));
        }}
          />
        </ItemGroup>
      </CardContent>

      <Dialog open={explaining} onOpenChange={setExplaining}>
        <DialogContent>
          <DialogTitle>{trapped ? "First, leave the Facebook browser" : "Two taps away"}</DialogTitle>
          {trapped ? (
            <DialogDescription>
              You’re inside Facebook’s built-in browser, which can’t install
              apps — and worse, it keeps your entries inside Facebook’s own
              storage. Tap the <strong>⋯</strong> menu in the corner and choose{" "}
              <strong>Open in browser</strong> (or copy the link below and paste
              it into Safari or Chrome), then install from there.
            </DialogDescription>
          ) : isIosSafari() ? (
            <DialogDescription>
              In Safari, tap the <strong>Share</strong> button{" "}
              <Share size={14} aria-hidden="true" /> below, then choose{" "}
              <strong>Add to Home Screen</strong>. That’s the whole install —
              full screen, offline, and your log is safest there.
            </DialogDescription>
          ) : (
            <DialogDescription>
              Open your browser’s menu and look for{" "}
              <strong>Install app</strong> or <strong>Add to Home Screen</strong>.
              Once installed it opens full screen, works offline, and your log
              is safest there.
            </DialogDescription>
          )}
          {trapped && (
            <Button
              onClick={() => {
                void navigator.clipboard?.writeText(window.location.origin).then(
                  () => toast("Link copied — paste it in Safari or Chrome"),
                  () => toast(window.location.origin),
                );
              }}
            >
              <SquareArrowOutUpRight /> Copy the app’s link
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
