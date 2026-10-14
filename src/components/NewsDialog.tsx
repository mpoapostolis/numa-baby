// The news archive itself — every release note, readable back to the
// beginning. Its own file so the topbar's newspaper button and the Settings
// row can summon the same dialog from different chunks.

import "../styles/screens/recovery.css";
import { RELEASES, type ReleaseAction } from "../domain/changelog";
import { ReleaseActions } from "./ReleaseActions";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { useCloseOnBack } from "../hooks/useCloseOnBack";

const newsDateFormat = new Intl.DateTimeFormat("en", { dateStyle: "long" });

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
        <DialogTitle>News & updates</DialogTitle>
        <DialogDescription>
          Built by two parents, evenings, between feeds — here is everything
          that has changed and why.
        </DialogDescription>
        {/* The pinned note — the reason half these releases exist. */}
        <section className="news-note">
          <h3>A thank-you, before the list</h3>
          <p>
            I made this app for my own daughter. I never expected that something
            I built for us would end up in so many families&rsquo; hands — and I
            want to thank every one of you who wrote to me. I read everything
            you send. Your messages are literally the list below: almost every
            fix and feature started as someone&rsquo;s feedback.
          </p>
          <p>
            I write the code alone, mostly while the baby sleeps, so some
            things take an evening or two — but nothing you report is ignored.
            If something is broken, missing, or just annoying, tap the little
            message bubble and tell me. It comes straight to me.
          </p>
          <p>
            The code may be mine, but nothing else here happens alone — half
            of every night, and half of our own family&rsquo;s log, is her
            mum&rsquo;s. And one rule above all: an app can help, but your
            paediatrician always comes first. — Apostolis
          </p>
        </section>
        <div className="news-list">
          {RELEASES.map((release, index) => (
            <section key={release.id} className="news-release">
              <p className="news-date">
                {newsDateFormat.format(new Date(`${release.id.slice(0, 10)}T12:00:00`))}
                {index === 0 && <span className="news-latest">Latest</span>}
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
