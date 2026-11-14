/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Public address of the site, set at build time in vite.config.ts; empty when unknown. */
  readonly VITE_SITE_URL: string
}
