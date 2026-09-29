const CACHE_NAME = 'exord-hrm-v4';
const SHELL_URLS = ['/', '/index.html'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_URLS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('/index.html').then(r => r || fetch(req)))
    );
    return;
  }

  if (url.origin === self.location.origin && /\/assets\//.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(cached => {
        if (cached) return cached;
        return fetch(req).then(res => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, clone));
          }
          return res;
        });
      })
    );
  }
});

self.addEventListener('push', event => {
  let data = { title: 'Exord Online', body: 'You have a new notification.', view: 'dashboard', icon: '/logo.png' };
  if (event.data) {
    try {
      data = Object.assign({}, data, event.data.json());
    } catch (e) {
      data.body = event.data.text();
    }
  }
  const options = {
    body: data.body,
    icon: data.icon || '/logo.png',
    badge: '/logo.png',
    tag: data.view || 'general',
    renotify: true,
    requireInteraction: false,
    data: { view: data.view || 'dashboard' },
    actions: [
      { action: 'open', title: 'Open' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const targetView = (event.notification.data && event.notification.data.view) || 'dashboard';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const exordClient = clientList.find(c => c.url.indexOf(self.location.origin) === 0);
      if (exordClient) {
        exordClient.focus();
        exordClient.postMessage({ type: 'NAVIGATE', view: targetView });
        return;
      }
      return self.clients.openWindow('/?view=' + targetView);
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const title = event.data.title || 'Exord Online';
    const body = event.data.body || '';
    const view = event.data.view || 'dashboard';
    const icon = event.data.icon || '/logo.png';
    self.registration.showNotification(title, {
      body: body,
      icon: icon,
      badge: '/logo.png',
      tag: view,
      renotify: true,
      data: { view: view }
    });
  }
});
