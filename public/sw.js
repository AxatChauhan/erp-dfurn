// D'furn ERP Service Worker - Safe Pass-Through Shell
// Target mobile routes: /app/enquiries and /app/quotations
// Does NOT intercept or cache dynamic HTML requests to prevent SSR / HMR issues.

const CACHE_NAME = 'dfurn-app-v3';
const APP_SHELL_ROUTES = [
  '/app/enquiries',
  '/app/quotations',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => self.clients.claim())
  );
});

// Pass-through all fetch requests directly to network to preserve SSR, PPR streaming, and auth cookies
self.addEventListener('fetch', () => {
  return;
});
