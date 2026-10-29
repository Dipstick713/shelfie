import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom'
import type { Category, GridConfig, GridDoc, GridItem } from '../lib/types'
import { CATEGORIES } from '../lib/categories'
import { clearDraft, getGridById, loadDraft, newGrid, resizeItems, saveDraft, saveGrid } from '../lib/grids'
import { downloadPng } from '../lib/exportImage'
import { friendlyError } from '../lib/errors'
import { useAuth } from '../lib/auth'
import { GridCanvas } from '../components/GridCanvas'
import { SettingsPanel } from '../components/SettingsPanel'
import { SearchModal } from '../components/SearchModal'
import { AuthDialog } from '../components/AuthDialog'
import { Modal } from '../components/Modal'

const isCategory = (c: string | undefined): c is Category => !!c && c in CATEGORIES

/** Remount the editor whenever the route target changes so state starts fresh. */
export function EditorRoute() {
  const { category, id } = useParams()
  return <Editor key={id ?? category} />
}

function Editor() {
  const { category: catParam, id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [doc, setDoc] = useState<GridDoc | null>(() =>
    isCategory(catParam) ? (loadDraft(catParam) ?? newGrid(catParam)) : null,
  )
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeCell, setActiveCell] = useState<number | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  // a first save navigates to /edit/:id, which remounts this component — the link rides along in history state
  const [shareUrl, setShareUrl] = useState<string | null>(() => (location.state as { shareUrl?: string } | null)?.shareUrl ?? null)
  useEffect(() => {
    // drop it from history so a refresh doesn't reopen the dialog
    if ((location.state as { shareUrl?: string } | null)?.shareUrl) window.history.replaceState({ ...window.history.state, usr: null }, '')
  }, [location.state])
  const [busy, setBusy] = useState<'save' | 'export' | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const canvasRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  // editing a saved grid
  useEffect(() => {
    if (!id) return
    let cancelled = false
    getGridById(id)
      .then((remote) => !cancelled && setDoc(loadDraft(remote.category, id) ?? remote))
      .catch((e) => !cancelled && setLoadError(e.message ?? 'Could not load grid'))
    return () => {
      cancelled = true
    }
  }, [id])

  useEffect(() => {
    if (doc) saveDraft(doc)
  }, [doc])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(null), 2500)
    return () => clearTimeout(t)
  }, [toast])

  const capacity = doc ? doc.config.rows * doc.config.cols : 0
  const items = useMemo(() => (doc ? resizeItems(doc.items, Math.max(doc.items.length, capacity)) : []), [doc, capacity])

  const fitZoom = useCallback(() => {
    const stage = stageRef.current
    const canvas = canvasRef.current
    if (!stage || !canvas) return
    const scale = Math.min(1, (stage.clientWidth - 32) / canvas.offsetWidth)
    setZoom(Math.max(0.2, Math.round(scale * 100) / 100))
  }, [])

  useEffect(() => {
    fitZoom()
    window.addEventListener('resize', fitZoom)
    // the canvas can also change width after layout (e.g. N×N grids growing to a square)
    const canvas = canvasRef.current
    let lastW = canvas?.offsetWidth
    const ro = new ResizeObserver(() => {
      if (canvas && canvas.offsetWidth !== lastW) {
        lastW = canvas.offsetWidth
        fitZoom()
      }
    })
    if (canvas) ro.observe(canvas)
    return () => {
      window.removeEventListener('resize', fitZoom)
      ro.disconnect()
    }
  }, [fitZoom, doc?.config.cols, doc?.config.cellSize, doc?.config.gap, doc?.config.padding, doc?.config.titleMode, doc?.config.rows, doc?.config.aspect, doc?.config.fontSize, doc?.config.showSubtitle])

  if (!id && !isCategory(catParam)) return <Navigate to="/" replace />
  if (loadError) return <main className="center">{loadError}</main>
  if (!doc) return <main className="center muted">Loading…</main>

  const meta = CATEGORIES[doc.category]
  const filledCount = items.filter(Boolean).length

  const updateConfig = (patch: Partial<GridConfig>) => setDoc((d) => d && { ...d, config: { ...d.config, ...patch } })
  const setItem = (index: number, item: GridItem | null) =>
    setDoc((d) => {
      if (!d) return d
      const next = resizeItems(d.items, Math.max(d.items.length, d.config.rows * d.config.cols)).slice()
      next[index] = item
      return { ...d, items: next }
    })
  const swap = (a: number, b: number) =>
    setDoc((d) => {
      if (!d) return d
      const next = resizeItems(d.items, Math.max(d.items.length, d.config.rows * d.config.cols)).slice()
      ;[next[a], next[b]] = [next[b], next[a]]
      return { ...d, items: next }
    })

  const pick = (item: GridItem) => {
    if (activeCell === null) return
    // dedupe: picking something already in the grid moves it here
    const existing = items.findIndex((it, i) => it?.id === item.id && i !== activeCell)
    if (existing >= 0) {
      swap(existing, activeCell)
      setItem(activeCell, item)
    } else {
      setItem(activeCell, item)
    }
    // jump to the next empty slot for fast filling
    const nextEmpty = items.findIndex((it, i) => i > activeCell && i < capacity && !it)
    setActiveCell(nextEmpty >= 0 && !items[activeCell] ? nextEmpty : null)
  }

  const handleSave = async () => {
    if (!user) {
      setShowAuth(true)
      return
    }
    setBusy('save')
    try {
      const saved = await saveGrid({ ...doc, items: resizeItems(items, capacity) })
      clearDraft(doc.category, doc.id)
      if (!doc.id) clearDraft(doc.category)
      setDoc(saved)
      const url = `${window.location.origin}/g/${saved.slug}`
      if (doc.id) setShareUrl(url)
      else navigate(`/edit/${saved.id}`, { replace: true, state: { shareUrl: url } })
    } catch (e) {
      console.error('Save failed', e)
      setToast(friendlyError(e, 'Save failed. Your draft is still on this device.'))
    } finally {
      setBusy(null)
    }
  }

  const handleExport = async () => {
    if (!canvasRef.current) return
    setBusy('export')
    try {
      await downloadPng(canvasRef.current, doc.config.title || meta.label)
    } catch {
      setToast('Export failed — an image host may be blocking downloads')
    } finally {
      setBusy(null)
    }
  }

  const handleReset = () => {
    if (!confirm('Clear all items from this grid?')) return
    setDoc((d) => d && { ...d, items: Array(capacity).fill(null) })
  }

  return (
    <main className="editor" style={{ '--cat': meta.accent } as CSSProperties}>
      <div className="editor-toolbar">
        {doc.id ? (
          <span className="pill mono">
            <i className="dot" /> {meta.label}
          </span>
        ) : (
          <nav className="cat-tabs mono">
            {Object.values(CATEGORIES).map((c) => (
              <Link
                key={c.id}
                to={`/create/${c.id}`}
                className={c.id === doc.category ? 'active' : ''}
                style={{ '--cat': c.accent } as CSSProperties}
              >
                <i className="dot" /> {c.label}
              </Link>
            ))}
          </nav>
        )}
        <div className="spacer" />
        <span className="fill-meter mono" title={`${filledCount} of ${capacity} slots filled`}>
          <span className="fill-bar">
            <span style={{ width: `${capacity ? Math.min(100, (filledCount / capacity) * 100) : 0}%` }} />
          </span>
          {filledCount}/{capacity}
        </span>
        <button className="btn ghost" onClick={handleReset}>
          Clear
        </button>
        <button className="btn" onClick={handleExport} disabled={busy !== null}>
          {busy === 'export' ? (
            'Rendering…'
          ) : (
            <>
              <span className="hide-sm">Download </span>PNG
            </>
          )}
        </button>
        <button className="btn primary" onClick={handleSave} disabled={busy !== null}>
          {busy === 'save' ? 'Saving…' : doc.id ? 'Save' : 'Save & share'}
        </button>
      </div>

      <div className="editor-body">
        <SettingsPanel config={doc.config} onChange={updateConfig} filledCount={filledCount} />
        <section className="stage" ref={stageRef}>
          <div className="zoom-bar">
            <button className="icon-btn" onClick={() => setZoom((z) => Math.max(0.2, +(z - 0.1).toFixed(2)))}>
              −
            </button>
            <span>{Math.round(zoom * 100)}%</span>
            <button className="icon-btn" onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(2)))}>
              +
            </button>
            <button className="btn ghost tiny" onClick={fitZoom}>
              Fit
            </button>
          </div>
          <div className="stage-inner" style={{ zoom }}>
            <GridCanvas
              ref={canvasRef}
              category={doc.category}
              config={doc.config}
              items={items}
              editable
              onCellClick={setActiveCell}
              onRemove={(i) => setItem(i, null)}
              onSwap={swap}
            />
          </div>
          <p className="muted tiny hint mono">
            <span className="on-pointer">click a cell to add · drag to rearrange · ✕ to remove</span>
            <span className="on-touch">tap a cell to add · long-press to drag · ✕ to remove</span>
          </p>
        </section>
      </div>

      {activeCell !== null && (
        <SearchModal
          key={activeCell}
          category={doc.category}
          current={items[activeCell]}
          onPick={pick}
          onClose={() => setActiveCell(null)}
        />
      )}
      {showAuth && <AuthDialog reason="Sign in to save your grid and get a shareable link." onClose={() => setShowAuth(false)} />}
      {shareUrl && (
        <Modal title="Saved!" onClose={() => setShareUrl(null)}>
          <p className="muted">Anyone with this link can view your grid:</p>
          <div className="row">
            <input readOnly value={shareUrl} onFocus={(e) => e.target.select()} />
            <button
              className="btn primary"
              onClick={() => navigator.clipboard.writeText(shareUrl).then(() => setToast('Link copied'))}
            >
              Copy
            </button>
          </div>
          <p>
            <a href={shareUrl} target="_blank" rel="noreferrer">
              Open share page ↗
            </a>
          </p>
        </Modal>
      )}
      {toast && <div className="toast">{toast}</div>}
    </main>
  )
}
