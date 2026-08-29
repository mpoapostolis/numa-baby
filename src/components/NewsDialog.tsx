// The news archive itself — every release note, readable back to the
// beginning. Its own file so the topbar's newspaper button and the Settings
// row can summon the same dialog from different chunks.

import "../styles/screens/recovery.css";
import { RELEASES } from "../domain/changelog";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";

const newsDateFormat = new Intl.DateTimeFormat("en", { dateStyle: "long" });

export function NewsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="news-dialog">
        <DialogTitle>News & updates</DialogTitle>
        <DialogDescription>
          Built by one dad, evenings, between feeds — here is everything that
          has changed and why.
        </DialogDescription>
        <div className="news-list">
          {RELEASES.map((release) => (
            <section key={release.id} className="news-release">
              <h3>{release.title}</h3>
              <p className="t-meta">{newsDateFormat.format(new Date(`${release.id}T12:00:00`))}</p>
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
