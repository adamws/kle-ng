/**
 * Supabase configuration for optional user accounts.
 *
 * Accounts are strictly additive: when VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are
 * unset, `isAuthConfigured()` returns false, every account feature hides, and
 * supabase-js is never loaded. The editor then behaves exactly as it does today.
 * This mirrors how `config/api.ts` gates the PCB generator on VITE_BACKEND_URL.
 *
 * The anon key is public by design — it identifies the project, it does not grant
 * access. Row level security is the security boundary. The service-role key must
 * never appear in this (or any other) client-side file.
 */

export interface SupabaseConfig {
  url: string
  anonKey: string
}

/**
 * Storage key for the persisted session.
 *
 * Set explicitly rather than relying on supabase-js's `sb-<project-ref>-auth-token`
 * default, so the auth store can cheaply probe localStorage for an existing session
 * without paying to load supabase-js first.
 */
export const AUTH_STORAGE_KEY = 'kle-ng-auth'

function readConfig(): SupabaseConfig | null {
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    return null
  }

  // Enforce HTTPS in production, matching getBackendUrl() in config/api.ts
  if (import.meta.env.PROD && url.startsWith('http://')) {
    console.error('Supabase URL must use HTTPS in production — accounts disabled')
    return null
  }

  return { url, anonKey }
}

let cachedConfig: SupabaseConfig | null | undefined

export function getSupabaseConfig(): SupabaseConfig | null {
  if (cachedConfig === undefined) {
    cachedConfig = readConfig()
  }
  return cachedConfig
}

export function isAuthConfigured(): boolean {
  return getSupabaseConfig() !== null
}

/**
 * Credentials of the account created by supabase/seed.sql on the local stack.
 * Deliberately not a secret — the local instance is disposable and unreachable
 * from anywhere else.
 */
export const LOCAL_TEST_USER = {
  email: 'dev@test.local',
  password: 'password123',
} as const

/** True when the configured project is a local Supabase stack. */
export function isLocalSupabase(): boolean {
  const config = getSupabaseConfig()
  if (!config) return false
  try {
    const { hostname } = new URL(config.url)
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
  } catch {
    return false
  }
}

/**
 * Whether the "continue as test user" shortcut may be offered.
 *
 * Requires BOTH a dev build and a local instance. `import.meta.env.DEV` is compiled
 * away in production, so the shortcut and its credentials cannot reach a shipped
 * bundle even if someone builds with a localhost URL configured.
 */
export function isTestSignInAvailable(): boolean {
  return import.meta.env.DEV && isLocalSupabase()
}

/** Test seam: forget the memoised config so stubbed env vars are re-read. */
export function resetSupabaseConfigCache(): void {
  cachedConfig = undefined
}
