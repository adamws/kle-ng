/**
 * Keeping the GitHub OAuth token that Supabase hands over once and then forgets.
 *
 * Supabase returns the provider's own access token as `session.provider_token` on the
 * OAuth exchange, but — by design — never stores it and never refreshes it:
 *
 *   > Provider tokens are intentionally not stored in your project's database.
 *
 * A refreshed Supabase session therefore carries no `provider_token` at all, so an
 * application that wants to call GitHub later has to keep the token itself. That is all
 * this module does.
 *
 * **sessionStorage, not localStorage.** A `gist`-scoped token grants read and write over
 * the user's entire gist account, secret gists included — a far more valuable credential
 * than the Supabase JWT, which reaches only this app's own rows. Scoping it to the tab
 * bounds the damage of an XSS to the session the user is actually in, at the cost of a
 * re-authorization round trip in each new tab. See stores/gists.ts for that flow.
 *
 * Nothing here may import supabase-js: the auth store calls into it on a path that runs
 * for anonymous visitors too.
 */

/** sessionStorage key. Distinct from AUTH_STORAGE_KEY — supabase-js owns that one. */
export const GITHUB_TOKEN_STORAGE_KEY = 'kle-ng-github-token'

/** sessionStorage is unavailable in some privacy modes; never let that break sign-in. */
function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

interface StoredToken {
  userId: string
  token: string
}

/**
 * The token stored for `userId`, or null.
 *
 * Bound to the account it was issued for: signing out and back in as somebody else
 * reuses the same tab, and a token that outlived its owner would put one user's layout
 * in another user's gists. A mismatch reads as "no token" rather than as an error — the
 * caller's next step is the same either way.
 */
export function readGithubToken(userId: string): string | null {
  const storage = safeSessionStorage()
  if (!storage || !userId) return null

  let raw: string | null = null
  try {
    raw = storage.getItem(GITHUB_TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<StoredToken>
    if (parsed?.userId !== userId) return null
    return typeof parsed.token === 'string' && parsed.token ? parsed.token : null
  } catch {
    // Someone else's format, or a truncated write. Treat it as absent.
    return null
  }
}

export function writeGithubToken(userId: string, token: string): void {
  const storage = safeSessionStorage()
  if (!storage || !userId || !token) return
  try {
    storage.setItem(
      GITHUB_TOKEN_STORAGE_KEY,
      JSON.stringify({ userId, token } satisfies StoredToken),
    )
  } catch {
    // Quota or privacy mode. Degrades to "connect GitHub again", which is a working
    // path, so it is not worth failing the sign-in over.
  }
}

export function clearGithubToken(): void {
  const storage = safeSessionStorage()
  if (!storage) return
  try {
    storage.removeItem(GITHUB_TOKEN_STORAGE_KEY)
  } catch {
    // Nothing to do — the token is unreachable either way.
  }
}
