/* Kartha front door: keeps the start page on the phone so the app opens fast and can be installed. */
const CACHE = 'kartha-door-v5';
const FILES = ['./', './index.html', './config.js', './manifest.webmanifest', './kartha-icon.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;     // sign-in and the app itself always go to the network
  e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match('./'))));
});

/* Phone notifications (Firebase, Google's free push service). Grouped: one per kind with the same tag, so each one
   updates its count. They carry chat names and counts only, never message text. */
self.addEventListener('push', e => {
  let d = {};
  try { const j = e.data ? e.data.json() : {}; d = j.data || j; } catch (err) { d = {}; }
  if (d.k !== 'kartha' || !d.tag) return;
  if (d.clear === '1') {
    e.waitUntil(self.registration.getNotifications({ tag: d.tag }).then(ns => ns.forEach(n => n.close())));
    return;
  }
  e.waitUntil(Promise.all([self.registration.showNotification(d.title || 'Kartha', {
    body: d.body || '', tag: d.tag, renotify: true, icon: 'kartha-icon.png', badge: 'kartha-icon.png', data: { open: d.open || '' }
  }), self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => list.forEach(c => c.postMessage({ karthaPush: 1 })))]));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const open = (e.notification.data && e.notification.data.open) || '';
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const w = list.find(c => c.url.indexOf(self.registration.scope) === 0);
    if (w) { w.postMessage({ karthaOpen: open }); return w.focus(); }
    return self.clients.openWindow('./?open=' + encodeURIComponent(open));
  }));
});
