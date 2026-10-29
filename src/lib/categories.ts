import type { Category, GridConfig } from './types'

export interface CategoryMeta {
  id: Category
  label: string
  noun: string
  emoji: string
  blurb: string
  /** UI accent for this category (not used in the exported grid) */
  accent: string
  defaults: Partial<GridConfig>
}

export const CATEGORIES: Record<Category, CategoryMeta> = {
  albums: {
    id: 'albums',
    label: 'Albums & EPs',
    noun: 'album',
    emoji: '💿',
    blurb: 'Albums, EPs and singles — the records that made you.',
    accent: '#ff5b14',
    defaults: { title: 'My favourite albums', aspect: '1:1' },
  },
  artists: {
    id: 'artists',
    label: 'Music Artists',
    noun: 'artist',
    emoji: '🎤',
    blurb: 'The bands and musicians on permanent rotation.',
    accent: '#a78bfa',
    defaults: { title: 'My favourite artists', aspect: '1:1', radius: 999 },
  },
  movies: {
    id: 'movies',
    label: 'Movies',
    noun: 'movie',
    emoji: '🎬',
    blurb: 'Films you could rewatch forever.',
    accent: '#3b9eff',
    defaults: { title: 'My favourite movies', aspect: '2:3' },
  },
  games: {
    id: 'games',
    label: 'Games',
    noun: 'game',
    emoji: '🎮',
    blurb: 'The games that ate your weekends.',
    accent: '#22c55e',
    defaults: { title: 'My favourite games', aspect: '3:4' },
  },
}

export const BASE_CONFIG: GridConfig = {
  title: 'My grid',
  showHeader: true,
  rows: 3,
  cols: 3,
  cellSize: 160,
  gap: 8,
  padding: 24,
  radius: 4,
  borderWidth: 0,
  borderColor: '#ffffff',
  aspect: '1:1',
  titleMode: 'below',
  showSubtitle: true,
  showNumbers: true,
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 14,
  bgColor: '#111111',
  cellColor: '#232323',
  textColor: '#f1f1ee',
  accentColor: '#ff6a2b',
}

export function defaultConfig(category: Category): GridConfig {
  return { ...BASE_CONFIG, ...CATEGORIES[category].defaults }
}

export const THEMES: { name: string; colors: Pick<GridConfig, 'bgColor' | 'cellColor' | 'textColor' | 'accentColor'> }[] = [
  { name: 'Lab', colors: { bgColor: '#e7e7e4', cellColor: '#d4d4cf', textColor: '#151515', accentColor: '#ff5b14' } },
  { name: 'Night shift', colors: { bgColor: '#111111', cellColor: '#232323', textColor: '#f1f1ee', accentColor: '#ff6a2b' } },
  { name: 'Midnight', colors: { bgColor: '#111114', cellColor: '#26262c', textColor: '#f4f4f5', accentColor: '#a78bfa' } },
  { name: 'Paper', colors: { bgColor: '#f7f3ea', cellColor: '#e4ddcc', textColor: '#1f1b16', accentColor: '#c2410c' } },
  { name: 'Vinyl', colors: { bgColor: '#1a1210', cellColor: '#3a2a22', textColor: '#f5e6d3', accentColor: '#f59e0b' } },
  { name: 'Ocean', colors: { bgColor: '#0b1d2e', cellColor: '#16324d', textColor: '#e0f2fe', accentColor: '#38bdf8' } },
  { name: 'Bubblegum', colors: { bgColor: '#fdf2f8', cellColor: '#fbcfe8', textColor: '#500724', accentColor: '#db2777' } },
  { name: 'Forest', colors: { bgColor: '#0f1f17', cellColor: '#1d3a2a', textColor: '#dcfce7', accentColor: '#4ade80' } },
  { name: 'Mono', colors: { bgColor: '#ffffff', cellColor: '#e5e5e5', textColor: '#0a0a0a', accentColor: '#0a0a0a' } },
]

export const FONTS = [
  { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
  { label: 'Space Grotesk', value: '"Space Grotesk", sans-serif' },
  { label: 'Playfair', value: '"Playfair Display", serif' },
  { label: 'DM Mono', value: '"DM Mono", monospace' },
  { label: 'JetBrains Mono', value: '"JetBrains Mono", monospace' },
  { label: 'Tektur', value: 'Tektur, sans-serif' },
  { label: 'Bebas Neue', value: '"Bebas Neue", sans-serif' },
  { label: 'Caveat', value: 'Caveat, cursive' },
]

export const ASPECT_VALUES: Record<GridConfig['aspect'], number> = {
  '1:1': 1,
  '2:3': 2 / 3,
  '3:4': 3 / 4,
  '4:3': 4 / 3,
  '16:9': 16 / 9,
}
