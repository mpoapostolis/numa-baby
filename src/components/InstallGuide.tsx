// "Is this an app or just a website?" — asked four times, in public, under
// the post most of these families came from. The answer is a Settings row
// that either triggers the real install dialog (Android), or shows the two
// taps Apple hides behind the Share button (iPhone), or — inside the
// Facebook webview, where installing is impossible — helps the person out to
// a real browser first.

import { Fragment, type ReactNode, useState } from "react";
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
import { t, tAs } from "../i18n";

/** One sentence translated whole, with {holes} where the English sets a bold
    word or the Share icon. It is cut at the holes only after translation, so
    the Greek keeps its own word order and the markup still lands on the
    right words. */
function sentence(text: string, parts: Record<string, ReactNode>): ReactNode {
  return t(text).split(/(\{\w+\})/).map((piece, index) => {
    const hole = /^\{(\w+)\}$/.exec(piece)?.[1];
    return <Fragment key={index}>{hole !== undefined && hole in parts ? parts[hole] : piece}</Fragment>;
  });
}

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
              {t("You’re inside {name}’s built-in browser, which can’t install apps — and worse, it keeps your entries inside its own storage.", { name: inAppBrowserName() })}{" "}
              {sentence("Tap the {dots} menu in the corner and choose {open} (or copy the link below and paste it into Safari or Chrome), then install from there.", {
                dots: <strong>⋯</strong>,
                open: <strong>{t("Open in browser")}</strong>,
              })}
            </DialogDescription>
          ) : isIosSafariItself() ? (
            <DialogDescription>
              {sentence("Tap the {share} button {icon} below, then choose {add}.", {
                share: <strong>{t("Share")}</strong>,
                icon: <Share size={14} aria-hidden="true" />,
                add: <strong>{tAs("Add to Home Screen (iOS)", "Add to Home Screen")}</strong>,
              })}{" "}
              {t("That’s the whole install — full screen, offline, and your log is safest there.")}
            </DialogDescription>
          ) : isIosDevice() ? (
            <DialogDescription>
              {sentence("On an iPhone or iPad the install lives in Safari: open {site} there, tap the {share} button {icon}, then {add}.", {
                site: <strong>numalog.app</strong>,
                share: <strong>{t("Share")}</strong>,
                icon: <Share size={14} aria-hidden="true" />,
                add: <strong>{tAs("Add to Home Screen (iOS)", "Add to Home Screen")}</strong>,
              })}
            </DialogDescription>
          ) : (
            <DialogDescription>
              {sentence("Open your browser’s menu and look for {install} or {add}.", {
                install: <strong>{t("Install app")}</strong>,
                add: <strong>{t("Add to Home Screen")}</strong>,
              })}{" "}
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
