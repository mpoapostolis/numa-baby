// The news archive itself — every release note, readable back to the
// beginning. Its own file so the topbar's newspaper button and the Settings
// row can summon the same dialog from different chunks.

import "../styles/screens/recovery.css";
import { RELEASES, type ReleaseAction } from "../domain/changelog";
import { ReleaseActions } from "./ReleaseActions";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { useCloseOnBack } from "../hooks/useCloseOnBack";
import { currentLocale, t } from "../i18n";

// Lazy, and made once: the locale is not decided when this module evaluates,
// and never changes without a reload. The release notes themselves stay in
// English for everyone; only the chrome and the dates follow the language.
let newsDateFormatCache: Intl.DateTimeFormat | null = null;
const newsDateFormat = () =>
  (newsDateFormatCache ??= new Intl.DateTimeFormat(currentLocale(), { dateStyle: "long" }));

export function NewsDialog({
  open,
  onOpenChange,
  onAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Open what a release is about. The archive closes first, so Back from
      the sheet returns to Today, not to a dialog behind it. */
  onAction?: (to: ReleaseAction["to"]) => void;
}) {
  useCloseOnBack(open, () => onOpenChange(false));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="news-dialog">
        <DialogTitle>{t("News & updates")}</DialogTitle>
        <DialogDescription>
          {t("Built by two parents, evenings, between feeds — here is everything that has changed and why.")}
        </DialogDescription>
        {/* The pinned note — the reason half these releases exist. */}
        <section className="news-note">
          <h3>{t("A thank-you, before the list")}</h3>
          <p>
            {t("I made this app for my own daughter. I never expected that something I built for us would end up in so many families’ hands — and I want to thank every one of you who wrote to me. I read everything you send. Your messages are literally the list below: almost every fix and feature started as someone’s feedback.")}
          </p>
          <p>
            {t("I write the code alone, mostly while the baby sleeps, so some things take an evening or two — but nothing you report is ignored. If something is broken, missing, or just annoying, tap the little message bubble and tell me. It comes straight to me.")}
          </p>
          <p>
            {t("The code may be mine, but nothing else here happens alone — half of every night, and half of our own family’s log, is her mum’s. And one rule above all: an app can help, but your paediatrician always comes first. — Apostolis")}
          </p>
        </section>
        <div className="news-list">
          {RELEASES.map((release, index) => (
            <section key={release.id} className="news-release">
              <p className="news-date">
                {newsDateFormat().format(new Date(`${release.id.slice(0, 10)}T12:00:00`))}
                {index === 0 && <span className="news-latest">{t("Latest")}</span>}
              </p>
              <h3>{release.title}</h3>
              {/* Under the title, as on the card: the way to the thing
                  before the words about it. */}
              <ReleaseActions
                actions={release.actions}
                from="news"
                onAction={onAction && ((to) => {
                  onOpenChange(false);
                  onAction(to);
                })}
              />
              <ul>
                {release.items.map((item) => <li key={item}>{item}</li>)}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
