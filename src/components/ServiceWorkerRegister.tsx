'use client';

import { useEffect } from 'react';

/**
 * ServiceWorkerRegister:
 * - In DEVELOPMENT or on LOCALHOST / 127.0.0.1:
 *   Strictly DOES NOT register any service worker. Actively unregisters any stale
 *   service workers and clears caches to ensure zero interference with Next.js Turbopack HMR.
 * - In PRODUCTION on real domain:
 *   Registers /sw.js after full page load for PWA offline shell.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    const isLocalhost =
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1' ||
      window.location.hostname.endsWith('.local');

    const isDev = process.env.NODE_ENV !== 'production' || isLocalhost;

    if (isDev) {
      // Unregister any active service workers on localhost to prevent infinite reload loops
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister().catch(() => {});
        }
      });
      if ('caches' in window) {
        caches.keys().then((names) => {
          for (const name of names) {
            caches.delete(name).catch(() => {});
          }
        });
      }
      return;
    }

    // Production mode only
    const registerSW = () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[PWA] Service Worker registered:', registration.scope);
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration note:', err?.message || err);
        });
    };

    if (document.readyState === 'complete') {
      registerSW();
    } else {
      window.addEventListener('load', registerSW);
      return () => window.removeEventListener('load', registerSW);
    }
  }, []);

  return null;
}
