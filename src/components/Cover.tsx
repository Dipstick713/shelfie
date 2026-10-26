import { useState } from 'react'
import type { GridItem } from '../lib/types'

/** Image with a graceful text fallback when the art is missing or fails to load. */
export function Cover({ item, className }: { item: GridItem; className?: string }) {
  // 0 = CORS-enabled load (exportable), 1 = plain load (displays, may be blank in PNG export), 2 = give up
  const [attempt, setAttempt] = useState(0)
  if (!item.image || attempt === 2) {
    return (
      <div className={`cover-fallback ${className ?? ''}`}>
        <span>{item.title}</span>
      </div>
    )
  }
  return (
    <img
      className={className}
      src={item.image}
      alt={item.title}
      key={attempt}
      crossOrigin={attempt === 0 ? 'anonymous' : undefined}
      loading="lazy"
      draggable={false}
      onError={() => setAttempt((a) => a + 1)}
    />
  )
}
