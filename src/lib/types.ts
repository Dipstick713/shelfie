export type Category = 'albums' | 'artists' | 'movies' | 'games'

export type MusicReleaseType = 'album' | 'ep' | 'single' | 'other'

export interface GridItem {
  id: string
  title: string
  subtitle?: string
  image?: string
  year?: string
  releaseType?: MusicReleaseType
  source: 'itunes' | 'musicbrainz' | 'deezer' | 'tmdb' | 'rawg' | 'custom'
}

export type TitleMode = 'none' | 'below' | 'overlay' | 'list'
export type AspectRatio = '1:1' | '2:3' | '3:4' | '4:3' | '16:9'

export interface GridConfig {
  title: string
  showHeader: boolean
  rows: number
  cols: number
  cellSize: number
  gap: number
  padding: number
  radius: number
  borderWidth: number
  borderColor: string
  aspect: AspectRatio
  titleMode: TitleMode
  showSubtitle: boolean
  showNumbers: boolean
  fontFamily: string
  fontSize: number
  bgColor: string
  cellColor: string
  textColor: string
  accentColor: string
}

export interface GridDoc {
  id?: string
  slug?: string
  category: Category
  config: GridConfig
  /** sparse, index = cell position (row-major); null = empty slot */
  items: (GridItem | null)[]
  is_public?: boolean
  updated_at?: string
}
