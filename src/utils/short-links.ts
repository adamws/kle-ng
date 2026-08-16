/**
 * Short share links — `https://editor.keyboard-tools.xyz/?s=<id>`.
 *
 * A short link is a pointer to an lz-string compressed layout stored in Supabase. Only
 * signed-in users can create one (see stores/short-links.ts); anybody can open one,
 * which is what this module is mostly about. The id is random rather than derived from
 * the layout — deduplication happens server-side on a hash of the payload — so holding
 * a layout tells you nothing about whether it has been shared.
 *
 * Resolution is a raw `fetch` against PostgREST rather than a supabase-js call, and
 * deliberately so: opening a short link is the most common action an *anonymous*
 * visitor takes here, and the auth design's headline property is that a logged-out
 * visitor never downloads supabase-js (~40-50 KB) at all. Loading a client library to
 * send one POST with two headers would be the first thing to break it. Nothing in this
 * file may import `@supabase/supabase-js`, not even lazily.
 *
 * A query parameter rather than a fragment: unlike `#share=`, `?s=` is visible to a
 * server, which leaves room for per-link social previews later. See
 * supabase/migrations/20260816120000_short_links.sql for the storage side.
 */

import { getSupabaseConfig } from '@/config/supabase'

/** Query parameter carrying a short link id. */
export const SHORT_LINK_PARAM = 's'

/** Mirrors the short_links_payload_length constraint in the migration. */
export const MAX_SHORT_LINK_PAYLOAD_LENGTH = 32768

const RESOLVE_TIMEOUT_MS = 15_000

/**
 * Ids are random base62, so the character class is closed and no percent-encoding is
 * ever needed on either side. The server emits exactly 10 characters; the range mirrors
 * the short_links_id_format constraint, which leaves room to lengthen ids later.
 */
const SHORT_LINK_ID_PATTERN = /^[0-9A-Za-z]{8,32}$/

export type ShortLinkFailure = 'unconfigured' | 'invalid-id' | 'network' | 'server'

/** Carries a user-presentable message; every branch below sets one. */
export class ShortLinkError extends Error {
  readonly code: ShortLinkFailure
  /** The original failure, where there was one. Own property: the tsconfig lib
   *  predates Error's `cause` constructor option. */
  readonly reason?: unknown
  /** HTTP status, for `code === 'server'` only. Decides retryability — see isRetryable(). */
  readonly status?: number

  constructor(code: ShortLinkFailure, message: string, reason?: unknown, status?: number) {
    super(message)
    this.name = 'ShortLinkError'
    this.code = code
    this.reason = reason
    this.status = status
  }
}

/**
 * Whether reloading the page could plausibly turn this failure into a success.
 *
 * An allowlist of retryable codes rather than a blocklist of permanent ones, because the
 * cost of the two mistakes is not symmetric. Treating a permanent failure as retryable
 * puts an id back in the address bar that can never resolve, so every reload re-shows
 * the same error — and a code added later would inherit that behaviour by default.
 *
 * `unconfigured` is the case that makes the point: it reads like a server problem, but
 * it means VITE_SUPABASE_* were absent when this bundle was built, so it is as permanent
 * as a malformed id.
 */
function isRetryable(error: ShortLinkError): boolean {
  switch (error.code) {
    case 'network':
      return true
    // A 5xx may well pass on the next attempt. A 404 (migration not pushed to this
    // project) or a 401/403 (EXECUTE grant revoked, wrong anon key) describes the
    // deployment, and will be just as true after a reload.
    case 'server':
      return error.status === undefined || error.status >= 500
    default:
      return false
  }
}

export function isValidShortLinkId(id: string): boolean {
  return SHORT_LINK_ID_PATTERN.test(id)
}

/** `${origin}${pathname}?s=<id>`, matching generateShareableUrl()'s base handling. */
export function buildShortLinkUrl(id: string, baseUrl?: string): string {
  const base = baseUrl || window.location.origin + window.location.pathname
  return `${base}?${SHORT_LINK_PARAM}=${id}`
}

/**
 * Remove `?s=` while preserving every other query parameter and the fragment.
 *
 * Modelled on clearAuthParamsFromUrl(), *not* on clearShareFromUrl(): the latter drops
 * the whole fragment, which would destroy a `#share=` or `#url=` that restoreReturnUrl()
 * had just put back.
 */
export function clearShortLinkFromUrl(): void {
  if (typeof window === 'undefined') return

  const url = new URL(window.location.href)
  if (!url.searchParams.has(SHORT_LINK_PARAM)) return

  url.searchParams.delete(SHORT_LINK_PARAM)
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

/**
 * Put `?s=` back when `error` is worth another attempt.
 *
 * The id is consumed before the network call, so without this a transient failure
 * leaves nothing to reload — and reloading is exactly what a user does when told the
 * share link service could not be reached. Permanent failures stay out of the address
 * bar, since a reload could only reproduce them: see isRetryable().
 */
export function restoreShortLinkOnFailure(id: string, error: unknown): void {
  if (typeof window === 'undefined') return
  if (!(error instanceof ShortLinkError) || !isRetryable(error)) return

  const url = new URL(window.location.href)
  if (url.searchParams.get(SHORT_LINK_PARAM) === id) return

  url.searchParams.set(SHORT_LINK_PARAM, id)
  window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`)
}

/**
 * Read the `?s=` id and remove it from the address bar in the same tick.
 *
 * Callers must do this synchronously, before any await: signInWithOAuth() redirects to
 * `origin + pathname` — dropping the query — and restoreReturnUrl() puts back only the
 * fragment, so an id left sitting in the bar would be lost to a sign-in.
 */
export function takeShortLinkIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null

  const id = new URL(window.location.href).searchParams.get(SHORT_LINK_PARAM)
  if (id === null) return null

  // Strip even an invalid id: it has been seen, and leaving it in place would make a
  // reload retry a URL that cannot work.
  clearShortLinkFromUrl()
  return id
}

/**
 * Resolve a short link id to its compressed payload.
 *
 * @returns the payload, or null when no link with that id exists
 * @throws ShortLinkError for anything else; its message is user-presentable
 */
export async function resolveShortLinkPayload(id: string): Promise<string | null> {
  if (!isValidShortLinkId(id)) {
    throw new ShortLinkError('invalid-id', 'That is not a valid share link.')
  }

  const config = getSupabaseConfig()
  if (!config) {
    // Unconfigured build: short links need a server and there is none. Distinct from
    // "not found" so the message can say so.
    throw new ShortLinkError('unconfigured', 'Short links are not available in this build.')
  }

  // Explicit AbortController rather than AbortSignal.timeout(): mirrors the explicit
  // timeout in supabase-loader.ts and does not depend on a jsdom polyfill in tests.
  //
  // The timer is cleared in a finally around *both* awaits, not just the fetch. `fetch`
  // settles once the response headers arrive, so clearing it there would leave the body
  // read unbounded: a server that returns headers and then stalls would hang
  // initWithSample() forever, with the loading toast (duration: 0) never cleared and
  // neither the short link nor the fallback sample layout ever loading. The budget is
  // therefore for the whole exchange, headers and body together.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), RESOLVE_TIMEOUT_MS)

  try {
    let response: Response
    try {
      response = await fetch(`${config.url}/rest/v1/rpc/resolve_short_link`, {
        method: 'POST',
        headers: {
          // PostgREST needs both: `apikey` selects the project, `Authorization` selects
          // the role. The anon key is public by design — it identifies, it does not
          // grant; the `anon` EXECUTE grant on resolve_short_link is what authorises.
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ link_id: id }),
        // No cookies: this is a plain public read and must not depend on ambient state.
        credentials: 'omit',
        signal: controller.signal,
      })
    } catch (error) {
      throw new ShortLinkError('network', 'Could not reach the share link service.', error)
    }

    if (!response.ok) {
      // A 404 here means the *function* is missing (the migration was not pushed to this
      // project), not that the link is unknown — an unknown link is a 200 with a null body.
      throw new ShortLinkError(
        'server',
        response.status === 404
          ? 'Short links are not available on this server yet.'
          : `The share link service returned ${response.status}.`,
        undefined,
        response.status,
      )
    }

    // A PostgREST RPC on a scalar-returning function responds with the bare JSON value:
    // the payload as a JSON string, or literally `null` for an unknown id. It is NOT
    // wrapped in an object or an array, and an unknown id is NOT a 404.
    let body: unknown
    try {
      body = await response.json()
    } catch (error) {
      // A stalled body aborts here rather than in the fetch above, and that is a failed
      // exchange, not malformed JSON — report it as such so it stays retryable.
      if (controller.signal.aborted) {
        throw new ShortLinkError('network', 'Could not reach the share link service.', error)
      }
      body = undefined
    }

    if (body === null) return null
    if (typeof body !== 'string') {
      throw new ShortLinkError('server', 'The share link service returned something unexpected.')
    }
    return body
  } finally {
    clearTimeout(timer)
  }
}
