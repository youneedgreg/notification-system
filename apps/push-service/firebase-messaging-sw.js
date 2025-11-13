// Firebase Messaging Service Worker
importScripts(
  'https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js',
);
importScripts(
  'https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js',
);

// Initialize Firebase in the service worker
firebase.initializeApp({
  apiKey: 'AIzaSyBshcbfRbWNvPIVbSVEvGkhGVcYbXwAuR0',
  authDomain: 'notification-system-b7464.firebaseapp.com',
  projectId: 'notification-system-b7464',
  storageBucket: 'notification-system-b7464.firebasestorage.app',
  messagingSenderId: '519141925133',
  appId: '1:519141925133:web:44fb6c08a2b6eb35295044',
  measurementId: 'G-3QHWS2N5G5',
});

// Retrieve an instance of Firebase Messaging so that it can handle background messages
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log(
    '[firebase-messaging-sw.js] Received background message:',
    payload,
  );

  const notificationTitle = payload.notification?.title || 'New Notification';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: payload.notification?.icon,
    tag: payload.data?.notification_id || 'notification',
    requireInteraction: true,
    data: payload.data,
  };

  return self.registration.showNotification(
    notificationTitle,
    notificationOptions,
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  console.log(
    '[firebase-messaging-sw.js] Notification clicked:',
    event.notification,
  );

  event.notification.close();

  // Open the app or focus existing window
  const urlToOpen = event.notification.data?.link || 'http://localhost:3000';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
            return client.focus();
          }
        }
        // If not, open a new window
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      }),
  );
});
