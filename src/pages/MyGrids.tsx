import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { GridDoc } from '../lib/types'
import { CATEGORIES } from '../lib/categories'
import { deleteGrid, listMyGrids } from '../lib/grids'
import { useAuth } from '../lib/auth'
import { AuthDialog } from '../components/AuthDialog'
import { Cover } from '../components/Cover'
import { ShelfBot } from '../components/ShelfBot'

export function MyGrids() {
  const { user, loading } = useAuth()
  const [grids, setGrids] = useState<GridDoc[] | null>(null)
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    if (!user) return
    listMyGrids()
      .then(setGrids)
      .catch((e) => {
        // show the empty shelf rather than a raw backend error
        console.error('Failed to load grids', e)
        setGrids([])
      })
  }, [user])

  if (loading) return <main className="center muted">Loading…</main>
  if (!user)
    return (
      <main className="center stack">
        <p className="muted">Sign in to see your saved grids.</p>
        <button className="btn primary" onClick={() => setShowAuth(true)}>
          Sign in
        </button>
        {showAuth && <AuthDialog onClose={() => setShowAuth(false)} />}
      </main>
    )

  const remove = async (id: string) => {
    if (!confirm('Delete this grid? The share link will stop working.')) return
    await deleteGrid(id)
    setGrids((g) => g?.filter((x) => x.id !== id) ?? null)
  }

  return (
    <main className="my-grids">
      <h1 className="page-title">
        <i className="mark inline" /> My grids
      </h1>
      {grids?.length === 0 && (
        <div className="empty-shelf">
          <ShelfBot size={120} track />
          <p className="muted">No grids to display yet. Shelf-bot is getting lonely.</p>
          <Link className="btn primary" to="/create/albums">
            Start a grid
          </Link>
        </div>
      )}
      <div className="grid-cards">
        {grids?.map((g) => {
          const covers = g.items.filter((x) => x !== null).slice(0, 4)
          return (
            <article key={g.id} className="grid-card">
              <Link to={`/g/${g.slug}`} className="thumb" style={{ background: g.config.bgColor }}>
                {covers.map((c) => (
                  <Cover key={c.id} item={c} />
                ))}
              </Link>
              <div className="grid-card-info">
                <strong>{g.config.title}</strong>
                <span className="muted tiny">
                  {CATEGORIES[g.category].emoji} {CATEGORIES[g.category].label} · {g.config.cols}×{g.config.rows}
                </span>
              </div>
              <div className="row">
                <Link className="btn tiny" to={`/edit/${g.id}`}>
                  Edit
                </Link>
                <Link className="btn tiny" to={`/g/${g.slug}`}>
                  View
                </Link>
                <button className="btn ghost tiny danger" onClick={() => remove(g.id!)}>
                  Delete
                </button>
              </div>
            </article>
          )
        })}
      </div>
    </main>
  )
}
