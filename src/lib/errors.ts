/** Turn Supabase/network errors into messages a person can act on. */
export function friendlyError(e: unknown, fallback = 'Something went wrong'): string {
  const err = e as { code?: string; error_code?: string; message?: string; status?: number } | null
  const code = err?.code ?? err?.error_code ?? ''
  const msg = err?.message ?? (typeof e === 'string' ? e : '')

  if (code === 'PGRST205' || code === '42P01' || /could not find the table/i.test(msg))
    return "Saving isn't set up yet on the server. Your grid is safe as a draft on this device."
  if (code === 'anonymous_provider_disabled' || /anonymous sign-ins are disabled/i.test(msg))
    return 'Guest mode is turned off right now. Sign in with email instead.'
  if (code === '42501' || /row-level security/i.test(msg))
    return "You don't have permission to change this grid. Try signing in again."
  if (/bucket not found/i.test(msg)) return "Image uploads aren't set up yet. Paste an image URL instead."
  if (/failed to fetch|networkerror|load failed/i.test(msg)) return "Couldn't reach the server. Check your connection and try again."
  if (/rate limit|too many/i.test(msg)) return 'Too many tries. Wait a minute and try again.'
  return msg || fallback
}
