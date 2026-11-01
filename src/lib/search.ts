import type { Category, GridItem, MusicReleaseType } from './types'
import { env } from './env'
import { dedupeKey, matchScore, normalize, stringScore, stripEdition } from './fuzzy'

export type MusicFilter = 'all' | 'album' | 'ep' | 'single'

export interface SearchOptions {
  musicFilter?: MusicFilter
  signal?: AbortSignal
  /** early, partial results while slower sources are still answering */
  onPartial?: (result: SearchResult) => void
}

export interface SearchResult {
  items: GridItem[]
  /** set when a provider can't run (e.g. missing API key) */
  notice?: string
}

/** Single characters are allowed: albums like "A", "X", "÷" or "21" are real. */
export const MIN_QUERY_LENGTH = 1

const uid = (prefix: string, id: string | number) => `${prefix}:${id}`

/* ---------- fetch with timeout + one retry on rate limits / flaky networks ---------- */
class HttpError extends Error {
  status: number
  constructor(status: number) {
    super(`HTTP ${status}`)
    this.status = status
  }
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => (clearTimeout(t), reject(signal.reason)), { once: true })
  })

async function fetchJson<T>(
  url: string | URL,
  { signal, headers, timeoutMs = 8000, retries = 1 }: { signal?: AbortSignal; headers?: HeadersInit; timeoutMs?: number; retries?: number } = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const ctrl = new AbortController()
    let timedOut = false
    const timer = setTimeout(() => ((timedOut = true), ctrl.abort()), timeoutMs)
    const onAbort = () => ctrl.abort()
    signal?.addEventListener('abort', onAbort, { once: true })
    try {
      const res = await fetch(url, { signal: ctrl.signal, headers })
      if (!res.ok) throw new HttpError(res.status)
      return (await res.json()) as T
    } catch (err) {
      let e = err
      if (signal?.aborted) throw e
      if (timedOut) e = new Error('The search timed out')
      const retryable = !timedOut && (!(e instanceof HttpError) || e.status === 429 || e.status >= 500)
      if (attempt >= retries || !retryable) throw e
      await sleep(700 * (attempt + 1), signal)
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', onAbort)
    }
  }
}

/**
 * Like Promise.allSettled, but once the main source (index 0) has settled, the others get only
 * `graceMs` more before we go with what we have — one sluggish API shouldn't hold up the results.
 */
function settleWithGrace<T>(promises: Promise<T>[], graceMs = 1500): Promise<PromiseSettledResult<T>[]> {
  const results: (PromiseSettledResult<T> | undefined)[] = promises.map(() => undefined)
  return new Promise((resolve) => {
    let pending = promises.length
    let graceTimer: ReturnType<typeof setTimeout> | undefined
    const finish = () => {
      clearTimeout(graceTimer)
      resolve(results.map((r) => r ?? { status: 'rejected', reason: new Error('too slow') }))
    }
    promises.forEach((p, i) =>
      p.then(
        (value) => (results[i] = { status: 'fulfilled', value }),
        (reason) => (results[i] = { status: 'rejected', reason }),
      ).finally(() => {
        if (--pending === 0) finish()
        else if (i === 0) graceTimer = setTimeout(finish, graceMs)
      }),
    )
  })
}

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

const CACHE_TTL = 10 * 60 * 1000

/* ---------- ranking ---------- */
interface Scored {
  item: GridItem
  score: number
  order: number
}

/** Best first; drops weak matches when there are enough strong ones. */
function rank(scored: Scored[], limit = 48): GridItem[] {
  const sorted = [...scored].sort((a, b) => b.score - a.score || a.order - b.order)
  const strong = sorted.filter((s) => s.score >= 0.4)
  const kept = strong.length >= 6 ? strong : sorted.filter((s) => s.score >= 0.15)
  return (kept.length ? kept : sorted).slice(0, limit).map((s) => s.item)
}

/** Fuzzy title/creator score, with a fallback for symbol-only queries like "÷" or "+". */
function score(query: string, title: string, creator?: string): number {
  if (!normalize(query)) {
    const q = query.trim().toLowerCase()
    const t = stripEdition(title).trim().toLowerCase()
    return t === q ? 1 : t.includes(q) ? 0.55 : 0.1
  }
  // exact as typed beats "equal after stripping accents/symbols" ("A" over "À«Ǡ" or "A+")
  const literal = stripEdition(title).trim().toLowerCase() === query.trim().toLowerCase() ? 0.06 : 0
  return matchScore(query, title, creator) + literal
}

const popularity = (n: number | undefined, weight: number) => (n && n > 0 ? Math.log10(n + 1) * weight : 0)

/** "alien 1979" / "alien (1979)" → { text: "alien", year: "1979" } */
function splitYear(q: string): { text: string; year?: string } {
  const m = q.trim().match(/^(.*\S)\s+\(?((?:18|19|20)\d{2})\)?$/)
  return m ? { text: m[1], year: m[2] } : { text: q.trim() }
}

/* ---------- Music: albums / EPs / singles ---------- */
function releaseTypeFromName(name: string): { type: MusicReleaseType; clean: string } {
  if (/ - EP$/i.test(name)) return { type: 'ep', clean: name.replace(/ - EP$/i, '') }
  if (/ - Single$/i.test(name)) return { type: 'single', clean: name.replace(/ - Single$/i, '') }
  return { type: 'album', clean: name }
}

interface ITunesCollection {
  collectionId: number
  collectionName: string
  trackName?: string
  artistId?: number
  artistName: string
  artworkUrl100?: string
  releaseDate?: string
  wrapperType?: string
}

/** Apple artist ids, kept beside the items so GridItem stays clean */
const itunesArtistId = new WeakMap<GridItem, number>()
/** how many of the matching songs come from this album — a strong fame signal */
const songHits = new WeakMap<GridItem, number>()

function itunesItem(r: ITunesCollection): GridItem {
  const { type, clean } = releaseTypeFromName(r.collectionName)
  const item: GridItem = {
    id: uid('itunes', r.collectionId),
    title: clean,
    subtitle: r.artistName,
    image: r.artworkUrl100?.replace(/\/\d+x\d+bb\./, '/600x600bb.'),
    year: r.releaseDate?.slice(0, 4),
    releaseType: type,
    source: 'itunes' as const,
  }
  if (r.artistId) itunesArtistId.set(item, r.artistId)
  return item
}

function itunesSearchUrl(q: string, entity: 'album' | 'song', limit: number, attribute?: string): URL {
  const url = new URL('https://itunes.apple.com/search')
  url.searchParams.set('term', q)
  url.searchParams.set('media', 'music')
  url.searchParams.set('entity', entity)
  url.searchParams.set('limit', String(limit))
  if (attribute) url.searchParams.set('attribute', attribute)
  return url
}

async function searchITunesAlbums(q: string, signal?: AbortSignal, titleOnly = false): Promise<GridItem[]> {
  // title-only search finds short titles ("A", "X") that the general search buries under artist matches
  const url = itunesSearchUrl(q, 'album', titleOnly ? 30 : 50, titleOnly ? 'albumTerm' : undefined)
  const data = await fetchJson<{ results: ITunesCollection[] }>(url, { signal })
  return data.results.map(itunesItem)
}

/**
 * Albums reached through popular songs. Apple's album search is weak ("u underscores" never returns
 * the album "U"), but its song search ranks by popularity — so group matching songs by album.
 */
async function searchITunesViaSongs(q: string, signal?: AbortSignal): Promise<GridItem[]> {
  const data = await fetchJson<{ results: ITunesCollection[] }>(itunesSearchUrl(q, 'song', 50), { signal })
  const qNorm = normalize(q)
  const byAlbum = new Map<number, { item: GridItem; hits: number; first: number }>()
  data.results.forEach((r, i) => {
    // a song is evidence for its album only if it matched through the album/artist, not its own title
    // (six remixes of a song called "Dark Side of the Moon" say nothing about that album's fame)
    const viaAlbum = stringScore(qNorm, normalize(r.trackName ?? '')) < 0.8 ? 1 : 0
    const hit = byAlbum.get(r.collectionId)
    if (hit) hit.hits += viaAlbum
    else byAlbum.set(r.collectionId, { item: itunesItem(r), hits: viaAlbum, first: i })
  })
  // albums with several popular matching songs first
  return [...byAlbum.values()]
    .sort((a, b) => b.hits - a.hits || a.first - b.first)
    .map((x) => (songHits.set(x.item, x.hits), x.item))
}

/** An artist's whole discography (albums, EPs, singles) from Apple, cached. */
const discographyCache = new Map<number, GridItem[]>()
async function itunesDiscography(artistId: number, signal?: AbortSignal): Promise<GridItem[]> {
  const hit = discographyCache.get(artistId)
  if (hit) return hit
  const url = `https://itunes.apple.com/lookup?id=${artistId}&entity=album&limit=200`
  const data = await fetchJson<{ results: ITunesCollection[] }>(url, { signal })
  const items = data.results.filter((r) => r.wrapperType === 'collection').map(itunesItem)
  discographyCache.set(artistId, items)
  return items
}

/** If the query names an artist that shows up in the results ("u underscores"), return that artist. */
function artistNamedInQuery(q: string, items: GridItem[]): { id: number; name: string } | undefined {
  const qNorm = normalize(q)
  const counts = new Map<number, { name: string; n: number }>()
  for (const item of items) {
    const id = itunesArtistId.get(item)
    const name = item.subtitle
    if (!id || !name || stringScore(normalize(name), qNorm) < 0.85) continue
    const c = counts.get(id) ?? { name, n: 0 }
    c.n++
    counts.set(id, c)
  }
  const best = [...counts.entries()].sort((a, b) => b[1].n - a[1].n)[0]
  return best && { id: best[0], name: best[1].name }
}

interface MBReleaseGroup {
  id: string
  title: string
  /** number of releases (pressings, editions) — a decent fame signal */
  count?: number
  'primary-type'?: string
  'first-release-date'?: string
  'artist-credit'?: { name: string; joinphrase?: string }[]
}

/** MusicBrainz release counts, kept beside the items so GridItem stays clean */
const mbReleaseCount = new WeakMap<GridItem, number>()

const luceneEscape = (s: string) => s.replace(/([+\-&|!(){}[\]^"~*?:\\/])/g, '\\$1')

/** Exact phrase (boosted) + typo-tolerant tokens, where each word may match the title or the artist. */
function musicBrainzQuery(q: string, filter: MusicFilter): string {
  const tokens = normalize(q).split(' ').filter(Boolean)
  const phrase = `"${luceneEscape(q.trim()).replace(/"/g, '')}"`
  const parts = [`releasegroup:${phrase}^5`]
  if (tokens.length && normalize(q).length > 2) {
    const fz = (t: string) => (t.length >= 4 ? `${luceneEscape(t)}~` : luceneEscape(t))
    parts.push(`releasegroup:(${tokens.map(fz).join(' ')})^2`)
    // "artist + title" queries; skipped for one word, where a fuzzy artist match ("blonde" → Blondie)
    // floods the results with one artist's whole catalogue
    if (tokens.length > 1) parts.push(`(${tokens.map((t) => `(releasegroup:${fz(t)} OR artist:${fz(t)})`).join(' AND ')})`)
    parts.push(`artist:${phrase}`)
  }
  const types = filter === 'all' ? '(primarytype:album OR primarytype:ep OR primarytype:single)' : `primarytype:${filter}`
  return `(${parts.join(' OR ')}) AND ${types}`
}

async function searchMusicBrainz(q: string, filter: MusicFilter, signal?: AbortSignal): Promise<GridItem[]> {
  const url = `https://musicbrainz.org/ws/2/release-group?query=${encodeURIComponent(musicBrainzQuery(q, filter))}&fmt=json&limit=100`
  // MusicBrainz allows ~1 req/s and answers 503 when busy; one retry covers most of those
  const data = await fetchJson<{ 'release-groups': MBReleaseGroup[] }>(url, { signal, headers: { Accept: 'application/json' } })
  return data['release-groups'].map((rg) => {
    const pt = rg['primary-type']?.toLowerCase()
    const item: GridItem = {
      id: uid('mb', rg.id),
      title: rg.title,
      subtitle: rg['artist-credit']?.map((a) => a.name + (a.joinphrase ?? '')).join(''),
      image: `https://coverartarchive.org/release-group/${rg.id}/front-500`,
      year: rg['first-release-date']?.slice(0, 4),
      releaseType: pt === 'album' || pt === 'ep' || pt === 'single' ? pt : 'other',
      source: 'musicbrainz' as const,
    }
    if (rg.count) mbReleaseCount.set(item, rg.count)
    return item
  })
}

interface AlbumSources {
  lists: PromiseSettledResult<GridItem[]>[]
  /** artist named in the query, whose discography was pulled in */
  artist?: string
}
/** Raw source lists per query (all release types), so flipping Albums/EPs/Singles needs no new requests. */
const albumSourceCache = new Map<string, { at: number; sources: AlbumSources }>()

/**
 * Albums come in two passes: Apple answers fast, MusicBrainz (the best fame signal, via release
 * counts) can lag a few seconds. `onPartial` gets a ranking from whatever is in after a short grace
 * period; the returned promise is the final ranking with every source.
 */
async function searchAlbums(q: string, { musicFilter = 'all', signal, onPartial }: SearchOptions): Promise<SearchResult> {
  const key = q.toLowerCase()
  const hit = albumSourceCache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL) return rankAlbums(q, hit.sources, musicFilter)

  // Apple allows ~20 requests/min, so: two searches per query, plus a cached discography lookup
  // only when the query names an artist
  const short = normalize(q).length <= 2
  const general = searchITunesAlbums(q, signal)
  const second = short ? searchITunesAlbums(q, signal, true) : searchITunesViaSongs(q, signal)
  let artist: { id: number; name: string } | undefined
  const discography = Promise.allSettled([general, second]).then((r) => {
    artist = artistNamedInQuery(q, r.flatMap((x) => (x.status === 'fulfilled' ? x.value : [])))
    return artist ? itunesDiscography(artist.id, signal) : []
  })
  const all = [general, second, searchMusicBrainz(q, 'all', signal), discography]

  const early = await settleWithGrace(all)
  const complete = (lists: PromiseSettledResult<GridItem[]>[]) => lists.every((l) => !(l.status === 'rejected' && l.reason?.message === 'too slow'))
  if (!complete(early)) {
    // only surface the partial ranking if it has something to show
    if (early.some((l) => l.status === 'fulfilled' && l.value.length)) onPartial?.(rankAlbums(q, { lists: early, artist: artist?.name }, musicFilter))
  }
  const lists = complete(early) ? early : await Promise.allSettled(all)
  if (signal?.aborted) throw signal.reason
  const sources = { lists, artist: artist?.name }
  // only cache complete answers, so a rate-limited MusicBrainz gets another go next time
  if (lists.every((l) => l.status === 'fulfilled')) {
    albumSourceCache.set(key, { at: Date.now(), sources })
    if (albumSourceCache.size > 60) albumSourceCache.delete(albumSourceCache.keys().next().value!)
  }
  return rankAlbums(q, sources, musicFilter)
}

function rankAlbums(q: string, { lists, artist }: AlbumSources, musicFilter: MusicFilter): SearchResult {
  // each source's own ordering is its popularity signal: Apple's general search puts Adele's "21"
  // first, which breaks ties between same-titled albums. Discographies are chronological, so no weight.
  const POSITION_WEIGHT = [0.12, 0.04, 0.05, 0]
  const artistNorm = artist && normalize(artist)
  if (lists.every((l) => l.status === 'rejected')) {
    throw new Error("Album search isn't responding right now. Try again in a moment, or add it yourself.")
  }

  // merge everything, collapsing deluxe/explicit/remaster duplicates and cross-source repeats
  const merged = new Map<string, Scored & { sources: Set<string> }>()
  let order = 0
  lists.forEach((l, listIdx) => {
    if (l.status !== 'fulfilled') return
    l.value.forEach((item, pos) => {
      if (musicFilter !== 'all' && item.releaseType !== musicFilter) return
      const popularityBoost =
        POSITION_WEIGHT[listIdx] * Math.max(0, 1 - pos / 30) +
        popularity(mbReleaseCount.get(item), 0.08) +
        Math.min(songHits.get(item) ?? 0, 6) * 0.03
      // when browsing "All", a same-named album is usually what people want over a single
      const typeBias = item.releaseType === 'album' ? 0.02 : item.releaseType === 'single' ? -0.04 : 0
      // the user named this artist, so their releases beat same-titled ones by strangers
      const artistBonus = artistNorm && item.subtitle && normalize(item.subtitle) === artistNorm ? 0.15 : 0
      const s = score(q, item.title, item.subtitle) + typeBias + popularityBoost + artistBonus
      const key = dedupeKey(item.title, item.subtitle)
      const source = listIdx === 2 ? 'mb' : 'itunes'
      const prev = merged.get(key)
      if (!prev) {
        merged.set(key, { item, score: s, order: order++, sources: new Set([source]) })
        return
      }
      prev.sources.add(source)
      prev.score = Math.max(prev.score, s)
      const year = [prev.item.year, item.year].filter(Boolean).sort()[0]
      // prefer Apple artwork over Cover Art Archive, and the plain title over "(Deluxe Edition)"
      const better =
        (prev.item.source === 'musicbrainz' && item.source === 'itunes') ||
        (prev.item.source === item.source && item.title.length < prev.item.title.length)
      prev.item = { ...(better ? item : prev.item), year }
    })
  })
  const scored = [...merged.values()].map((m) => ({ ...m, score: m.score + (m.sources.size > 1 ? 0.015 : 0) }))
  return { items: rank(scored) }
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
  let data: { data?: DeezerArtist[] }
  try {
    data = await jsonp<{ data?: DeezerArtist[] }>(`https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=40`)
  } catch {
    // one retry: JSONP has no status codes, so any failure might be transient
    data = await jsonp<{ data?: DeezerArtist[] }>(`https://api.deezer.com/search/artist?q=${encodeURIComponent(q)}&limit=40`)
  }
  const scored = (data.data ?? []).map((a, order) => ({
    item: {
      id: uid('deezer', a.id),
      title: a.name,
      subtitle: a.nb_fan ? `${a.nb_fan.toLocaleString()} fans` : undefined,
      image: a.picture_xl || a.picture_big,
      source: 'deezer' as const,
    },
    // fans break ties between same-named artists
    score: score(q, a.name) + popularity(a.nb_fan, 0.012),
    order,
  }))
  return { items: rank(scored) }
}

/* ---------- Movies (TMDB) ---------- */
interface TmdbMovie {
  id: number
  title: string
  release_date?: string
  poster_path?: string | null
  original_title?: string
  popularity?: number
  vote_count?: number
}

async function tmdbSearch(text: string, key: string, signal?: AbortSignal, year?: string): Promise<TmdbMovie[]> {
  // v4 "API Read Access Token" is a JWT (starts with eyJ) → Bearer auth; otherwise treat as v3 api_key
  const isBearer = key.startsWith('eyJ')
  // TMDB goes through same-origin rewrites (vercel.json / vite.config.ts): some ISPs block
  // themoviedb.org at DNS level, and same-origin posters always export cleanly to PNG.
  const url = new URL('/tmdb/api/3/search/movie', window.location.origin)
  url.searchParams.set('query', text)
  url.searchParams.set('include_adult', 'false')
  if (year) url.searchParams.set('primary_release_year', year)
  if (!isBearer) url.searchParams.set('api_key', key)
  try {
    const data = await fetchJson<{ results: TmdbMovie[] }>(url, { signal, headers: isBearer ? { Authorization: `Bearer ${key}` } : {} })
    return data.results
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) throw new Error('TMDB rejected the key — check VITE_TMDB_KEY')
    throw e
  }
}

async function searchMovies(q: string, { signal }: SearchOptions): Promise<SearchResult> {
  const key = env.tmdbKey
  if (!key) {
    return { items: [], notice: 'Movie search needs a TMDB key (VITE_TMDB_KEY). You can still add movies manually.' }
  }
  const { text, year } = splitYear(q)
  // "alien 1979" searches with a year filter, but also plainly (the year might be part of the title, e.g. "1917")
  const [withYear, plain] = await settleWithGrace([
    year ? tmdbSearch(text, key, signal, year) : Promise.resolve([]),
    tmdbSearch(q, key, signal),
  ])
  if (plain.status === 'rejected' && (withYear.status === 'rejected' || !year)) throw plain.reason
  const seen = new Set<number>()
  const movies = [...(withYear.status === 'fulfilled' ? withYear.value : []), ...(plain.status === 'fulfilled' ? plain.value : [])].filter(
    (m) => !seen.has(m.id) && seen.add(m.id),
  )
  const scored = movies.map((m, order) => {
    const y = m.release_date?.slice(0, 4)
    const s = Math.max(score(year ? text : q, m.title), m.original_title ? score(year ? text : q, m.original_title) : 0, score(q, m.title))
    return {
      item: {
        id: uid('tmdb', m.id),
        title: m.title,
        subtitle: y,
        year: y,
        image: m.poster_path ? `/tmdb/img/t/p/w500${m.poster_path}` : undefined,
        source: 'tmdb' as const,
      },
      score: s + (year && y === year ? 0.1 : 0) + popularity(m.vote_count, 0.02) + (m.poster_path ? 0 : -0.05),
      order,
    }
  })
  return { items: rank(scored) }
}

/* ---------- Games (RAWG) ---------- */
interface RawgGame {
  id: number
  name: string
  released?: string | null
  background_image?: string | null
  ratings_count?: number
  added?: number
}

async function rawgSearch(q: string, key: string, precise: boolean, signal?: AbortSignal): Promise<RawgGame[]> {
  const url = `https://api.rawg.io/api/games?key=${encodeURIComponent(key)}&search=${encodeURIComponent(q)}&page_size=30${precise ? '&search_precise=true' : ''}`
  try {
    return (await fetchJson<{ results: RawgGame[] }>(url, { signal })).results
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) throw new Error('RAWG rejected the key — check VITE_RAWG_API_KEY')
    throw e
  }
}

async function searchGames(q: string, { signal }: SearchOptions): Promise<SearchResult> {
  const key = env.rawgKey
  if (!key) {
    return { items: [], notice: 'Game search needs a RAWG key (VITE_RAWG_API_KEY). You can still add games manually.' }
  }
  // precise search nails exact titles; the fuzzy one catches typos
  const [precise, fuzzy] = await settleWithGrace([rawgSearch(q, key, true, signal), rawgSearch(q, key, false, signal)])
  if (precise.status === 'rejected' && fuzzy.status === 'rejected') throw precise.reason
  const seen = new Set<number>()
  const games = [...(precise.status === 'fulfilled' ? precise.value : []), ...(fuzzy.status === 'fulfilled' ? fuzzy.value : [])].filter(
    (g) => !seen.has(g.id) && seen.add(g.id),
  )
  const scored = games.map((g, order) => ({
    item: {
      id: uid('rawg', g.id),
      title: g.name,
      subtitle: g.released?.slice(0, 4),
      year: g.released?.slice(0, 4),
      // RAWG's crop endpoint gives a lighter image
      image: g.background_image?.replace('/media/games/', '/media/resize/640/-/games/') ?? undefined,
      source: 'rawg' as const,
    },
    score: score(q, g.name) + popularity(g.added ?? g.ratings_count, 0.025) + (g.background_image ? 0 : -0.05),
    order,
  }))
  return { items: rank(scored) }
}

/* ---------- entry point with a small cache (typing back and forth is instant) ---------- */
const cache = new Map<string, { at: number; result: SearchResult }>()

export async function search(category: Category, q: string, opts: SearchOptions = {}): Promise<SearchResult> {
  const query = q.trim()
  const key = `${category}|${opts.musicFilter ?? 'all'}|${query.toLowerCase()}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL) return hit.result

  let result: SearchResult
  switch (category) {
    case 'albums':
      result = await searchAlbums(query, opts)
      break
    case 'artists':
      result = await searchArtists(query)
      break
    case 'movies':
      result = await searchMovies(query, opts)
      break
    case 'games':
      result = await searchGames(query, opts)
      break
  }
  cache.set(key, { at: Date.now(), result })
  if (cache.size > 80) cache.delete(cache.keys().next().value!)
  return result
}
