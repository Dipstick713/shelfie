import { useEffect, useRef, useState } from 'react'
import type { Category, GridItem, MusicReleaseType } from '../lib/types'
import { CATEGORIES } from '../lib/categories'
import { search, type MusicFilter } from '../lib/search'
import { uploadCover } from '../lib/grids'
import { Modal } from './Modal'
import { Cover } from './Cover'

const MUSIC_FILTERS: { id: MusicFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'album', label: 'Albums' },
  { id: 'ep', label: 'EPs' },
  { id: 'single', label: 'Singles' },
]

const TYPE_LABEL: Record<MusicReleaseType, string> = { album: 'Album', ep: 'EP', single: 'Single', other: 'Other' }

export function SearchModal({
  category,
  onPick,
  onClose,
  current,
}: {
  category: Category
  onPick: (item: GridItem) => void
  onClose: () => void
  current?: GridItem | null
}) {
  const meta = CATEGORIES[category]
  const [tab, setTab] = useState<'search' | 'custom'>(current?.source === 'custom' ? 'custom' : 'search')
  const [query, setQuery] = useState('')
  const [musicFilter, setMusicFilter] = useState<MusicFilter>('all')
  const [results, setResults] = useState<GridItem[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => inputRef.current?.focus(), [tab])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setNotice(null)
      setError(null)
      return
    }
    const ctrl = new AbortController()
    let stale = false
    const t = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const r = await search(category, q, { musicFilter, signal: ctrl.signal })
        if (stale) return
        setResults(r.items)
        setNotice(r.notice ?? null)
      } catch (e) {
        if (stale || ctrl.signal.aborted) return
        setError(e instanceof Error ? e.message : 'Search failed')
        setResults([])
      } finally {
        if (!stale) setLoading(false)
      }
    }, 350)
    return () => {
      stale = true
      clearTimeout(t)
      ctrl.abort()
    }
  }, [query, musicFilter, category])

  return (
    <Modal title={`Add ${meta.noun}`} onClose={onClose} wide>
      <div className="tabs">
        <button className={tab === 'search' ? 'active' : ''} onClick={() => setTab('search')}>
          Search
        </button>
        <button className={tab === 'custom' ? 'active' : ''} onClick={() => setTab('custom')}>
          Add your own
        </button>
      </div>

      {tab === 'search' ? (
        <>
          <input
            ref={inputRef}
            className="search-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={category === 'albums' ? 'Search album, EP or artist…' : `Search ${meta.noun}s…`}
          />
          {category === 'albums' && (
            <div className="chips">
              {MUSIC_FILTERS.map((f) => (
                <button
                  key={f.id}
                  className={`chip ${musicFilter === f.id ? 'active' : ''}`}
                  onClick={() => setMusicFilter(f.id)}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {notice && <p className="notice">{notice}</p>}
          {error && <p className="error">{error}</p>}
          {loading && <p className="muted">Searching…</p>}

          <div className={`results ${category === 'movies' ? 'poster' : ''}`}>
            {results.map((item) => (
              <button key={item.id} className="result" onClick={() => onPick(item)} title={item.title}>
                <div className={`result-art ${category === 'artists' ? 'round' : ''}`}>
                  <Cover item={item} />
                  {item.releaseType && item.releaseType !== 'album' && (
                    <span className="badge">{TYPE_LABEL[item.releaseType]}</span>
                  )}
                </div>
                <span className="result-title">{item.title}</span>
                {item.subtitle && <span className="result-sub">{item.subtitle}</span>}
                {category === 'albums' && item.year && <span className="result-sub">{item.year}</span>}
              </button>
            ))}
          </div>

          {query.trim().length >= 2 && !loading && (
            <div className="cant-find">
              {results.length === 0 && !notice && !error && <p className="muted">No results.</p>}
              <button className="btn" onClick={() => setTab('custom')}>
                Can't find it? Add “{query.trim()}” yourself →
              </button>
            </div>
          )}
        </>
      ) : (
        <CustomForm category={category} initialTitle={current?.source === 'custom' ? current.title : query.trim()} current={current} onPick={onPick} />
      )}
    </Modal>
  )
}

function CustomForm({
  category,
  initialTitle,
  current,
  onPick,
}: {
  category: Category
  initialTitle: string
  current?: GridItem | null
  onPick: (item: GridItem) => void
}) {
  const isCustom = current?.source === 'custom'
  const [title, setTitle] = useState(initialTitle)
  const [subtitle, setSubtitle] = useState(isCustom ? (current?.subtitle ?? '') : '')
  const [releaseType, setReleaseType] = useState<MusicReleaseType>(isCustom ? (current?.releaseType ?? 'album') : 'album')
  const [image, setImage] = useState<string>(isCustom ? (current?.image ?? '') : '')
  const [urlDraft, setUrlDraft] = useState('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const subtitleLabel = { albums: 'Artist', artists: 'Genre / note', movies: 'Year / director', games: 'Year / platform' }[category]

  const handleFile = async (file?: File) => {
    if (!file) return
    setError(null)
    setUploading(true)
    try {
      setImage(await uploadCover(file))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <form
      className="custom-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (!title.trim()) return
        onPick({
          id: isCustom ? current!.id : `custom:${crypto.randomUUID()}`,
          title: title.trim(),
          subtitle: subtitle.trim() || undefined,
          image: image || undefined,
          releaseType: category === 'albums' ? releaseType : undefined,
          source: 'custom',
        })
      }}
    >
      <label
        className={`dropzone ${category === 'artists' ? 'round' : ''} ${dragOver ? 'over' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFile(e.dataTransfer.files[0])
        }}
      >
        {image ? (
          <img src={image} alt="" />
        ) : (
          <span className="muted">{uploading ? 'Uploading…' : 'Tap to choose an image, or drop one here'}</span>
        )}
        <input type="file" accept="image/*" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
      </label>

      <div className="stack">
        <label className="field">
          <span>Title *</span>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>
        <label className="field">
          <span>{subtitleLabel}</span>
          <input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
        </label>
        {category === 'albums' && (
          <label className="field">
            <span>Type</span>
            <select value={releaseType} onChange={(e) => setReleaseType(e.target.value as MusicReleaseType)}>
              <option value="album">Album</option>
              <option value="ep">EP</option>
              <option value="single">Single</option>
              <option value="other">Other (mixtape, live…)</option>
            </select>
          </label>
        )}
        <label className="field">
          <span>…or paste an image URL</span>
          <div className="row">
            <input value={urlDraft} onChange={(e) => setUrlDraft(e.target.value)} placeholder="https://…" />
            <button type="button" className="btn" disabled={!urlDraft.trim()} onClick={() => setImage(urlDraft.trim())}>
              Use
            </button>
          </div>
        </label>
        {image && (
          <button type="button" className="btn ghost" onClick={() => setImage('')}>
            Remove image
          </button>
        )}
        {error && <p className="error">{error}</p>}
        <button className="btn primary" disabled={!title.trim() || uploading}>
          {isCustom ? 'Update' : 'Add to grid'}
        </button>
      </div>
    </form>
  )
}
