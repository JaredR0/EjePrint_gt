// Service worker: guarda la app en el teléfono para que abra sin internet.
// Cada vez que cambies cualquier archivo de la app, subí el número de VERSION.
// Así los teléfonos detectan que hay versión nueva y ofrecen actualizar.

const VERSION = 'ejeprint-taller-1.1.0';
const ARCHIVOS = [
  './', './index.html', './privacidad.html', './manifest.webmanifest',
  './css/app.css',
  './js/app.js', './js/store.js', './js/calc.js', './js/ui.js', './js/defaults.js',
  './js/views/cotizar.js', './js/views/panel.js', './js/views/filamento.js',
  './js/views/registro.js', './js/views/ajustes.js', './js/views/bienvenida.js',
  './fonts/archivo.woff2', './fonts/plex-400.woff2', './fonts/plex-500.woff2', './fonts/plex-600.woff2',
  './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png', './icons/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith('ejeprint-taller-') && k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', e => { if (e.data === 'activar') self.skipWaiting(); });

// Primero el caché (rápido y sin internet); si no está, la red.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    caches.match(req, { ignoreSearch: true }).then(hit => hit || fetch(req).then(res => {
      if (res.ok && res.type === 'basic') {
        const copia = res.clone();
        caches.open(VERSION).then(c => c.put(req, copia));
      }
      return res;
    }).catch(() => (req.mode === 'navigate' ? caches.match('./index.html') : Response.error())))
  );
});
