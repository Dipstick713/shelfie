import type { ReactNode } from 'react'
import type { AspectRatio, GridConfig, TitleMode } from '../lib/types'
import { FONTS, THEMES } from '../lib/categories'

const SIZE_PRESETS: [number, number][] = [
  [3, 3],
  [4, 4],
  [5, 5],
  [2, 5],
  [1, 5],
  [3, 5],
  [6, 6],
  [10, 10],
]

interface Props {
  config: GridConfig
  onChange: (patch: Partial<GridConfig>) => void
  filledCount: number
}

export function SettingsPanel({ config, onChange, filledCount }: Props) {
  const capacity = config.rows * config.cols
  return (
    <aside className="settings">
      <Section title="Grid size">
        <div className="chips">
          {SIZE_PRESETS.map(([r, c]) => (
            <button
              key={`${r}x${c}`}
              className={`chip ${config.rows === r && config.cols === c ? 'active' : ''}`}
              onClick={() => onChange({ rows: r, cols: c })}
            >
              {c}×{r}
            </button>
          ))}
        </div>
        <Range label="Columns" value={config.cols} min={1} max={12} onChange={(cols) => onChange({ cols })} />
        <Range label="Rows" value={config.rows} min={1} max={12} onChange={(rows) => onChange({ rows })} />
        {filledCount > capacity && (
          <p className="warn">{filledCount - capacity} item(s) don't fit and will be dropped when you save.</p>
        )}
      </Section>

      <Section title="Cells">
        <Range label="Cell size" value={config.cellSize} min={48} max={320} step={4} unit="px" onChange={(cellSize) => onChange({ cellSize })} />
        <Range label="Gap" value={config.gap} min={0} max={48} unit="px" onChange={(gap) => onChange({ gap })} />
        <Range label="Padding" value={config.padding} min={0} max={96} step={2} unit="px" onChange={(padding) => onChange({ padding })} />
        <Range label="Corner radius" value={Math.min(config.radius, 160)} min={0} max={160} unit="px" onChange={(radius) => onChange({ radius })} />
        <Range label="Border" value={config.borderWidth} min={0} max={12} unit="px" onChange={(borderWidth) => onChange({ borderWidth })} />
        {config.borderWidth > 0 && (
          <Color label="Border colour" value={config.borderColor} onChange={(borderColor) => onChange({ borderColor })} />
        )}
        <label className="field">
          <span>Shape</span>
          <select value={config.aspect} onChange={(e) => onChange({ aspect: e.target.value as AspectRatio })}>
            <option value="1:1">Square (1:1) — albums</option>
            <option value="2:3">Poster (2:3) — movies</option>
            <option value="3:4">Box art (3:4) — games</option>
            <option value="4:3">Landscape (4:3)</option>
            <option value="16:9">Wide (16:9)</option>
          </select>
        </label>
      </Section>

      <Section title="Text">
        <label className="field">
          <span>Grid title</span>
          <input value={config.title} onChange={(e) => onChange({ title: e.target.value })} />
        </label>
        <Toggle label="Show title" checked={config.showHeader} onChange={(showHeader) => onChange({ showHeader })} />
        <label className="field">
          <span>Item names</span>
          <select value={config.titleMode} onChange={(e) => onChange({ titleMode: e.target.value as TitleMode })}>
            <option value="below">Under each cell</option>
            <option value="list">List beside grid</option>
            <option value="overlay">Overlay on hover / image</option>
            <option value="none">Hidden</option>
          </select>
        </label>
        <Toggle label="Show artist / year" checked={config.showSubtitle} onChange={(showSubtitle) => onChange({ showSubtitle })} />
        <Toggle label="Show numbers" checked={config.showNumbers} onChange={(showNumbers) => onChange({ showNumbers })} />
        <label className="field">
          <span>Font</span>
          <select value={config.fontFamily} onChange={(e) => onChange({ fontFamily: e.target.value })}>
            {FONTS.map((f) => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value }}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <Range label="Font size" value={config.fontSize} min={10} max={28} unit="px" onChange={(fontSize) => onChange({ fontSize })} />
      </Section>

      <Section title="Colours">
        <div className="themes">
          {THEMES.map((t) => (
            <button
              key={t.name}
              className="theme-swatch"
              title={t.name}
              style={{ background: t.colors.bgColor, color: t.colors.textColor, borderColor: t.colors.accentColor }}
              onClick={() => onChange(t.colors)}
            >
              <span style={{ background: t.colors.cellColor }} />
              {t.name}
            </button>
          ))}
        </div>
        <Color label="Background" value={config.bgColor} onChange={(bgColor) => onChange({ bgColor })} />
        <Color label="Empty cell" value={config.cellColor} onChange={(cellColor) => onChange({ cellColor })} />
        <Color label="Text" value={config.textColor} onChange={(textColor) => onChange({ textColor })} />
        <Color label="Accent" value={config.accentColor} onChange={(accentColor) => onChange({ accentColor })} />
      </Section>
    </aside>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <details className="section" open>
      <summary>{title}</summary>
      <div className="stack">{children}</div>
    </details>
  )
}

function Range({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (v: number) => void
}) {
  return (
    <label className="field range">
      <span>
        {label}
        <output>
          {value}
          {unit}
        </output>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="field color">
      <span>{label}</span>
      <span className="row">
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
        <input
          value={value}
          onChange={(e) => /^#[0-9a-f]{0,6}$/i.test(e.target.value) && onChange(e.target.value)}
          maxLength={7}
          className="hex"
        />
      </span>
    </label>
  )
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  )
}
