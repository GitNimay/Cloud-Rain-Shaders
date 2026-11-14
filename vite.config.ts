import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Where exported links and imports point. On Vercel this is the production domain, set on
// every build, previews included, so a link copied from a preview deployment (private by
// default, and replaced on the next push) keeps working. Elsewhere it is empty and the app
// uses whatever address it is running on. Set SITE_URL to override.
const productionHost = process.env.VERCEL_PROJECT_PRODUCTION_URL
const site = (process.env.SITE_URL ?? (productionHost ? `https://${productionHost}` : '')).replace(/\/$/, '')

export default defineConfig({
  // The router plugin must come before the React plugin.
  plugins: [
    tanstackRouter({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    // Social previews need absolute URLs, so index.html writes %SITE_URL% and it is filled in here.
    { name: 'site-url', transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', site) },
  ],
  define: { 'import.meta.env.VITE_SITE_URL': JSON.stringify(site) },
})
