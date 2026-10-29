# Shelfie

A my9albums.com-style "favourites grid" maker. It has four categories: albums & EPs, music artists, movies and games. The stack is React 19, Vite and TypeScript, with Supabase for auth, the database and storage. The README has user-facing setup and credential steps.

## Goal (from the user)
- Very customisable grids, including a user-adjustable grid size.
- Sections for albums, games, movies and music artists. Music must support EPs.
- If an item isn't found by search, users can add their own image and title.
- Prompt the user whenever credentials are needed, with detailed steps for getting them and adding them.

## Commands
- `npm run dev` serves the app at http://localhost:5173.
- `npm run build` runs `tsc -b` and then `vite build`.
- `npm run lint` runs oxlint. Expect 3 known warnings:
  - two dnd-kit `setNodeRef` ref false positives in GridCanvas
  - one setState-in-effect in SearchModal

## Defaults
- Item names default to `titleMode: 'below'` (a caption under each cell). The user prefers this to the side list.
- N×N grids (rows === cols) always produce a square canvas and PNG. `GridCanvas` measures `.canvas-inner` with a ResizeObserver and sizes the canvas to a square around it, centring the content and keeping gaps even. The user chose this over stretching the gaps or squashing the cells.
- `below` captions have a fixed height: titles are clamped to 2 lines and subtitles to 1, so all rows are the same height.

## Layout
- `src/lib/search.ts` holds the search providers:
  - Albums: iTunes first, then MusicBrainz release-groups as a fallback, with covers from the Cover Art Archive. EP/single type comes from iTunes' " - EP" / " - Single" name suffix or MusicBrainz's primary type.
  - Artists: Deezer, called via JSONP because Deezer sends no CORS headers.
  - Movies: TMDB. A key starting with `eyJ` is sent as a Bearer token; anything else is used as a v3 `api_key`.
    - Requests go through same-origin paths `/tmdb/api/*` and `/tmdb/img/*`, which are rewritten in `vercel.json` and proxied in `vite.config.ts`. This is because Jio (the user's ISP) blocks themoviedb.org at DNS level. It also keeps posters same-origin, so they export cleanly.
  - Games: RAWG.
- `src/lib/grids.ts`:
  - localStorage drafts (`shelfie:draft:<category|id>`)
  - Supabase CRUD on the `grids` table
  - `uploadCover`, which uploads to the `covers` bucket when signed in, or falls back to a downscaled data URL
  - `resizeItems`
- `src/components/GridCanvas.tsx` renders the grid and is also the node exported to PNG. Drag-and-drop swaps cells (dnd-kit draggable/droppable). Config values are passed in as CSS variables.
- `src/components/SettingsPanel.tsx` holds all customisation controls, which edit `GridConfig` in `src/lib/types.ts`.
- `src/components/SearchModal.tsx` has two tabs: Search and "Add your own" (custom item with upload, drag-drop or image URL).
- `src/pages/` holds the pages. Routes:
  - Home: `/`
  - Editor: `/create/:category` and `/edit/:id`. `EditorRoute` remounts the editor on each route change.
  - View: `/g/:slug`
  - MyGrids: `/me`
- `supabase/migrations/0001_init.sql` creates:
  - the `grids` table (jsonb `config` and `items`, RLS: public-or-owner read, owner write)
  - the public `covers` bucket (owner writes go to `<uid>/...`)

## Conventions
- The app must work without any keys. Missing keys degrade to a notice plus manual add. With no Supabase keys the app shows "Offline mode" and keeps local drafts.
- `items` is a sparse array in row-major order, where `null` marks an empty slot. It may be longer than rows×cols while editing and is trimmed on save.
- Editor-only elements (`.plus`, `.cell-remove`) are filtered out of the PNG export in `src/lib/exportImage.ts`.
- Images load with `crossOrigin="anonymous"` so they can be exported. `Cover` retries without CORS (shown on screen, but blank in the export) and finally falls back to a title tile.
- Env vars live in `.env` (the user's choice; `.env` and `.env.*` are gitignored). `.env.example` lists them.
- Deploy: Vercel, imported from GitHub (`Dipstick713/shelfie`), so a push to main redeploys. Env vars are set in the Vercel project settings.

## Status (2026-10-25)
- Verified with a headless Chrome Playwright script:
  - album search and the EP filter
  - adding items, including custom items with image upload
  - grid resize and PNG export
  - artist search
  - the movie no-key notice
- **Waiting on the user for credentials:**
  - Supabase URL and anon key, plus running the SQL migration and enabling anonymous sign-ins
  - TMDB key
  - RAWG key
- Not yet tested, because they need Supabase:
  - save and share
  - `/g/:slug`
  - `/me`
  - magic-link and guest auth
  - storage uploads

  Test all of these once the keys are in `.env.local`.
- Known limits:
  - Some Cover Art Archive mirrors (archive.org) lack CORS, so those covers are blank in exported PNGs.
  - RAWG images are landscape screenshots, which are cropped to fit cells.
