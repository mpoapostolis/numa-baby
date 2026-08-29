// The owner's voice in Settings — the row that opens the news archive.
// (The Today topbar carries a newspaper button to the same dialog; the
// dialog itself lives in NewsDialog.tsx so both chunks share it.)

import { useState } from "react";
import { Newspaper } from "lucide-react";
import { NewsDialog } from "./NewsDialog";
import { SettingsAction } from "./SettingsAction";
import { track } from "../domain/analytics";

export function AppNews() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <SettingsAction
        title="What’s new"
        description="Every update and announcement, from the dad who builds this"
        icon={<Newspaper />}
        onClick={() => { track("news_opened", { from: "settings" }); setOpen(true); }}
      />
      <NewsDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
