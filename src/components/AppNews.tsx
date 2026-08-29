// The owner's voice, with a permanent address. The what's-new card speaks
// once per release and vanishes; this is where everything it ever said can
// be read back — the app's own news page, one dialog, zero new tabs. (A
// sixth tab was considered and rejected: a screen visited monthly does not
// deserve a berth the thumb sees hourly.)

// Ships with the Settings chunk — the budget rule.
import { useState } from "react";
import { Newspaper } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { SettingsAction } from "./SettingsAction";
import { RELEASES } from "../domain/changelog";
import { track } from "../domain/analytics";

const newsDateFormat = new Intl.DateTimeFormat("en", { dateStyle: "long" });

export function AppNews() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SettingsAction
        title="What’s new"
        description="Every update and announcement, from the dad who builds this"
        icon={<Newspaper />}
        onClick={() => { track("news_opened"); setOpen(true); }}
      />
      <Dialog open={open} onOpenChange={setOpen}>
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
    </>
  );
}
