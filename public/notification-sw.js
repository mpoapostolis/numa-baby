// The two things the service worker does with notifications: show one that
// arrived from the push service, and open the app when it is tapped.
//
// The push payload is written by worker/push.ts and carries nothing about
// anybody's baby — a fixed title, a fixed body and a tag. The tag is what
// stops a reminder the phone scheduled locally and the same reminder arriving
// by push from ever showing twice: same tag, one notification.

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // A push with no readable body still deserves to ring.
  }
  const title = typeof payload.title === "string" ? payload.title : "Numalog";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof payload.body === "string" ? payload.body : "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: typeof payload.tag === "string" ? payload.tag : "numalog",
      data: { url: typeof payload.url === "string" ? payload.url : "/" },
    }),
  );
});

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
      return (existing.navigate ? existing.navigate(destination).catch(() => existing) : Promise.resolve(existing))
        .then((client) => (client || existing).focus());
    }),
  );
});
