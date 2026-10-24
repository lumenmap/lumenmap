"use client";

import { useEffect } from "react";

/**
 * ServiceWorkerRegister registers the PWA service worker in production builds.
 *
 * Controlled via environment flags:
 * - SW is disabled by default in development (NODE_ENV === "development").
 * - Can be explicitly forced on via NEXT_PUBLIC_ENABLE_SW="true".
 * - Can be explicitly forced off via NEXT_PUBLIC_DISABLE_SW="true".
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    const isExplicitlyDisabled =
      process.env.NEXT_PUBLIC_DISABLE_SW === "true" ||
      process.env.NEXT_PUBLIC_DISABLE_SW === "1";

    const isExplicitlyEnabled =
      process.env.NEXT_PUBLIC_ENABLE_SW === "true" ||
      process.env.NEXT_PUBLIC_ENABLE_SW === "1";

    const isDev = process.env.NODE_ENV === "development";

    // SW disabled when NODE_ENV=development by default, unless explicitly enabled
    if (isExplicitlyDisabled || (isDev && !isExplicitlyEnabled)) {
      // Unregister any existing service workers if running in dev/disabled mode
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        for (const registration of registrations) {
          registration.unregister();
        }
      });
      return;
    }

    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Check for updates
          reg.addEventListener("updatefound", () => {
            const installing = reg.installing;
            if (installing) {
              installing.addEventListener("statechange", () => {
                if (
                  installing.state === "installed" &&
                  navigator.serviceWorker.controller
                ) {
                  // New update available
                }
              });
            }
          });
        })
        .catch((err) => {
          console.error("[SW] Registration failed:", err);
        });
    });
  }, []);

  return null;
}
