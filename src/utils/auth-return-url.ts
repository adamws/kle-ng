/**
 * Preserving the editor's URL across an OAuth redirect.
 *
 * The editor carries state in the URL *fragment* — `#share=`, `#url=`, `#gist=` — and a
 * fragment does not survive an OAuth round trip: providers redirect to an exact
 * registered URL, and the fragment is dropped along the way. So the location is stashed
 * before leaving for the provider and the fragment is put back the instant we return.
 *
 * `restoreReturnUrl()` runs from main.ts *before* the app is created, so the keyboard
 * store observes the restored fragment during its normal startup path
 * (`processCurrentUrl()`) and needs no knowledge of auth.
 *
 * The PKCE `?code=` query is deliberately left in place — supabase-js needs it to
 * exchange the session, and the auth store strips it once that has happened. This is
 * also why the PKCE flow is mandatory here: the implicit flow returns the session as
 * `#access_token=…` in the fragment, which would collide head-on with `#share=`.
 */

const RETURN_KEY = 'kle-ng-auth-return'

/** Query parameters an OAuth provider or Supabase may append on the way back. */
const AUTH_PARAMS = ['code', 'state', 'error', 'error_code', 'error_description'] as const

/** sessionStorage is unavailable in some privacy modes; never let that break sign-in. */
function safeSessionStorage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

/**
 * Remember where the user was, immediately before redirecting to an OAuth provider.
 */
export function captureReturnUrl(href: string = window.location.href): void {
  const storage = safeSessionStorage()
  if (!storage) return
  try {
    storage.setItem(RETURN_KEY, href)
  } catch {
    // Quota or privacy mode — the fragment is lost, which degrades to "signed in on a
    // blank editor". Not worth failing the sign-in over.
  }
}

/**
 * True when the current URL looks like an OAuth callback.
 */
export function hasAuthCallbackParams(search: string = window.location.search): boolean {
  const params = new URLSearchParams(search)
  return params.has('code') || params.has('error')
}

/**
 * Restore the fragment saved by `captureReturnUrl()`.
 *
 * No-op unless this really is an OAuth callback, so a normal page load never touches
 * history. The current query string is preserved untouched (it still holds `?code=`);
 * only the fragment is reinstated, and only when the current URL has none of its own.
 */
export function restoreReturnUrl(): void {
  if (typeof window === 'undefined') return
  if (!hasAuthCallbackParams()) return

  const storage = safeSessionStorage()
  if (!storage) return

  let saved: string | null = null
  try {
    saved = storage.getItem(RETURN_KEY)
    storage.removeItem(RETURN_KEY)
  } catch {
    return
  }
  if (!saved) return

  let savedHash = ''
  try {
    savedHash = new URL(saved, window.location.href).hash
  } catch {
    return
  }

  // Nothing to restore, or the callback already carries a fragment of its own.
  if (!savedHash || savedHash === '#' || window.location.hash) return

  window.history.replaceState(
    {},
    '',
    `${window.location.pathname}${window.location.search}${savedHash}`,
  )
}

/**
 * Drop the OAuth parameters from the address bar once the session exchange is done,
 * preserving every other query parameter and the fragment.
 */
export function clearAuthParamsFromUrl(): void {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  let changed = false
  for (const param of AUTH_PARAMS) {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param)
      changed = true
    }
  }
  if (!changed) return

  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

/**
 * Read the OAuth error the provider sent back, if any.
 */
export function readAuthCallbackError(search: string = window.location.search): string | null {
  const params = new URLSearchParams(search)
  if (!params.has('error')) return null
  return params.get('error_description') || params.get('error') || 'Sign-in failed'
}
