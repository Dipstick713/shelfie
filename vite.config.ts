import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // mirrors the TMDB rewrites in vercel.json
  server: {
    proxy: {
      '/tmdb/api': { target: 'https://api.themoviedb.org', changeOrigin: true, rewrite: (p) => p.replace(/^\/tmdb\/api/, '') },
      '/tmdb/img': { target: 'https://image.tmdb.org', changeOrigin: true, rewrite: (p) => p.replace(/^\/tmdb\/img/, '') },
    },
  },
})
