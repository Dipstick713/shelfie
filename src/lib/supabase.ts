import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env, hasSupabase } from './env'

export const supabase: SupabaseClient | null = hasSupabase
  ? createClient(env.supabaseUrl!, env.supabaseAnonKey!)
  : null
