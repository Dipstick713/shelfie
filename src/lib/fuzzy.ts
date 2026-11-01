/* Fuzzy matching used to rank search results from APIs that don't rank well themselves.
   Scores are 0..1-ish (boosts can push slightly above 1). */

/** lowercase, strip accents and punctuation, "&" → "and", collapse spaces */
export function normalize(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

const EDITION_RE =
  /\s*[([]\s*(?:[^)\]]*\b(?:deluxe|edition|remaster(?:ed)?|explicit|clean|bonus|expanded|anniversary|version|mono|stereo|special|collector'?s?|super|reissue)\b[^)\]]*)\s*[)\]]\s*$/i

/** "In Rainbows (Deluxe Edition) [Remastered]" → "In Rainbows" */
export function stripEdition(title: string): string {
  let t = title.replace(/\s+-\s+(?:EP|Single)$/i, '')
  for (let i = 0; i < 3 && EDITION_RE.test(t); i++) t = t.replace(EDITION_RE, '')
  return t.trim() || title
}

/** Optimal-string-alignment distance (Levenshtein + adjacent transpositions), capped for speed. */
function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  const rows = a.length + 1
  const cols = b.length + 1
  let prev2 = new Array<number>(cols).fill(0)
  let prev = Array.from({ length: cols }, (_, j) => j)
  for (let i = 1; i < rows; i++) {
    const cur = new Array<number>(cols)
    cur[0] = i
    let rowMin = cur[0]
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      let v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) v = Math.min(v, prev2[j - 2] + 1)
      cur[j] = v
      if (v < rowMin) rowMin = v
    }
    if (rowMin > max) return max + 1
    prev2 = prev
    prev = cur
  }
  return prev[cols - 1]
}

/** How well one query token matches one candidate token (0..1). `partial` = user may still be typing it. */
function tokenSim(q: string, t: string, partial: boolean): number {
  if (q === t) return 1
  if (partial && q.length >= 2 && t.startsWith(q)) return 0.9
  if (q.length <= 2 || t.length <= 2) return 0 // short tokens must match exactly
  if (t.startsWith(q) || q.startsWith(t)) return 0.75 * (Math.min(q.length, t.length) / Math.max(q.length, t.length)) + 0.15
  const allowed = q.length <= 4 ? 1 : q.length <= 8 ? 2 : 3
  const d = editDistance(q, t, allowed)
  if (d > allowed) return 0
  // a single slip in a longer word ("rumors" → "rumours") is nearly exact
  if (d === 1 && q.length >= 5) return 0.92
  return 1 - d / Math.max(q.length, t.length) - 0.05
}

/** Similarity of a whole query against one normalized candidate string. */
export function stringScore(qNorm: string, sNorm: string): number {
  if (!qNorm || !sNorm) return 0
  if (qNorm === sNorm) return 1
  // one or two characters: only an exact title is a real match ("A", "X", "21"), everything else trails
  if (qNorm.length <= 2) return sNorm.split(' ').includes(qNorm) ? 0.45 : 0.1
  // prefixes only mean something once a few letters are typed ("a" prefixes half the catalogue)
  if (sNorm.startsWith(qNorm + ' ') || (qNorm.length >= 3 && sNorm.startsWith(qNorm))) return qNorm.length >= 3 ? 0.93 : 0.6
  const qt = qNorm.split(' ')
  const st = sNorm.split(' ')
  let total = 0
  for (let i = 0; i < qt.length; i++) {
    const partial = i === qt.length - 1
    let best = 0
    for (const t of st) best = Math.max(best, tokenSim(qt[i], t, partial))
    total += best
  }
  const coverage = total / qt.length
  // candidates with many extra words ("… Performs Radiohead's In Rainbows") rank a bit lower
  const extra = Math.max(0, st.length - qt.length)
  const precision = 1 / (1 + 0.08 * extra)
  // whole query appears verbatim inside the candidate
  const contains = sNorm.includes(qNorm) ? 0.05 : 0
  return Math.min(0.92, coverage * (0.8 + 0.2 * precision) + contains)
}

const NOISE = [
  'karaoke',
  'tribute',
  'originally performed',
  'in the style of',
  'made famous',
  'lullaby',
  'lullabies',
  'string quartet',
  'piano version',
  'piano covers',
  '8 bit',
  'instrumental version',
  'cover version',
  'as made famous',
]

/** Penalty for knock-off releases, unless the query asked for them. */
export function noisePenalty(qNorm: string, haystackNorm: string): number {
  return NOISE.some((w) => haystackNorm.includes(w) && !qNorm.includes(w)) ? 0.3 : 0
}

/**
 * Best score of a query against an item's title and (optionally) its creator, allowing
 * "artist title" / "title artist" queries. A creator-only match ranks below title matches.
 */
export function matchScore(query: string, title: string, creator?: string): number {
  const q = normalize(query)
  const t = normalize(stripEdition(title))
  // "dark side of the moon" should fully match "The Dark Side of the Moon"
  const scores = [stringScore(q, t), stringScore(stripArticle(q), stripArticle(t))]
  if (creator) {
    const c = normalize(creator)
    scores.push(stringScore(q, `${c} ${t}`), stringScore(q, `${t} ${c}`), stringScore(q, c) * 0.78)
  }
  return Math.max(...scores) - noisePenalty(q, normalize(`${title} ${creator ?? ''}`))
}

const stripArticle = (s: string) => s.replace(/^(?:the|a|an) (?=\S)/, '')

/** Key for collapsing duplicate releases (deluxe / explicit / remaster variants). */
export function dedupeKey(title: string, creator?: string): string {
  const mainArtist = (creator ?? '').split(/,|&| and | feat\.? | ft\.? | x /i)[0]
  return `${normalize(stripEdition(title))}|${normalize(mainArtist)}`
}
