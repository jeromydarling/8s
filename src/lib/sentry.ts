import * as Sentry from "@sentry/react";

/**
 * Federation-standard Sentry bootstrap for the 8 Seconds client.
 *
 * Every federation app initializes Sentry the same way so events are
 * comparable across the fleet: each one is tagged with its `app_slug` and the
 * current `federation_phase`. Replay is privacy-first — we mask all text and
 * inputs and block all media so no member PII leaks into session recordings.
 *
 * No-ops gracefully when VITE_SENTRY_DSN is unset (local dev, preview builds),
 * so a missing DSN never breaks the app.
 */
export function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.05,
    replaysOnErrorSampleRate: 1.0,
    // Privacy-first: never attach cookies, headers, or user IP by default.
    sendDefaultPii: false,
    initialScope: {
      tags: {
        app_slug: "8seconds",
        federation_phase: "pre-launch",
      },
    },
  });
}
