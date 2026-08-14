/**
 * Lazy loader for the Supabase client.
 *
 * Mirrors the pattern in three-loader.ts / makerjs-loader.ts: singleton cache, shared
 * in-flight promise, 30s timeout, and a `.finally()` reset so a failed load can be
 * retried. Logged-out visitors never download supabase-js — the auth store only calls
 * in when there is a persisted session, an OAuth callback to process, or a deliberate
 * sign-in click.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { AUTH_STORAGE_KEY, getSupabaseConfig } from '@/config/supabase'

const LOAD_TIMEOUT_MS = 30_000

let loadedClient: SupabaseClient | null = null
let loadingPromise: Promise<SupabaseClient> | null = null

/** Check whether the client has already been created. */
export function isSupabaseLoaded(): boolean {
  return loadedClient !== null
}

/**
 * Get the Supabase client (lazy-loaded).
 * Throws when accounts are not configured — callers should gate on `isAuthConfigured()`.
 */
export async function getSupabaseClient(): Promise<SupabaseClient> {
  if (loadedClient) return loadedClient
  if (loadingPromise) return loadingPromise

  const config = getSupabaseConfig()
  if (!config) {
    throw new Error('Supabase is not configured')
  }

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`Supabase client load timed out after ${LOAD_TIMEOUT_MS}ms`)),
      LOAD_TIMEOUT_MS,
    ),
  )

  loadingPromise = Promise.race([
    import('@supabase/supabase-js').then(({ createClient }) => {
      loadedClient = createClient(config.url, config.anonKey, {
        auth: {
          // PKCE returns the session as `?code=` in the query string. The implicit flow
          // would return `#access_token=…` in the fragment, which the editor already
          // uses for #share= / #url= / #gist=. See utils/auth-return-url.ts.
          flowType: 'pkce',
          detectSessionInUrl: true,
          persistSession: true,
          autoRefreshToken: true,
          storageKey: AUTH_STORAGE_KEY,
        },
      })
      return loadedClient
    }),
    timeout,
  ]).finally(() => {
    // Clear so retry is possible after failure
    if (!loadedClient) loadingPromise = null
  }) as Promise<SupabaseClient>

  return loadingPromise
}

/** Test seam: drop the cached client. */
export function resetSupabaseClient(): void {
  loadedClient = null
  loadingPromise = null
}
