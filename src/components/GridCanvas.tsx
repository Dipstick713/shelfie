import { forwardRef, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import {
  DndContext,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import type { Category, GridConfig, GridItem } from '../lib/types'
import { ASPECT_VALUES } from '../lib/categories'
import { Cover } from './Cover'

interface Props {
  category: Category
  config: GridConfig
  items: (GridItem | null)[]
  editable?: boolean
  onCellClick?: (index: number) => void
  onRemove?: (index: number) => void
  onSwap?: (from: number, to: number) => void
}

const LINE_HEIGHT = 1.3
const CAPTION_INNER_GAP = 2

export const GridCanvas = forwardRef<HTMLDivElement, Props>(function GridCanvas(
  { category, config, items, editable, onCellClick, onRemove, onSwap },
  ref,
) {
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // long-press to drag on touch, so swiping over the grid still scrolls the page
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )
  const cellW = config.cellSize
  const cellH = Math.round(config.cellSize / ASPECT_VALUES[config.aspect])
  const radius = Math.min(config.radius, Math.min(cellW, cellH) / 2)

  // Captions have a fixed, clamped height (2 title lines + optional subtitle line)
  // so every row is the same height regardless of title length.
  const captionFont = config.fontSize * 0.85
  const captionH =
    config.titleMode === 'below'
      ? Math.ceil(captionFont * LINE_HEIGHT * 2 + (config.showSubtitle ? captionFont * 0.9 * LINE_HEIGHT + CAPTION_INNER_GAP : 0))
      : 0

  // N×N grids export as a square image: measure the content and grow the canvas
  // to a square around it, keeping the content centred.
  const square = config.rows === config.cols
  const innerRef = useRef<HTMLDivElement>(null)
  const [side, setSide] = useState(0)
  useLayoutEffect(() => {
    const inner = innerRef.current
    if (!square || !inner) return
    const measure = () => setSide(Math.max(inner.offsetWidth, inner.offsetHeight))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(inner)
    return () => ro.disconnect()
  }, [square])

  const style = {
    '--bg': config.bgColor,
    '--cell': config.cellColor,
    '--fg': config.textColor,
    '--accent': config.accentColor,
    '--gap': `${config.gap}px`,
    '--radius': `${radius}px`,
    '--cell-w': `${cellW}px`,
    '--cell-h': `${cellH}px`,
    '--border': `${config.borderWidth}px solid ${config.borderColor}`,
    '--caption-h': `${captionH}px`,
    fontFamily: config.fontFamily,
    fontSize: `${config.fontSize}px`,
    padding: `${config.padding}px`,
    ...(square && side && { width: side + 2 * config.padding, height: side + 2 * config.padding }),
  } as CSSProperties

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || !onSwap) return
    const from = Number(e.active.id)
    const to = Number(e.over.id)
    if (from !== to) onSwap(from, to)
  }

  const cells = items.slice(0, config.rows * config.cols)
  const listed = cells.map((it, i) => ({ it, i })).filter((x): x is { it: GridItem; i: number } => x.it !== null)

  const grid = (
    <div
      className={`grid title-${config.titleMode}`}
      style={{ gridTemplateColumns: `repeat(${config.cols}, var(--cell-w))` }}
    >
      {cells.map((item, i) => (
        <Cell
          key={i}
          index={i}
          item={item}
          category={category}
          config={config}
          editable={editable}
          onClick={() => onCellClick?.(i)}
          onRemove={() => onRemove?.(i)}
        />
      ))}
    </div>
  )

  return (
    <div ref={ref} className={`canvas ${square ? 'square' : ''}`} style={style}>
      <div ref={innerRef} className="canvas-inner">
        {config.showHeader && config.title && <h1 className="canvas-title">{config.title}</h1>}
        <div className={`canvas-body ${config.titleMode === 'list' ? 'with-list' : ''}`}>
          {editable ? (
            <DndContext sensors={sensors} onDragEnd={onDragEnd}>
              {grid}
            </DndContext>
          ) : (
            grid
          )}
          {config.titleMode === 'list' && listed.length > 0 && (
            <ol className="canvas-list">
              {listed.map(({ it, i }) => (
                <li key={i}>
                  {config.showNumbers && <span className="num">{i + 1}.</span>}
                  <span>
                    <strong>{it.title}</strong>
                    {config.showSubtitle && it.subtitle && <span className="sub"> — {it.subtitle}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
})

function Cell({
  index,
  item,
  category,
  config,
  editable,
  onClick,
  onRemove,
}: {
  index: number
  item: GridItem | null
  category: Category
  config: GridConfig
  editable?: boolean
  onClick: () => void
  onRemove: () => void
}) {
  const id = String(index)
  const drop = useDroppable({ id, disabled: !editable })
  const drag = useDraggable({ id, disabled: !editable || !item })
  const dragStyle: CSSProperties | undefined = drag.transform
    ? { transform: `translate(${drag.transform.x}px, ${drag.transform.y}px)`, zIndex: 10, cursor: 'grabbing' }
    : undefined

  return (
    <div ref={drop.setNodeRef} className={`cell-wrap ${drop.isOver && !drag.isDragging ? 'drop-over' : ''}`}>
      <div
        ref={drag.setNodeRef}
        {...(editable && item ? drag.listeners : {})}
        {...(editable && item ? drag.attributes : {})}
        style={dragStyle}
        className={`cell ${item ? 'filled' : 'empty'} ${editable ? 'editable' : ''} ${drag.isDragging ? 'dragging' : ''}`}
        onClick={editable ? onClick : undefined}
        role={editable ? 'button' : undefined}
        aria-label={item ? item.title : editable ? `Add ${category} to slot ${index + 1}` : undefined}
      >
        {item ? (
          <>
            <Cover item={item} className="cell-img" />
            {config.titleMode === 'overlay' && (
              <div className="cell-overlay">
                {config.showNumbers && <span className="num">{index + 1}</span>}
                <strong>{item.title}</strong>
                {config.showSubtitle && item.subtitle && <span className="sub">{item.subtitle}</span>}
              </div>
            )}
            {editable && (
              <button
                className="cell-remove"
                aria-label={`Remove ${item.title}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation()
                  onRemove()
                }}
              >
                ✕
              </button>
            )}
          </>
        ) : (
          editable && <span className="plus">+</span>
        )}
      </div>
      {config.titleMode === 'below' && (
        <div className="cell-caption">
          {item && (
            <>
              <strong>
                {config.showNumbers && `${index + 1}. `}
                {item.title}
              </strong>
              {config.showSubtitle && item.subtitle && <span className="sub">{item.subtitle}</span>}
            </>
          )}
        </div>
      )}
    </div>
  )
}
