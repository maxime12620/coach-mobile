// Service worker : ouvre l'application hors ligne sans jamais figer une ancienne interface.
// Coquille (index.html, js, css…) : réseau d'abord, copie mise en cache à chaque réponse ; repli sur le cache si le
// réseau manque ou tarde (hors ligne garanti). Les appels à api.github.com ne passent jamais par ici (autre origine).
// Changer VERSION à chaque publication : les anciens caches sont purgés à l'activation.
const VERSION = 'coach-mobile-v9';
const COQUILLE = [
  './', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/crypto.js', 'js/store.js', 'js/github.js', 'js/plan.js', 'js/vues.js', 'js/muscu.js', 'js/analyse.js',
  'fonts/exo2-700.woff2', 'fonts/texte-400.woff2', 'fonts/texte-700.woff2',
  'icons/icone-192.png', 'icons/icone-512.png', 'icons/icone-180.png', 'icons/icone-maskable-512.png',
];
const DELAI = 4000; // au-delà, le cache répond (réseau lent) ; la réponse du réseau met quand même le cache à jour

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(COQUILLE.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;
  const nav = req.mode === 'navigate';
  // navigation : une seule entrée « index.html », quels que soient les paramètres (?demo=1…)
  const cle = nav ? new URL('index.html', self.registration.scope).href : req;
  const reseau = fetch(req, { cache: 'no-cache' });
  e.waitUntil(reseau.then(async r => {
    if (r.ok && r.type === 'basic') await (await caches.open(VERSION)).put(cle, r.clone());
  }).catch(() => {}));
  e.respondWith((async () => {
    const enCache = async () => { const c = await caches.open(VERSION); return nav ? c.match(cle) : c.match(req, { ignoreSearch: true }); };
    try {
      const r = await Promise.race([reseau, new Promise((_, ko) => setTimeout(() => ko(new Error('délai')), DELAI))]);
      if (r.ok) return r.clone();
      return (await enCache()) || r;
    } catch (err) {
      const hit = await enCache();
      if (hit) return hit;
      return new Response('Hors ligne', { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
    }
  })());
});
