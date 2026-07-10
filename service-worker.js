/* SurvivalAI — Service Worker
   Cachea la app la primera vez que se abre con conexión, y después
   la sirve desde caché aunque no haya internet. Si cambiás el HTML,
   subí también un CACHE_NAME nuevo (ej. 'v2') para forzar la
   actualización del caché en los dispositivos de los usuarios. */

const CACHE_NAME = 'survivalai-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cacheamos cada archivo por separado: si alguno no existe con ese
      // nombre exacto (ej. el HTML no se llama "index.html"), no rompe
      // el resto del caché.
      return Promise.all(
        ASSETS_TO_CACHE.map(url =>
          cache.add(url).catch(err => console.warn('No se pudo cachear', url, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Solo interceptamos pedidos GET propios del sitio.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request)
        .then(response => {
          // Si trajo algo válido, actualizamos el caché para la próxima.
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached); // sin internet: devolvemos lo cacheado

      // Si hay algo cacheado, lo mostramos al toque y actualizamos en segundo plano.
      // Si no hay nada cacheado, esperamos la red.
      return cached || networkFetch;
    })
  );
});
