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
 *
 * Not exported: `getTestUser()` is the only way in, so callers cannot use these
 * without passing the gating below. `.env.local` is gitignored, so this stays
 * hardcoded to keep a fresh checkout working with no setup.
 */
const LOCAL_TEST_USER = {
  email: 'dev@test.local',
  password: 'password123',
} as const

/**
 * Host of the production project (see VITE_SUPABASE_URL in .env.production).
 *
 * Named here only so the test-user shortcut can refuse it outright: production is
 * the one database where a shared, publicly-readable password must never work,
 * whatever a build happens to inject. Keep in sync with .env.production.
 */
const PRODUCTION_SUPABASE_HOST = 'cdcvedgnkamejhhowach.supabase.co'

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
 * be offered.
 *
 * Two ways to get one, and production can have neither:
 *
 *   preview  VITE_TEST_USER_EMAIL / VITE_TEST_USER_PASSWORD, injected at build time
 *            by .github/workflows/vercel-preview.yml. One shared account on the
 *            preview project, so signed-in features are reachable from a preview
 *            URL without real GitHub sign-in. The password is compiled into that
 *            bundle and therefore public — which is why it is scoped to a database
 *            that holds nothing but throwaway data.
 *   local    the account seeded by supabase/seed.sql, in a dev build only.
 *
 * The production host is refused first and unconditionally. Everything else here
 * depends on build-time environment, and the one mistake worth being immune to is
 * a shared password reaching real users' data.
 */
export function getTestUser(): TestUserCredentials | null {
  const hostname = supabaseHostname()
  if (!hostname || hostname === PRODUCTION_SUPABASE_HOST) return null

  const email = import.meta.env.VITE_TEST_USER_EMAIL
  const password = import.meta.env.VITE_TEST_USER_PASSWORD
  if (email && password) {
    return { email, password, label: 'shared preview account' }
  }

  // `import.meta.env.DEV` is compiled away in production, so the seeded credentials
  // cannot reach a shipped bundle even if someone builds with a localhost URL.
  if (import.meta.env.DEV && isLocalSupabase()) {
    return { ...LOCAL_TEST_USER, label: 'local development' }
  }

  return null
}

/** Whether the "continue as test user" shortcut may be offered. */
export function isTestSignInAvailable(): boolean {
  return getTestUser() !== null
}

/** Test seam: forget the memoised config so stubbed env vars are re-read. */
export function resetSupabaseConfigCache(): void {
  cachedConfig = undefined
}
