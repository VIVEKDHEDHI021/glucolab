importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyChFMJEzPJeCr8EeZYsqgNLA5B3QoXXzIY",
  authDomain: "glucolab-1ad86.firebaseapp.com",
  projectId: "glucolab-1ad86",
  storageBucket: "glucolab-1ad86.firebasestorage.app",
  messagingSenderId: "345207046556",
  appId: "1:345207046556:web:c6eb5e5754fc907e38c859",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Received background message:", payload);

  const notificationTitle = payload.notification?.title || "GlucoLab Update";
  const notificationOptions = {
    body: payload.notification?.body || "A new update was recorded on your account.",
    icon: "/logo.png",
    badge: "/icon/icon.png",
    data: payload.data || {},
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks to focus existing tab or open GlucoLab
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let targetUrl = "/";

  if (data.action === "open_reports") {
    targetUrl = "/reports";
  } else if (data.action === "open_history") {
    targetUrl = "/history";
  } else if (data.action === "open_dashboard") {
    targetUrl = "/dashboard";
  }

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ("focus" in client) {
          if ("navigate" in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    }),
  );
});
