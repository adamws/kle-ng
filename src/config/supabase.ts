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
  const rawUrl = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

  if (!rawUrl || !anonKey) {
    return null
  }

  // Normalise once, here, so every consumer gets the same base. supabase-js tolerates a
  // trailing slash because it builds endpoints with `new URL('rest/v1', base)`, but
  // utils/short-links.ts concatenates this string directly, where a trailing slash
  // yields `//rest/v1/...` — a path the gateway does not route.
  const url = rawUrl.trim().replace(/\/+$/, '')

  if (!url) {
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
 *
 * Not exported: `getTestUser()` is the only way in, so callers cannot use these
 * without passing the gating below. These are the only test credentials that exist
 * now, and they are hardcoded to keep a fresh checkout working with no setup.
 */
const LOCAL_TEST_USER = {
  email: 'dev@test.local',
  password: 'password123',
} as const

/** Hostname of the configured project, or null when unconfigured/unparseable. */
function supabaseHostname(): string | null {
  const config = getSupabaseConfig()
  if (!config) return null
  try {
    return new URL(config.url).hostname
  } catch {
    return null
  }
}

/** True when the configured project is a local Supabase stack. */
export function isLocalSupabase(): boolean {
  const hostname = supabaseHostname()
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]'
}

/** A password account the editor may sign into without an OAuth round trip. */
export interface TestUserCredentials {
  email: string
  password: string
  /** Sub-label shown under the menu item, e.g. 'local development'. */
  label: string
}

/**
 * Credentials for the "continue as test user" shortcut, or null when it must not
 * be offered — which is everywhere but a dev build against a local stack.
 *
 * Preview deployments used to get a shared password account of their own, compiled
 * in from VITE_TEST_USER_EMAIL / VITE_TEST_USER_PASSWORD. It was removed: the preview
 * project has password sign-in disabled, so `signInWithPassword` fails there whether
 * or not the account exists, and a shortcut that cannot work is worse than no
 * shortcut. Preview signs in with GitHub, the same way production does.
 *
 * `import.meta.env.DEV` is compiled away in production, so the seeded credentials
 * cannot reach a shipped bundle even if someone builds with a localhost URL — and
 * `isLocalSupabase()` means no hosted project can ever match, production included.
 */
export function getTestUser(): TestUserCredentials | null {
  if (import.meta.env.DEV && isLocalSupabase()) {
    return { ...LOCAL_TEST_USER, label: 'local development' }
  }

  return null
}

/** Test seam: forget the memoised config so stubbed env vars are re-read. */
export function resetSupabaseConfigCache(): void {
  cachedConfig = undefined
}
