import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

// Social crawlers need absolute og:image URLs. Uses VITE_SITE_URL if set, else Vercel's production
// domain (a system env var available at build time), else leaves paths relative (fine for local dev).
function siteUrl(): Plugin {
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL
  const url = (process.env.VITE_SITE_URL || (vercel ? `https://${vercel}` : '')).replace(/\/$/, '')
  return { name: 'site-url', transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', url) }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), siteUrl()],
  // mirrors the TMDB rewrites in vercel.json
  server: {
    proxy: {
      '/tmdb/api': { target: 'https://api.themoviedb.org', changeOrigin: true, rewrite: (p) => p.replace(/^\/tmdb\/api/, '') },
      '/tmdb/img': { target: 'https://image.tmdb.org', changeOrigin: true, rewrite: (p) => p.replace(/^\/tmdb\/img/, '') },
    },
  },
})
