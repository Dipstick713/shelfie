import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { hasSupabase } from '../lib/env'
import { Modal } from './Modal'
import { friendlyError } from '../lib/errors'

export function AuthDialog({ onClose, reason }: { onClose: () => void; reason?: string }) {
  const { signInWithEmail, signInAnonymously } = useAuth()
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  if (!hasSupabase) {
    return (
      <Modal title="Backend not connected" onClose={onClose}>
        <p className="muted">
          Saving and sharing need Supabase. Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to{' '}
          <code>.env.local</code> and restart the dev server. Your grid is kept as a local draft in the meantime.
        </p>
      </Modal>
    )
  }

  const run = async (fn: () => Promise<void>, after?: () => void) => {
    setError(null)
    try {
      await fn()
      after?.()
    } catch (e) {
      setError(friendlyError(e))
      setStatus('idle')
    }
  }

  return (
    <Modal title="Sign in" onClose={onClose}>
      {reason && <p className="muted">{reason}</p>}
      {status === 'sent' ? (
        <p>
          Check <strong>{email}</strong> for a magic link. Your draft is saved — you'll land back here.
        </p>
      ) : (
        <form
          className="stack"
          onSubmit={(e) => {
            e.preventDefault()
            setStatus('sending')
            run(() => signInWithEmail(email), () => setStatus('sent'))
          }}
        >
          <label className="field">
            <span>Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </label>
          <button className="btn primary" disabled={status === 'sending'}>
            {status === 'sending' ? 'Sending…' : 'Email me a magic link'}
          </button>
          <div className="divider">or</div>
          <button type="button" className="btn" onClick={() => run(signInAnonymously, onClose)}>
            Continue as guest
          </button>
          <p className="tiny muted">Guest grids are tied to this browser. Use email to keep them across devices.</p>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </Modal>
  )
}
