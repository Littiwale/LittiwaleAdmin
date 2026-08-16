const CACHE_NAME = 'littiwale-admin-pwa-v1.0';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/css/receipt-printer.css',
  '/js/app.js',
  '/js/receipt-printer.js',
  '/images/logo.png',
  '/manifest.json'
];

// Install Event - Pre-cache critical app shell assets
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Pre-cache non-fatal error:', err);
      });
    })
  );
});

// Activate Event - Clean up stale cache versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network First with Cache Fallback for dynamic live operations
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Skip non-GET requests and API calls from static caching (API stays live)
  if (event.request.method !== 'GET' || requestUrl.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Fallback to cache if network is offline
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
          return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
        });
      })
  );
});

// Push Notification Support for Live Incoming Orders
self.addEventListener('push', (event) => {
  let data = { title: '🔔 New Order Received!', body: 'A new order has been placed on Littiwale.' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/images/logo.png',
    badge: '/images/logo.png',
    vibrate: [200, 100, 200, 100, 200, 100, 400],
    data: {
      url: data.url || '/#orders-section'
    },
    actions: [
      { action: 'view', title: 'Open Orders Table' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/#orders-section';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes('localhost:5001') || client.url.includes('littiwale-admin')) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
