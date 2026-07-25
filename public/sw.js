self.addEventListener("push", (event) => {
  let data = { title: "Price Alert", body: "A watched stock hit your alert price." };
  try {
    if (event.data) data = event.data.json();
  } catch {
    // ignore malformed payload, use defaults
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/next.svg",
      data: { url: data.url || "/watchlist" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/watchlist";
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
