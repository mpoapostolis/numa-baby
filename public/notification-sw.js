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
  // Which reminder this is: the time it was due for. The phone's own timer
  // and the server's push for the SAME reminder carry the same time.
  const due = typeof payload.due === "string" ? payload.due : null;
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
      data: { url: typeof payload.url === "string" ? payload.url : "/", due },
    });
  // The same reminder arriving twice — the phone's own timer and the server's
  // push, or a resend — replaces itself quietly. Anything else rings: a new
  // reminder, a note from the developer. renotify is Chrome's; closing the
  // older one first makes the new one a fresh alert everywhere else too.
  // Nothing here may stop the show itself.
  const decide = Promise.resolve()
    .then(() => self.registration.getNotifications({ tag }))
    .then((open) => {
      if (due && open.some((notification) => sameReminder(notification, due))) return false;
      open.forEach((notification) => notification.close());
      return true;
    })
    .catch(() => true);
  event.waitUntil(decide.then(show));
});

/** The same reminder as `due`: the same due time — or, for one shown by an
    older version of the app (which kept no due time), shown within the last
    hour, under the shortest reminder interval. */
function sameReminder(notification, due) {
  const data = notification.data || {};
  if ("due" in data) return data.due === due;
  return Date.now() - (notification.timestamp || 0) < 60 * 60_000;
}

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
