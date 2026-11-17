// Service worker : met l'application en cache pour l'ouvrir hors ligne.
// Les appels à api.github.com ne passent jamais par le cache (données chiffrées, toujours fraîches).
// Changer VERSION à chaque publication pour renouveler le cache.
const VERSION = 'coach-mobile-v1';
const COQUILLE = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/crypto.js', 'js/store.js', 'js/github.js', 'js/plan.js', 'js/vues.js',
  'fonts/exo2-700.woff2', 'fonts/texte-400.woff2', 'fonts/texte-700.woff2',
  'icons/icone-192.png', 'icons/icone-512.png', 'icons/icone-180.png', 'icons/icone-maskable-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  // Démo : l'instantané factice reste en réseau d'abord, avec repli sur le cache.
  if (url.pathname.endsWith('/demo/instantane.json')) {
    e.respondWith(fetch(req).then(r => { const k = r.clone(); caches.open(VERSION).then(c => c.put(req, k)); return r; }).catch(() => caches.match(req)));
    return;
  }
  // Coquille : cache d'abord (navigation : index.html quels que soient les paramètres).
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const hit = req.mode === 'navigate' ? (await c.match('index.html')) : await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const r = await fetch(req);
      if (r.ok && r.type === 'basic') c.put(req, r.clone());
      return r;
    } catch (err) {
      return new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
