import { useEffect, useState } from 'react'
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { hasSupabase } from './lib/env'
import { AuthDialog } from './components/AuthDialog'
import { ShelfBot } from './components/ShelfBot'
import { Home } from './pages/Home'
import { EditorRoute } from './pages/Editor'
import { View } from './pages/View'
import { MyGrids } from './pages/MyGrids'

type Theme = 'light' | 'dark'
const THEME_KEY = 'shelfie:theme'

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    const set = document.documentElement.dataset.theme
    if (set === 'light' || set === 'dark') return set
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  const toggle = () =>
    setTheme((t) => {
      const next = t === 'dark' ? 'light' : 'dark'
      try {
        localStorage.setItem(THEME_KEY, next)
      } catch {
        /* storage blocked — theme just won't persist */
      }
      return next
    })
  return [theme, toggle] as const
}

function Header() {
  const { user, signOut } = useAuth()
  const [showAuth, setShowAuth] = useState(false)
  const [theme, toggleTheme] = useTheme()
  return (
    <header className="app-header">
      <Link to="/" className="logo">
        <ShelfBot size={36} />
        <span className="logo-text">
          <small>dipstick's</small>
          <b>SHELFIE</b>
        </span>
      </Link>
      <nav className="app-nav mono">
        <NavLink to="/create/albums">Create</NavLink>
        {hasSupabase && <NavLink to="/me">My grids</NavLink>}
      </nav>
      <div className="header-end">
        {!hasSupabase ? (
          <span className="pill mono" title="Add Supabase keys to .env to enable saving & sharing">
            <i className="dot" /> Offline
          </span>
        ) : user ? (
          <>
            <span className="muted tiny mono user-tag">{user.is_anonymous ? 'guest' : user.email}</span>
            <button className="btn ghost" onClick={signOut}>
              Sign out
            </button>
          </>
        ) : (
          <button className="btn ghost" onClick={() => setShowAuth(true)}>
            Sign in
          </button>
        )}
        <button className="icon-btn theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        <Link to="/create/albums" className="btn primary header-cta">
          Make a grid
        </Link>
      </div>
      {showAuth && <AuthDialog onClose={() => setShowAuth(false)} />}
    </header>
  )
}

function NotFound() {
  return (
    <main className="center stack">
      <ShelfBot size={140} track />
      <h1 className="display">404</h1>
      <p className="muted">This shelf is empty. Shelf-bot looked everywhere.</p>
      <Link className="btn primary" to="/">
        Back home
      </Link>
    </main>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Header />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/create/:category" element={<EditorRoute />} />
          <Route path="/edit/:id" element={<EditorRoute />} />
          <Route path="/g/:slug" element={<View />} />
          <Route path="/me" element={<MyGrids />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
