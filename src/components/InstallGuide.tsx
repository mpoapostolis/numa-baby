// "Is this an app or just a website?" — asked four times, in public, under
// the post most of these families came from. The answer is a Settings row
// that either triggers the real install dialog (Android), or shows the two
// taps Apple hides behind the Share button (iPhone), or — inside the
// Facebook webview, where installing is impossible — helps the person out to
// a real browser first.

import { useState } from "react";
import { toast } from "../lib/toast";
import { Share, Smartphone, SquareArrowOutUpRight } from "lucide-react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { ItemGroup } from "./ui/item";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { SettingsAction } from "./SettingsAction";
import { canPromptInstall, inAppBrowser, inAppBrowserName, isIosDevice, isIosSafariItself, promptInstall } from "../domain/install";
import { isStandalone } from "../domain/platform";
import { track } from "../domain/analytics";
import { t } from "../i18n";

export function InstallGuide() {
  const [explaining, setExplaining] = useState(false);
  // Standalone means the job is done; the row would only invite confusion.
  if (isStandalone()) return null;

  const trapped = inAppBrowser();

  return (
    <Card className="settings-group">
      <CardContent>
        <ItemGroup className="settings-action-list" role="group" aria-label={t("Install the app")}>
          <SettingsAction
        title={t("Install on this phone")}
        description={t("Home-screen icon, full screen, works offline — and your log is safest there")}
        icon={<Smartphone />}
        onClick={() => {
          track("install_opened", { trapped, canPrompt: canPromptInstall() });
          if (trapped || !canPromptInstall()) {
            setExplaining(true);
            return;
          }
          void promptInstall().then((outcome) => {
            track("install_prompt_done", { outcome });
            // The browser refused after all — the instructions still exist.
            if (outcome === "unavailable") setExplaining(true);
          });
        }}
          />
        </ItemGroup>
      </CardContent>

      <Dialog open={explaining} onOpenChange={setExplaining}>
        <DialogContent>
          <DialogTitle>{trapped ? t("First, leave the {name} browser", { name: inAppBrowserName() }) : t("Two taps away")}</DialogTitle>
          {trapped ? (
            <DialogDescription>
              {t("You’re inside {name}’s built-in browser, which can’t install apps — and worse, it keeps your entries inside its own storage. Tap the", { name: inAppBrowserName() })}{" "}
              <strong>⋯</strong> {t("menu in the corner and choose")}{" "}
              <strong>{t("Open in browser")}</strong>{" "}
              {t("(or copy the link below and paste it into Safari or Chrome), then install from there.")}
            </DialogDescription>
          ) : isIosSafariItself() ? (
            <DialogDescription>
              {t("Below, tap the Share button")}{" "}
              <Share size={14} aria-hidden="true" />{t(", then choose")}{" "}
              <strong>{t("Add to Home Screen")}</strong>.{" "}
              {t("That’s the whole install — full screen, offline, and your log is safest there.")}
            </DialogDescription>
          ) : isIosDevice() ? (
            <DialogDescription>
              {t("On an iPhone or iPad the install lives in Safari: open numalog.app there and tap the Share button")}{" "}
              <Share size={14} aria-hidden="true" />{t(", then")}{" "}
              <strong>{t("Add to Home Screen")}</strong>.
            </DialogDescription>
          ) : (
            <DialogDescription>
              {t("Open your browser’s menu and look for")}{" "}
              <strong>{t("Install app")}</strong> {t("or")} <strong>{t("Add to Home Screen")}</strong>.{" "}
              {t("Once installed it opens full screen, works offline, and your log is safest there.")}
            </DialogDescription>
          )}
          {trapped && (
            <Button
              onClick={() => {
                if (navigator.clipboard) {
                  void navigator.clipboard.writeText(window.location.origin).then(
                    () => toast(t("Link copied — paste it in Safari or Chrome")),
                    () => toast(window.location.origin),
                  );
                } else {
                  // No clipboard in this webview: showing the address IS the fallback.
                  toast(window.location.origin);
                }
              }}
            >
              <SquareArrowOutUpRight /> {t("Copy the app’s link")}
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
