// "Tell another parent" — the app handing itself onward.
//
// On phones this is the native share sheet, which is strictly better than
// anything a web page can draw. The dialog below exists for the browsers
// that have no share sheet (desktop, mostly): the handful of places parents
// actually paste links, plus copy. No library — every one of these buttons
// is a URL, and a share widget dependency would cost more bytes than this
// whole file.

import { Copy, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";
import { track } from "../domain/analytics";
import { APP_SHARE } from "../domain/shareApp";

const APP_URL = APP_SHARE.url;
const APP_TEXT = APP_SHARE.text;

const TARGETS = [
  { label: "WhatsApp", url: `https://wa.me/?text=${encodeURIComponent(`${APP_TEXT} ${APP_URL}`)}` },
  { label: "Facebook", url: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(APP_URL)}` },
  { label: "Telegram", url: `https://t.me/share/url?url=${encodeURIComponent(APP_URL)}&text=${encodeURIComponent(APP_TEXT)}` },
  { label: "Email", url: `mailto:?subject=${encodeURIComponent("A baby tracker you might like")}&body=${encodeURIComponent(`${APP_TEXT}\n\n${APP_URL}`)}` },
];

export default function ShareNumalogDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="share-app-dialog">
        <DialogTitle>Tell another parent</DialogTitle>
        <DialogDescription>
          Numalog is free, needs no account and works on any phone — send it to
          someone in the thick of it.
        </DialogDescription>
        <div className="share-app-grid">
          {TARGETS.map((target) => (
            <a
              key={target.label}
              className="share-app-link"
              href={target.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => track("app_shared", { via: target.label.toLowerCase() })}
            >
              {target.label} <ExternalLink size={13} aria-hidden="true" />
            </a>
          ))}
          <button
            type="button"
            className="share-app-link"
            onClick={() => {
              track("app_shared", { via: "copy" });
              void navigator.clipboard?.writeText(APP_URL).then(
                () => toast("Link copied — send it however you like."),
                () => toast("numalog.app — that's the whole link."),
              );
            }}
          >
            Copy link <Copy size={13} aria-hidden="true" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
