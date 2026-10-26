# Shelfie

Make a grid of your favourite **albums & EPs**, **music artists**, **movies** and **games**. Inspired by my9albums.com, but you can customise everything: grid size (1–12 × 1–12), cell size, gap, padding, corner radius, borders, cell shape, fonts, colours and themes, and how titles are shown (a list beside the grid, a caption under each cell, an overlay, or hidden).

- **Search**
  - Albums, EPs and singles come from iTunes and MusicBrainz, with filter chips to narrow the results.
  - Artists come from Deezer.
  - Movies come from TMDB.
  - Games come from RAWG.
- **Can't find it?** Use "Add your own" to upload an image (drag and drop works) or paste an image URL, then type the title.
- **Drag to rearrange** cells, and **download a PNG** of the grid.
- **Save and share** gives each saved grid a public link at `/g/<slug>`. This needs Supabase.
- If you haven't connected Supabase, the app runs in *offline mode*: your drafts are kept in localStorage and PNG export still works.

## Run it

```bash
npm install
cp .env.example .env.local   # then fill in keys (see below)
npm run dev                  # http://localhost:5173
```

Restart `npm run dev` each time you edit `.env.local`.

## Credentials

| Variable | Needed for | Required? |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Accounts, saving, share links, uploading images to storage | Only for save and share |
| `VITE_TMDB_KEY` | Movie search | Only for movie search |
| `VITE_RAWG_API_KEY` | Game search | Only for game search |

Album, EP and artist search need no keys. When a key is missing, that category still works through "Add your own".

> These are browser-side keys and anyone using the site can see them. That is expected for the Supabase anon key, which Row Level Security protects. The TMDB and RAWG free keys are also designed to be used this way. Never put a Supabase **service_role** key here.

### 1. Supabase

1. Go to https://supabase.com and sign up (free tier). Click **New project**, then choose a name, a database password and a region.
2. When the project is ready, open **Project Settings → API** (also labelled *Data API* / *API Keys*):
   - Copy **Project URL** into `VITE_SUPABASE_URL`.
   - Copy the **anon / public** key into `VITE_SUPABASE_ANON_KEY`. If your project shows the newer *publishable* key (`sb_publishable_...`), that works too.
3. Open **SQL Editor → New query**. Paste in all of `supabase/migrations/0001_init.sql` and click **Run**. This creates:
   - the `grids` table and its RLS policies
   - the public `covers` storage bucket and its upload policies
4. Open **Authentication → Sign In / Providers**:
   - Leave **Email** enabled. This turns on magic-link sign-in.
   - Turn on **Allow anonymous sign-ins**. This is what the "Continue as guest" button uses.
5. Open **Authentication → URL Configuration**:
   - Set **Site URL** to `http://localhost:5173`. Use your real domain once you deploy.
   - Add `http://localhost:5173/**` to **Redirect URLs**.
6. Optional: Supabase's built-in email sender is rate-limited to a few emails per hour. For real use, add your own SMTP server under **Authentication → Emails → SMTP Settings**. Resend, Postmark and others offer free tiers.

### 2. TMDB (movies)

1. Sign up at https://www.themoviedb.org/signup and verify your email.
2. Go to https://www.themoviedb.org/settings/api and request an API key. Pick the **Developer** type and accept the terms. The form asks for an app name, a URL (`http://localhost` is fine) and a short description.
3. Copy either the **API Key** (v3, short) or the **API Read Access Token** (v4, a long string starting with `eyJ`) into `VITE_TMDB_KEY`. The app accepts both.

### 3. RAWG (games)

1. Sign up at https://rawg.io/signup.
2. Go to https://rawg.io/apidocs and click **Get API Key**. Fill in the short form; any app name and URL are fine.
3. Copy the key from https://rawg.io/@your-username/apikey into `VITE_RAWG_API_KEY`.
4. The free tier allows 20,000 requests per month. RAWG's terms ask you to credit them with a link back to RAWG on pages that use its data.

## Deploying

This is a static Vite app. Run `npm run build` and serve `dist/`.

- On Vercel or Netlify, add the same `VITE_*` variables in the dashboard.
- Configure a SPA fallback so routes like `/g/:slug` serve `index.html`.
- In Supabase, update **Site URL** and **Redirect URLs** to your production domain.

## Project layout

```
src/lib/search.ts       search providers (iTunes, MusicBrainz, Deezer JSONP, TMDB, RAWG)
src/lib/grids.ts        local drafts, Supabase CRUD, cover uploads
src/components/         GridCanvas (render + drag/swap), SearchModal, SettingsPanel, AuthDialog
src/pages/              Home, Editor, View (/g/:slug), MyGrids (/me)
supabase/migrations/    SQL schema + RLS + storage bucket
```
