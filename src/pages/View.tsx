import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { GridDoc } from '../lib/types'
import { getGridBySlug } from '../lib/grids'
import { downloadPng } from '../lib/exportImage'
import { useAuth } from '../lib/auth'
import { GridCanvas } from '../components/GridCanvas'

export function View() {
  const { slug } = useParams()
  const { user } = useAuth()
  const [doc, setDoc] = useState<(GridDoc & { user_id: string }) | null>(null)
  const [error, setError] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)

  // shrink wide grids to fit small screens instead of scrolling sideways
  useLayoutEffect(() => {
    const wrap = wrapRef.current
    const canvas = ref.current
    if (!wrap || !canvas) return
    const fit = () => setZoom(Math.min(1, wrap.clientWidth / canvas.offsetWidth))
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(wrap)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [doc])

  useEffect(() => {
    if (!slug) return
    getGridBySlug(slug)
      .then((d) => {
        setDoc(d)
        document.title = `${d.config.title} · Shelfie`
      })
      .catch(() => setError("This grid doesn't exist or is private."))
  }, [slug])

  if (error) return <main className="center muted">{error}</main>
  if (!doc) return <main className="center muted">Loading…</main>

  return (
    <main className="view">
      <div className="view-actions">
        {user?.id === doc.user_id && (
          <Link className="btn" to={`/edit/${doc.id}`}>
            Edit
          </Link>
        )}
        <button className="btn" onClick={() => ref.current && downloadPng(ref.current, doc.config.title)}>
          Download PNG
        </button>
        <Link className="btn primary" to={`/create/${doc.category}`}>
          Make your own
        </Link>
      </div>
      <div className="view-canvas" ref={wrapRef}>
        <div style={{ zoom }}>
          <GridCanvas ref={ref} category={doc.category} config={doc.config} items={doc.items} />
        </div>
      </div>
    </main>
  )
}
