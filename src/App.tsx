import { useState } from 'react'
import { BrowserRouter, Link, NavLink, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { hasSupabase } from './lib/env'
import { AuthDialog } from './components/AuthDialog'
import { Home } from './pages/Home'
import { EditorRoute } from './pages/Editor'
import { View } from './pages/View'
import { MyGrids } from './pages/MyGrids'

function Header() {
  const { user, signOut } = useAuth()
  const [showAuth, setShowAuth] = useState(false)
  return (
    <header className="app-header">
      <Link to="/" className="logo">
        <span className="logo-mark">▦</span> Shelfie
      </Link>
      <nav>
        <NavLink to="/create/albums">Create</NavLink>
        {hasSupabase && <NavLink to="/me">My grids</NavLink>}
      </nav>
      <div className="spacer" />
      {!hasSupabase ? (
        <span className="pill muted" title="Add Supabase keys to .env.local to enable saving & sharing">
          Offline mode
        </span>
      ) : user ? (
        <>
          <span className="muted tiny">{user.is_anonymous ? 'Guest' : user.email}</span>
          <button className="btn ghost" onClick={signOut}>
            Sign out
          </button>
        </>
      ) : (
        <button className="btn" onClick={() => setShowAuth(true)}>
          Sign in
        </button>
      )}
      {showAuth && <AuthDialog onClose={() => setShowAuth(false)} />}
    </header>
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
          <Route path="*" element={<main className="center muted">Page not found.</main>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
