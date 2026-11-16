// ===== Offline cache =====
// Saves the app's files on the phone so it opens with no signal.
// WHEN YOU CHANGE ANY FILE: bump VERSION (and APP_VERSION in app.js) so phones pick up the update.
const VERSION = '1';
const CACHE = 'flip-v' + VERSION;
const FILES = [
  './', 'index.html', 'style.css', 'db.js', 'app.js', 'manifest.json',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// App files: use the saved copy. Anything else (barcode lookups etc.): go to the internet.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request)));
});
