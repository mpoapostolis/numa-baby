// "Tell another parent" — the app handing itself onward.
//
// The owner's call: the branded dialog opens EVERYWHERE (a share row that
// looks the same on every device), with the phone's native sheet one tap
// away inside it for Messenger, Viber, SMS and whatever else lives on that
// phone. No library — every button here is a URL, and a share widget
// dependency would cost more bytes than this whole file.

import { Copy, ExternalLink } from "lucide-react";
import { toast } from "../lib/toast";
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
          {/* The phone's own sheet, for Messenger, Viber, SMS and whatever
              else lives on this particular phone. */}
          {"share" in navigator && (
            <button
              type="button"
              className="share-app-link"
              onClick={() => {
                track("app_shared", { via: "native" });
                void navigator.share({ title: APP_SHARE.title, text: APP_TEXT, url: APP_URL }).catch(() => undefined);
              }}
            >
              More apps… <ExternalLink size={13} aria-hidden="true" />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
