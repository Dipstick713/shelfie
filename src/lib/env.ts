export const env = {
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL as string | undefined,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined,
  tmdbKey: import.meta.env.VITE_TMDB_KEY as string | undefined,
  rawgKey: import.meta.env.VITE_RAWG_API_KEY as string | undefined,
}

export const hasSupabase = Boolean(env.supabaseUrl && env.supabaseAnonKey)
