// The two things the service worker does with notifications: show one that
// arrived from the push service, and open the app when it is tapped.
//
// The push payload is written by worker/push.ts and carries nothing about
// anybody's baby — a fixed title, a fixed body and a tag. The tag is what
// stops a reminder the phone scheduled locally and the same reminder arriving
// by push from ever showing twice: same tag, one notification. One
// notification, but every new reminder still rings — see renotify below.

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // A push with no readable body still deserves to ring.
  }
  const title = typeof payload.title === "string" ? payload.title : "Numalog";
  // Never empty: renotify with an empty tag is a TypeError.
  const tag = typeof payload.tag === "string" && payload.tag ? payload.tag : "numalog";
  const show = (ring) =>
    self.registration.showNotification(title, {
      body: typeof payload.body === "string" ? payload.body : "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag,
      // Replacing a notification with the same tag is SILENT by default. A
      // parent who fed at 3am and opened the app from its icon left the 3am
      // reminder in the shade, and the 6am one quietly took its place.
      renotify: ring,
      data: { url: typeof payload.url === "string" ? payload.url : "/", shownAt: Date.now() },
    });
  // Ring again only over an OLDER reminder. The same one arriving twice — the
  // phone's own timer and the server's push, or a resend — replaces itself
  // quietly: under the shortest interval the settings allow (90 minutes), a
  // notification shown less than an hour ago is this one. renotify is
  // Chrome's; closing the older one first makes the new one a fresh alert
  // everywhere else too. Nothing here may stop the show itself.
  const decide = Promise.resolve()
    .then(() => self.registration.getNotifications({ tag }))
    .then((open) => {
      if (open.some((notification) => Date.now() - (notification.data?.shownAt ?? 0) < SAME_REMINDER_MS)) return false;
      open.forEach((notification) => notification.close());
      return true;
    })
    .catch(() => true);
  event.waitUntil(decide.then(show));
});

/** Under the shortest reminder interval: a same-tag notification younger than
    this is the same reminder, delivered twice. */
const SAME_REMINDER_MS = 60 * 60_000;

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const destination = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const existing = windows.find((client) => "focus" in client);
      if (!existing) return self.clients.openWindow(destination);
      // NAVIGATE, then focus. Focusing alone threw the destination away: an
      // announcement sent to /insights just re-showed whatever screen the
      // app happened to be on, so the url that readDraft validates so
      // carefully did nothing for anyone with the app already open.
      //
      // But only when it is somewhere else. Every reminder is "/", where the
      // app already is, and navigating there is a full reload: the white
      // noise stopped and an open sheet was lost, for a tap that meant "show me".
      const target = new URL(destination, self.location.origin);
      const here = new URL(existing.url);
      const alreadyThere =
        here.origin === target.origin && here.pathname === target.pathname && here.search === target.search;
      if (alreadyThere || !existing.navigate) return existing.focus();
      return existing.navigate(target.href).catch(() => existing)
        .then((client) => (client || existing).focus());
    }),
  );
});
