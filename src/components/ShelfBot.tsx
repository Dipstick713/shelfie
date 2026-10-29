import { useEffect, useId, useRef } from 'react'

interface Props {
  size?: number
  /** eyes follow the pointer */
  track?: boolean
  happy?: boolean
  className?: string
}

/** Shelfie's mascot: a little screen-faced shelf robot. */
export function ShelfBot({ size = 160, track = false, happy = false, className = '' }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const eyesRef = useRef<SVGGElement>(null)
  const uid = useId().replace(/:/g, '')

  useEffect(() => {
    if (!track) return
    const onMove = (e: PointerEvent) => {
      const svg = svgRef.current
      const eyes = eyesRef.current
      if (!svg || !eyes) return
      const r = svg.getBoundingClientRect()
      const dx = e.clientX - (r.left + r.width / 2)
      const dy = e.clientY - (r.top + r.height / 2)
      const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v))
      eyes.style.transform = `translate(${clamp(dx / 30, 9)}px, ${clamp(dy / 30, 7)}px)`
    }
    window.addEventListener('pointermove', onMove)
    return () => window.removeEventListener('pointermove', onMove)
  }, [track])

  return (
    <svg
      ref={svgRef}
      className={`shelfbot ${className}`}
      width={size}
      height={size}
      viewBox="0 0 140 140"
      role="img"
      aria-label="Shelf-bot, the Shelfie mascot"
    >
      <defs>
        <linearGradient id={`bezel-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd23f" />
          <stop offset="0.55" stopColor="#ff8a1f" />
          <stop offset="1" stopColor="#ff5b14" />
        </linearGradient>
        <linearGradient id={`shell-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fbfbf9" />
          <stop offset="1" stopColor="#d9d9d4" />
        </linearGradient>
        <pattern id={`scan-${uid}`} width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M8 0H0V8" fill="none" stroke="rgba(255,255,255,0.09)" strokeWidth="1" />
        </pattern>
      </defs>

      <ellipse className="bot-shadow" cx="66" cy="132" rx="40" ry="4" />
      <g className="bot-body">
        <g className="bot-antenna">
          <line x1="64" y1="22" x2="64" y2="9" stroke="#bdbdb7" strokeWidth="3" strokeLinecap="round" />
          <circle cx="64" cy="7" r="5" fill="#ff5b14" />
        </g>
        <rect x="104" y="56" width="18" height="30" rx="8" fill="#cfcfca" />
        <rect x="14" y="22" width="100" height="100" rx="24" fill={`url(#shell-${uid})`} stroke="#c4c4bf" />
        <rect x="23" y="31" width="82" height="82" rx="18" fill={`url(#bezel-${uid})`} />
        <rect x="32" y="40" width="64" height="64" rx="11" fill="#1d0f0a" />
        <rect x="32" y="40" width="64" height="64" rx="11" fill={`url(#scan-${uid})`} />
        <g ref={eyesRef} className="bot-eyes">
          {happy ? (
            <g fill="none" stroke="#fff" strokeWidth="4.5" strokeLinecap="round">
              <path d="M45 76 q7 -9 14 0" />
              <path d="M69 76 q7 -9 14 0" />
            </g>
          ) : (
            <g className="bot-blink">
              <circle cx="52" cy="73" r="6.5" fill="#fff" />
              <circle cx="76" cy="73" r="6.5" fill="#fff" />
            </g>
          )}
          {happy && (
            <g fill="#ff7a59" opacity="0.7">
              <ellipse cx="44" cy="88" rx="5" ry="2.5" />
              <ellipse cx="84" cy="88" rx="5" ry="2.5" />
            </g>
          )}
        </g>
      </g>
    </svg>
  )
}
