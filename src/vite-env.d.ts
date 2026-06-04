/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Client-side Sentry DSN (publishable). Unset disables Sentry. */
  readonly VITE_SENTRY_DSN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
