import type { Category, GridDoc, GridItem } from './types'
import { defaultConfig } from './categories'
import { supabase } from './supabase'

/* ---------- local drafts (work without any backend) ---------- */
const draftKey = (category: Category, id?: string) => `shelfie:draft:${id ?? category}`

export function newGrid(category: Category): GridDoc {
  const config = defaultConfig(category)
  return { category, config, items: Array(config.rows * config.cols).fill(null) }
}

export function loadDraft(category: Category, id?: string): GridDoc | null {
  try {
    const raw = localStorage.getItem(draftKey(category, id))
    if (!raw) return null
    const doc = JSON.parse(raw) as GridDoc
    // merge in any config fields added since the draft was saved
    return { ...doc, config: { ...defaultConfig(category), ...doc.config } }
  } catch {
    return null
  }
}

export function saveDraft(doc: GridDoc) {
  try {
    localStorage.setItem(draftKey(doc.category, doc.id), JSON.stringify(doc))
  } catch {
    /* storage full or blocked — drafts are best-effort */
  }
}

export function clearDraft(category: Category, id?: string) {
  try {
    localStorage.removeItem(draftKey(category, id))
  } catch {
    /* ignore */
  }
}

/** Resize the item array when rows/cols change, keeping items in reading order. */
export function resizeItems(items: (GridItem | null)[], size: number): (GridItem | null)[] {
  if (items.length === size) return items
  if (items.length < size) return [...items, ...Array(size - items.length).fill(null)]
  // shrinking: keep filled items first so nothing is silently lost if there is room
  const filled = items.filter(Boolean)
  if (filled.length <= size) {
    const kept = items.slice(0, size)
    const overflow = items.slice(size).filter(Boolean)
    return kept.map((it) => (it === null && overflow.length ? overflow.shift()! : it))
  }
  return items.slice(0, size)
}

/* ---------- Supabase ---------- */
function requireClient() {
  if (!supabase) throw new Error('Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env.local')
  return supabase
}

const randomSlug = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('')

interface GridRow {
  id: string
  slug: string
  category: Category
  title: string
  config: GridDoc['config']
  items: GridDoc['items']
  is_public: boolean
  updated_at: string
  user_id: string
}

const rowToDoc = (r: GridRow): GridDoc => ({
  id: r.id,
  slug: r.slug,
  category: r.category,
  config: { ...defaultConfig(r.category), ...r.config },
  items: r.items,
  is_public: r.is_public,
  updated_at: r.updated_at,
})

export async function saveGrid(doc: GridDoc): Promise<GridDoc> {
  const sb = requireClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) throw new Error('Sign in to save and share your grid')
  const payload = {
    category: doc.category,
    title: doc.config.title,
    config: doc.config,
    items: doc.items,
    is_public: doc.is_public ?? true,
  }
  const query = doc.id
    ? sb.from('grids').update(payload).eq('id', doc.id)
    : sb.from('grids').insert({ ...payload, slug: randomSlug() })
  const { data, error } = await query.select().single()
  if (error) throw error
  return rowToDoc(data as GridRow)
}

export async function getGridBySlug(slug: string): Promise<GridDoc & { user_id: string }> {
  const sb = requireClient()
  const { data, error } = await sb.from('grids').select('*').eq('slug', slug).single()
  if (error) throw error
  return { ...rowToDoc(data as GridRow), user_id: (data as GridRow).user_id }
}

export async function getGridById(id: string): Promise<GridDoc> {
  const sb = requireClient()
  const { data, error } = await sb.from('grids').select('*').eq('id', id).single()
  if (error) throw error
  return rowToDoc(data as GridRow)
}

export async function listMyGrids(): Promise<GridDoc[]> {
  const sb = requireClient()
  const { data: auth } = await sb.auth.getUser()
  if (!auth.user) return []
  const { data, error } = await sb
    .from('grids')
    .select('*')
    .eq('user_id', auth.user.id)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data as GridRow[]).map(rowToDoc)
}

export async function deleteGrid(id: string) {
  const sb = requireClient()
  const { error } = await sb.from('grids').delete().eq('id', id)
  if (error) throw error
}

/* ---------- custom images ---------- */
const MAX_UPLOAD = 5 * 1024 * 1024

/** Uploads to Supabase Storage when signed in; otherwise falls back to an inline (downscaled) data URL. */
export async function uploadCover(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file')
  if (file.size > MAX_UPLOAD) throw new Error('Image must be under 5 MB')
  const user = supabase ? (await supabase.auth.getUser()).data.user : null
  if (supabase && user) {
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('covers').upload(path, file, { contentType: file.type })
    if (error) throw error
    return supabase.storage.from('covers').getPublicUrl(path).data.publicUrl
  }
  return downscaleToDataUrl(file, 600)
}

function downscaleToDataUrl(file: File, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(canvas.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image'))
    }
    img.src = url
  })
}
