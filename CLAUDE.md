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
  - Games: RAWG. It runs a precise search and a fuzzy search in parallel.
- Search ranking (`src/lib/fuzzy.ts`, `search.ts`):
  - Every provider's results are re-ranked client-side by a fuzzy score: normalised tokens and OSA edit distance, so "radiohed in rainbos" and "to pimp a buterfly" work. It also handles "artist title" queries, ignores leading "the", and strips edition suffixes like "(Deluxe Edition)" or "[Remastered]".
  - Ties are broken by popularity: iTunes position in the general search, MusicBrainz `count` (number of releases), Deezer fans, TMDB vote count and RAWG `added`.
  - Albums use four sources:
    - iTunes general album search.
    - iTunes song search grouped by album (`songHits`). A song only counts if it matched via its album or artist, not its own title. For 1–2 character queries this source is replaced by `attribute=albumTerm`.
    - MusicBrainz.
    - The iTunes artist discography (`lookup?id=…&entity=album`), fetched when the query names an artist found in the results (`artistNamedInQuery`). That artist's releases get +0.15.

    This exists because Apple's album search never returns some major albums (underscores' "U", "Wallsocket"). iTunes allows about 20 requests a minute, so it's 2 searches per query plus a cached lookup.
  - Albums come in two passes: `onPartial` shows the fast sources after a 1.5s grace period, then a final re-rank arrives once MusicBrainz answers. MusicBrainz release `count` is the strongest fame signal (Pink Floyd's DSOTM has 152).
  - Known limit: a bare single letter ("U") can't single out a popular album, because no source gives a usable fame signal. "u underscores" or "underscores" works.
  - The MusicBrainz query The MusicBrainz query combines an exact phrase^5, fuzzy title tokens and per-token title-OR-artist matching (only for multi-word queries, to avoid "blonde" matching Blondie).
  - Duplicates are collapsed with `dedupeKey`, and knock-offs (karaoke, tribute, string quartet…) are penalised.
  - 1-character queries are allowed. For queries of 1–2 characters only exact titles score high, and an exact match as typed gets a small bonus ("A" ranks above "À«Ǡ").
  - Robustness:
    - `fetchJson` has an 8s timeout, with one retry on 429/5xx or network errors but not on timeouts.
    - `settleWithGrace` waits for the main source, then gives the others 1.5s; for albums the stragglers still feed the final pass.
    - Results are cached in memory for 10 minutes. Album source lists are cached per query across filters, so the Albums/EPs/Singles chips filter locally (this also avoids MusicBrainz 503s).
  - Test with real queries in headless Chrome by importing `/src/lib/search.ts` in the page. MusicBrainz rate-limits at about 1 req/s, so pause between queries.
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

## UI design (rebuilt 2026-10-29)
- The look mixes the user's portfolio (github.com/Dipstick713/Portfolio, a dark `#161616` bento layout with Satoshi and JetBrains Mono) with a "lab blueprint" reference: grid lines, orange square `.mark`s, `.brackets` corners and chamfered `.btn.primary`. Keep it whimsical and modern.
- Themes: light "lab paper" and dark. Tokens are `--app-*` in `src/index.css`. The theme follows `prefers-color-scheme` unless `data-theme` is set on `<html>`, which the header toggle does, storing it in localStorage `shelfie:theme`. An inline script in `index.html` applies it before paint.
- Fonts: Satoshi (body, from Fontshare), JetBrains Mono (`.mono`, buttons, labels) and Tektur (display and wordmark). Fontshare fonts must not be offered as canvas fonts, because PNG export needs CORS-loaded Google fonts.
- Each category has an `accent` in `categories.ts`, exposed as the CSS var `--cat` (UI only, never in exports).
- Mascot: `ShelfBot.tsx`. Its eyes track the pointer through a ref (no re-renders). It blinks and bobs, and the home page pokes it to hop and look happy. Mood lines live in `src/lib/moods.ts`. `Doodles.tsx` holds the animated category icons (`.doodle-host:hover`), `ShuffleTile` and `Marquee`.
- The `.canvas` CSS section is export-critical. Restyle around it, not inside it.
- Mobile:
  - Drag uses `MouseSensor` plus `TouchSensor` with a 220ms long-press, and cells use `touch-action: manipulation` so swiping scrolls.
  - On coarse pointers, PNG export goes through the Web Share sheet and falls back to a download.
  - Settings sections start collapsed at ≤820px, except Grid size.
  - Modals become full-screen sheets at ≤600px, and inputs are 16px to stop iOS zooming in.
  - `/g/:slug` zooms the canvas to fit the screen.
  - Verified with a Pixel 7 emulation using CDP touch events.
- Social preview: `public/og.png` (1200×630). It's referenced from `index.html` as `__SITE_URL__/og.png`, and the `siteUrl` plugin in `vite.config.ts` fills that in from `VITE_SITE_URL` or Vercel's `VERCEL_PROJECT_PRODUCTION_URL`. Regenerate the PNG if the brand changes.
- `/me` swallows load errors into the empty state ("No grids to display yet") and logs them to the console.

## Conventions
- The app must work without any keys. Missing keys degrade to a notice plus manual add. With no Supabase keys the app shows "Offline mode" and keeps local drafts.
- `items` is a sparse array in row-major order, where `null` marks an empty slot. It may be longer than rows×cols while editing and is trimmed on save.
- Editor-only elements (`.plus`, `.cell-remove`) are filtered out of the PNG export in `src/lib/exportImage.ts`.
- Images load with `crossOrigin="anonymous"` so they can be exported. `Cover` retries without CORS (shown on screen, but blank in the export) and finally falls back to a title tile.
- Env vars live in `.env` (the user's choice; `.env` and `.env.*` are gitignored). `.env.example` lists them.
- Deploy: Vercel, imported from GitHub (`Dipstick713/shelfie`), so a push to main redeploys. Env vars are set in the Vercel project settings.

## Status (2026-10-29)
- Verified with a headless Chrome Playwright script:
  - album search and the EP filter
  - adding items, including custom items with image upload
  - grid resize and PNG export
  - artist search
  - the movie no-key notice
  - mobile touch drag
- Supabase project `fruadgxvjsseibueuhfa` is fully set up: the table, the `covers` bucket, and anonymous plus email sign-in.
- End-to-end test passed (2026-10-29) in headless Chrome as a throwaway guest:
  - guest sign-in
  - cover upload to storage
  - auto-advance to the next slot
  - search add
  - save & share, then the URL switching to `/edit/:id`
  - update save
  - share page, including the owner's Edit button
  - My grids, then delete, then the share link reporting gone
  - cleanup of the test cover
- The first save navigates to `/edit/:id`, which remounts the editor. The share URL is passed along in history state (`location.state.shareUrl`); before that fix, the dialog was lost and saves looked like they failed.
- Don't run write probes against the user's real rows. Test as a fresh guest user and clean up after.
- Known limits:
  - Some Cover Art Archive mirrors (archive.org) lack CORS, so those covers are blank in exported PNGs.
  - RAWG images are landscape screenshots, which are centre-cropped to fit cells. Games default to square (1:1) cells, which the user prefers.
