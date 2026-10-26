import type { Category, GridItem, MusicReleaseType } from './types'
import { env } from './env'

export type MusicFilter = 'all' | 'album' | 'ep' | 'single'

export interface SearchOptions {
  musicFilter?: MusicFilter
  signal?: AbortSignal
}

export interface SearchResult {
  items: GridItem[]
  /** set when a provider can't run (e.g. missing API key) */
  notice?: string
}

const uid = (prefix: string, id: string | number) => `${prefix}:${id}`

/* ---------- JSONP (Deezer has no CORS headers but supports JSONP) ---------- */
let jsonpCounter = 0
function jsonp<T>(url: string, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const cb = `__shelfie_jsonp_${Date.now()}_${jsonpCounter++}`
    const script = document.createElement('script')
    const w = window as unknown as Record<string, unknown>
    const cleanup = () => {
      delete w[cb]
      script.remove()
      clearTimeout(timer)
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error('JSONP timeout'))
    }, timeoutMs)
    w[cb] = (data: T) => {
      cleanup()
      resolve(data)
    }
    script.onerror = () => {
      cleanup()
      reject(new Error('JSONP failed'))
    }
    script.src = `${url}${url.includes('?') ? '&' : '?'}output=jsonp&callback=${cb}`
    document.body.appendChild(script)
  })
}

/* ---------- Music: albums / EPs / singles ---------- */
function releaseTypeFromName(name: string): { type: MusicReleaseType; clean: string } {
  if (/ - EP$/i.test(name)) return { type: 'ep', clean: name.replace(/ - EP$/i, '') }
  if (/ - Single$/i.test(name)) return { type: 'single', clean: name.replace(/ - Single$/i, '') }
  return { type: 'album', clean: name }
}

interface ITunesAlbum {
  collectionId: number
  collectionName: string
  artistName: string
  artworkUrl100?: string
  releaseDate?: string
}

async function searchITunesAlbums(q: string, signal?: AbortSignal): Promise<GridItem[]> {
  const res = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=album&limit=40`,
    { signal },
  )
  if (!res.ok) throw new Error('iTunes search failed')
  const data: { results: ITunesAlbum[] } = await res.json()
  return data.results.map((r) => {
    const { type, clean } = releaseTypeFromName(r.collectionName)
    return {
      id: uid('itunes', r.collectionId),
      title: clean,
      subtitle: r.artistName,
      image: r.artworkUrl100?.replace(/\/\d+x\d+bb\./, '/600x600bb.'),
      year: r.releaseDate?.slice(0, 4),
      releaseType: type,
      source: 'itunes' as const,
    }
  })
}

interface MBReleaseGroup {
  id: string
  title: string
  'primary-type'?: string
  'first-release-date'?: string
  'artist-credit'?: { name: string; joinphrase?: string }[]
}

async function searchMusicBrainz(q: string, filter: MusicFilter, signal?: AbortSignal): Promise<GridItem[]> {
  const escaped = q.replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, '\\$1')
  let query = `(releasegroup:(${escaped}) OR artist:(${escaped}))`
  if (filter !== 'all') query += ` AND primarytype:${filter}`
  else query += ' AND (primarytype:album OR primarytype:ep OR primarytype:single)'
  const res = await fetch(
    `https://musicbrainz.org/ws/2/release-group?query=${encodeURIComponent(query)}&fmt=json&limit=25`,
    { signal, headers: { Accept: 'application/json' } },
  )
  if (!res.ok) throw new Error('MusicBrainz search failed')
  const data: { 'release-groups': MBReleaseGroup[] } = await res.json()
  return data['release-groups'].map((rg) => {
    const pt = rg['primary-type']?.toLowerCase()
    return {
      id: uid('mb', rg.id),
      title: rg.title,
      subtitle: rg['artist-credit']?.map((a) => a.name + (a.joinphrase ?? '')).join(''),
      image: `https://coverartarchive.org/release-group/${rg.id}/front-500`,
      year: rg['first-release-date']?.slice(0, 4),
      releaseType: pt === 'album' || pt === 'ep' || pt === 'single' ? pt : 'other',
      source: 'musicbrainz' as const,
    }
  })
}

const normKey = (i: GridItem) => `${i.title}|${i.subtitle}`.toLowerCase().replace(/[^a-z0-9|]/g, '')

async function searchAlbums(q: string, { musicFilter = 'all', signal }: SearchOptions): Promise<SearchResult> {
  const [itunes, mb] = await Promise.allSettled([
    searchITunesAlbums(q, signal),
    searchMusicBrainz(q, musicFilter, signal),
  ])
  const primary = itunes.status === 'fulfilled' ? itunes.value : []
  const secondary = mb.status === 'fulfilled' ? mb.value : []
  const filtered = primary.filter((i) => musicFilter === 'all' || i.releaseType === musicFilter)
  // MusicBrainz fills gaps (obscure EPs, releases missing from Apple Music)
  const seen = new Set(filtered.map(normKey))
  const extra = secondary.filter((i) => !seen.has(normKey(i)))
  return { items: [...filtered, ...extra] }
}

/* ---------- Music: artists (Deezer) ---------- */
interface DeezerArtist {
  id: number
  name: string
  picture_xl?: string
  picture_big?: string
  nb_fan?: number
}

async function searchArtists(q: string): Promise<SearchResult> {
  const data = await jsonp<{ data?: DeezerArtist[] }>(
    `https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=30`,
  )
  return {
    items: (data.data ?? []).map((a) => ({
      id: uid('deezer', a.id),
      title: a.name,
      subtitle: a.nb_fan ? `${a.nb_fan.toLocaleString()} fans` : undefined,
      image: a.picture_xl || a.picture_big,
      source: 'deezer' as const,
    })),
  }
}

/* ---------- Movies (TMDB) ---------- */
interface TmdbMovie {
  id: number
  title: string
  release_date?: string
  poster_path?: string | null
  original_title?: string
}

async function searchMovies(q: string, { signal }: SearchOptions): Promise<SearchResult> {
  const key = env.tmdbKey
  if (!key) {
    return { items: [], notice: 'Movie search needs a TMDB key (VITE_TMDB_KEY). You can still add movies manually.' }
  }
  // v4 "API Read Access Token" is a JWT (starts with eyJ) → Bearer auth; otherwise treat as v3 api_key
  const isBearer = key.startsWith('eyJ')
  const url = new URL('https://api.themoviedb.org/3/search/movie')
  url.searchParams.set('query', q)
  url.searchParams.set('include_adult', 'false')
  if (!isBearer) url.searchParams.set('api_key', key)
  const res = await fetch(url, { signal, headers: isBearer ? { Authorization: `Bearer ${key}` } : {} })
  if (!res.ok) throw new Error(res.status === 401 ? 'TMDB rejected the key — check VITE_TMDB_KEY' : 'TMDB search failed')
  const data: { results: TmdbMovie[] } = await res.json()
  return {
    items: data.results.map((m) => ({
      id: uid('tmdb', m.id),
      title: m.title,
      subtitle: m.release_date?.slice(0, 4),
      year: m.release_date?.slice(0, 4),
      image: m.poster_path ? `https://image.tmdb.org/t/p/w500${m.poster_path}` : undefined,
      source: 'tmdb' as const,
    })),
  }
}

/* ---------- Games (RAWG) ---------- */
interface RawgGame {
  id: number
  name: string
  released?: string | null
  background_image?: string | null
  platforms?: { platform: { name: string } }[] | null
}

async function searchGames(q: string, { signal }: SearchOptions): Promise<SearchResult> {
  const key = env.rawgKey
  if (!key) {
    return { items: [], notice: 'Game search needs a RAWG key (VITE_RAWG_API_KEY). You can still add games manually.' }
  }
  const res = await fetch(
    `https://api.rawg.io/api/games?key=${encodeURIComponent(key)}&search=${encodeURIComponent(q)}&page_size=30&search_precise=true`,
    { signal },
  )
  if (!res.ok) throw new Error(res.status === 401 ? 'RAWG rejected the key — check VITE_RAWG_API_KEY' : 'RAWG search failed')
  const data: { results: RawgGame[] } = await res.json()
  return {
    items: data.results.map((g) => ({
      id: uid('rawg', g.id),
      title: g.name,
      subtitle: g.released?.slice(0, 4),
      year: g.released?.slice(0, 4),
      // RAWG's crop endpoint gives a lighter image
      image: g.background_image?.replace('/media/games/', '/media/resize/640/-/games/') ?? undefined,
      source: 'rawg' as const,
    })),
  }
}

export function search(category: Category, q: string, opts: SearchOptions = {}): Promise<SearchResult> {
  switch (category) {
    case 'albums':
      return searchAlbums(q, opts)
    case 'artists':
      return searchArtists(q)
    case 'movies':
      return searchMovies(q, opts)
    case 'games':
      return searchGames(q, opts)
  }
}
