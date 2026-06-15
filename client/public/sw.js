// Service Worker — Web Push สำหรับ STAK
// รับ push event จากเซิร์ฟเวอร์ และแสดง OS notification แม้แอปไม่ได้เปิดอยู่

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "STAK", body: event.data ? event.data.text() : "" };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "STAK", {
      body: data.body || "",
      icon: "/figmaAssets/icon.svg",
      badge: "/figmaAssets/icon.svg",
      data: { link: data.link || null },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientsArr) => {
      if (clientsArr.length > 0) {
        return clientsArr[0].focus();
      }
      return self.clients.openWindow("/");
    })
  );
});
