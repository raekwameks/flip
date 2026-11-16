// ===== Offline cache =====
// Saves the app's files on the phone so it opens with no signal.
// WHEN YOU CHANGE ANY FILE: bump VERSION (and APP_VERSION in app.js) so phones pick up the update.
const VERSION = '9';
const CACHE = 'flip-v' + VERSION;
const FILES = [
  './', 'index.html', 'style.css', 'db.js', 'app.js', 'stock.js', 'manifest.json',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
  'lib/html5-qrcode.min.js',
];

self.addEventListener('install', e => {
  // cache: 'reload' makes sure we save fresh copies, not old ones from the browser
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('flip-v') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return; // internet-only things

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // Opening the app (any page address): always serve the saved index.html
    if (req.mode === 'navigate') {
      return (await cache.match('index.html')) || (await cache.match('./')) || fetch(req);
    }
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    // Not saved yet: get it online and save a copy for next time
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  })());
});
