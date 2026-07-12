/* SurvivalAI — Service Worker
   Cachea la app la primera vez que se abre con conexión, y después
   la sirve desde caché aunque no haya internet. Si cambiás el HTML,
   subí también un CACHE_NAME nuevo (ej. 'v2') para forzar la
   actualización del caché en los dispositivos de los usuarios.

   MAP_TILE_CACHE_PREFIX: caché aparte para los mosaicos de mapa que el
   usuario descarga a propósito desde el módulo GPS ("Descargar esta
   zona para uso offline"). No se borra cuando se actualiza CACHE_NAME,
   porque esos mosaicos los pidió el usuario explícitamente y pueden
   pesar bastante — no tiene sentido perderlos solo por subir una nueva
   versión del HTML. Se borran solo si el usuario toca "Borrar mapas
   descargados" en la app, o si el propio navegador libera espacio. */

const CACHE_NAME = 'survivalai-v6';
const MAP_TILE_CACHE_PREFIX = 'survivalai-maptiles';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon.ico',
  './favicon-16x16.png',
  './favicon-32x32.png'
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
        // Nunca borramos la caché de mosaicos de mapa acá: solo limpiamos
        // versiones viejas de la caché de la app en sí (CACHE_NAME).
        if (key.startsWith(MAP_TILE_CACHE_PREFIX)) return;
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
