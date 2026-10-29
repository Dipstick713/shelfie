import { useEffect, useState } from 'react'
import type { Category } from '../lib/types'

/** Small animated category illustrations; they move when a parent `.doodle-host` is hovered. */
export function CategoryDoodle({ category, size = 64 }: { category: Category; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 64 64', className: `doodle doodle-${category}`, 'aria-hidden': true }
  switch (category) {
    case 'albums':
      return (
        <svg {...common}>
          <g className="vinyl">
            <circle cx="32" cy="32" r="27" fill="currentColor" />
            {[22, 17, 12].map((r) => (
              <circle key={r} cx="32" cy="32" r={r} fill="none" stroke="var(--doodle-groove)" strokeWidth="1" />
            ))}
            <circle cx="32" cy="32" r="8" fill="var(--cat)" />
            <circle cx="32" cy="32" r="2" fill="var(--doodle-bg)" />
            <path d="M14 22 a20 20 0 0 1 9 -8" fill="none" stroke="var(--doodle-groove)" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        </svg>
      )
    case 'artists':
      return (
        <svg {...common}>
          <g className="mic">
            <rect x="22" y="6" width="20" height="30" rx="10" fill="var(--cat)" />
            <path d="M22 18h20M22 24h20" stroke="var(--doodle-bg)" strokeWidth="1.5" opacity="0.5" />
            <path d="M16 28a16 16 0 0 0 32 0" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M32 44v10M23 56h18" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" />
          </g>
          <g className="notes" fill="currentColor">
            <circle cx="52" cy="14" r="3" />
            <path d="M55 14V5l4 2" stroke="currentColor" strokeWidth="1.8" fill="none" />
          </g>
        </svg>
      )
    case 'movies':
      return (
        <svg {...common}>
          <rect x="8" y="26" width="48" height="30" rx="3" fill="currentColor" />
          <path d="M14 34h36M14 41h24" stroke="var(--doodle-bg)" strokeWidth="2" opacity="0.4" />
          <g className="clapper">
            <rect x="8" y="15" width="48" height="10" rx="2" fill="var(--cat)" />
            <path d="M16 15l-5 10M28 15l-5 10M40 15l-5 10M52 15l-5 10" stroke="var(--doodle-bg)" strokeWidth="3.5" />
          </g>
        </svg>
      )
    case 'games':
      return (
        <svg {...common}>
          <g className="pad">
            <path d="M14 20h36a10 10 0 0 1 10 10l2 14a8 8 0 0 1-14 6l-6-7H22l-6 7a8 8 0 0 1-14-6l2-14a10 10 0 0 1 10-10z" fill="currentColor" />
            <path d="M18 30v10M13 35h10" stroke="var(--doodle-bg)" strokeWidth="3.5" strokeLinecap="round" />
            <circle className="btn-a" cx="45" cy="31" r="3.2" fill="var(--cat)" />
            <circle className="btn-b" cx="51" cy="37" r="3.2" fill="var(--cat)" />
          </g>
        </svg>
      )
  }
}

const SHUFFLE_COLORS = ['#ff5b14', '#a78bfa', '#3b9eff', '#22c55e', '#ffd23f', '#f1f1ee', '#3a3a3a', '#ff7a59', '#2a2a2a']

/** A 3×3 mini grid that keeps rearranging itself, like someone fiddling with their top 9. */
export function ShuffleTile() {
  const [order, setOrder] = useState(() => SHUFFLE_COLORS.map((_, i) => i))
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const t = setInterval(() => {
      setOrder((o) => {
        const next = [...o]
        const a = Math.floor(Math.random() * 9)
        const b = (a + 1 + Math.floor(Math.random() * 8)) % 9
        ;[next[a], next[b]] = [next[b], next[a]]
        return next
      })
    }, 900)
    return () => clearInterval(t)
  }, [])
  return (
    <div className="shuffle" aria-hidden>
      {order.map((c, i) => (
        <span key={i} style={{ background: SHUFFLE_COLORS[c] }} />
      ))}
    </div>
  )
}

export function Marquee({ words }: { words: string[] }) {
  const run = words.flatMap((w) => [w, '✦'])
  return (
    <div className="marquee" aria-hidden>
      <div className="marquee-track">
        {[0, 1].map((k) => (
          <span key={k}>
            {run.map((w, i) => (
              <em key={i} className={w === '✦' ? 'star' : ''}>
                {w}
              </em>
            ))}
          </span>
        ))}
      </div>
    </div>
  )
}
