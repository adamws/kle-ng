/**
 * Creating a gist in the signed-in user's own GitHub account.
 *
 * The counterpart to fetchGistLayout() in url-sharing.ts, which reads a gist
 * anonymously. Writing needs the user's GitHub token — see utils/github-token.ts for
 * where that comes from and why it is kept the way it is.
 *
 * A raw `fetch` against api.github.com, which is CORS-enabled for this endpoint, so no
 * proxy and no server-side component is involved: the layout goes from the browser to
 * the user's account and nowhere else. Unlike a short link, the artifact belongs to the
 * user — they can edit or delete it, and kle-ng stores nothing.
 *
 * Nothing in this file may import supabase-js. The token arrives as a parameter
 * precisely so this module knows nothing about sessions.
 */

export const GIST_API_URL = 'https://api.github.com/gists'

/**
 * The API refuses to create a file of 1 MB or more (larger gists have to be pushed over
 * git, which a browser cannot do). Checked locally so an oversized layout fails
 * immediately with a message about the layout rather than a 422 about "files".
 */
export const MAX_GIST_FILE_BYTES = 900_000

const CREATE_TIMEOUT_MS = 15_000

export type GistFailure =
  /** 401 — the token was revoked or is no longer valid. The caller must discard it. */
  | 'unauthorized'
  /** 403 — the `gist` scope is missing, or a rate/abuse limit was hit. */
  | 'forbidden'
  /** Local guard: the layout exceeds MAX_GIST_FILE_BYTES. */
  | 'too-large'
  /** 422 — GitHub rejected the request body. */
  | 'invalid'
  | 'network'
  | 'server'

/** Carries a user-presentable message; every branch below sets one. */
export class GistError extends Error {
  readonly code: GistFailure
  /** The original failure, where there was one. Own property: the tsconfig lib
   *  predates Error's `cause` constructor option. */
  readonly reason?: unknown
  /** HTTP status, for the codes that came from a response. */
  readonly status?: number

  constructor(code: GistFailure, message: string, reason?: unknown, status?: number) {
    super(message)
    this.name = 'GistError'
    this.code = code
    this.reason = reason
    this.status = status
  }
}

export interface CreateGistOptions {
  /** GitHub OAuth token carrying the `gist` scope. Never logged, never persisted here. */
  token: string
  /** File name inside the gist, e.g. `my-layout.json`. */
  filename: string
  content: string
  description?: string
  /** Defaults to false — a secret gist, unlisted but readable by anyone with the URL. */
  isPublic?: boolean
}

export interface CreatedGist {
  id: string
  htmlUrl: string
}

/** Byte length, because GitHub's limit is on bytes and layouts carry non-ASCII legends. */
function byteLength(value: string): number {
  return new TextEncoder().encode(value).length
}

/**
 * Create a gist and return its id and web URL.
 *
 * @throws GistError — always, on every failure path, so callers have one shape to map.
 */
export async function createGist(options: CreateGistOptions): Promise<CreatedGist> {
  const { token, filename, content, description, isPublic = false } = options

  if (!token) {
    throw new GistError('unauthorized', 'Not connected to GitHub.')
  }
  if (byteLength(content) > MAX_GIST_FILE_BYTES) {
    throw new GistError('too-large', 'This layout is too large to put in a gist.')
  }

  // Explicit AbortController rather than AbortSignal.timeout(), matching short-links.ts:
  // it does not depend on a jsdom polyfill in tests. The timer is cleared around *both*
  // awaits — `fetch` settles when the headers arrive, so a server that then stalls on
  // the body would otherwise leave the modal spinning forever.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CREATE_TIMEOUT_MS)

  try {
    let response: Response
    try {
      response = await fetch(GIST_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: description ?? '',
          public: isPublic,
          files: { [filename]: { content } },
        }),
        // No cookies: the bearer token is the whole authorisation, and an ambient
        // github.com session must not be able to change whose account this writes to.
        credentials: 'omit',
        signal: controller.signal,
      })
    } catch (error) {
      throw new GistError('network', 'Could not reach GitHub.', error)
    }

    if (!response.ok) {
      throw describeResponse(response)
    }

    let body: unknown
    try {
      body = await response.json()
    } catch (error) {
      // A stalled body aborts here rather than in the fetch above. That is a failed
      // exchange, not malformed JSON.
      if (controller.signal.aborted) {
        throw new GistError('network', 'Could not reach GitHub.', error)
      }
      throw new GistError('server', 'GitHub returned something unexpected.', error)
    }

    const gist = body as { id?: unknown; html_url?: unknown }
    if (typeof gist?.id !== 'string' || typeof gist?.html_url !== 'string') {
      throw new GistError('server', 'GitHub returned something unexpected.')
    }

    return { id: gist.id, htmlUrl: gist.html_url }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Map a failed response onto a code.
 *
 * 403 covers two very different situations — a token without the `gist` scope, and a
 * secondary rate limit — and GitHub does not always distinguish them in a way worth
 * parsing. They collapse into one message that names both, because the user's next
 * step (reconnect, or wait) is cheap to try either way. Only 401 is treated as "discard
 * the token": a 403 from a rate limit would otherwise throw away a perfectly good one.
 */
function describeResponse(response: Response): GistError {
  switch (response.status) {
    case 401:
      return new GistError(
        'unauthorized',
        'Your GitHub authorization is no longer valid.',
        undefined,
        401,
      )
    case 403:
    // 404 on a write with a bearer token means "not visible to this token", which for
    // this endpoint is a missing scope rather than a missing resource.
    case 404:
      return new GistError('forbidden', 'GitHub declined the request.', undefined, response.status)
    case 422:
      return new GistError('invalid', 'GitHub rejected this layout.', undefined, 422)
    default:
      return new GistError(
        'server',
        `GitHub returned ${response.status}.`,
        undefined,
        response.status,
      )
  }
}
