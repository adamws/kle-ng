import { defineStore } from 'pinia'
import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { createGist, GistError, MAX_GIST_FILE_BYTES } from '@/utils/github-gists'

/**
 * Gists Store
 *
 * Creation only, and nothing is kept: the gist lives in the user's own GitHub account,
 * so there is no list to cache, no id to remember and no server-side row anywhere. This
 * is the shape of stores/short-links.ts, minus the parts that only make sense for
 * something kle-ng owns.
 *
 * The GitHub token comes from the auth store, which captures it off the OAuth exchange —
 * see utils/github-token.ts. When there is none, `authorize()` sends the user through a
 * one-time consent round trip; sign-in itself never asks for gist access.
 */

/** Mirrors MAX_GIST_FILE_BYTES; exported so the modal can explain the failure early. */
export const GIST_TOO_LARGE = 'This layout is too large to put in a gist.'

/** sessionStorage flag: reopen the export modal after the authorization round trip. */
export const GIST_RESUME_KEY = 'kle-ng-gist-resume'

export interface CreateGistRequest {
  filename: string
  content: string
  description?: string
  isPublic?: boolean
}

/**
 * Turn a failure into something the user can act on.
 *
 * Unrecognised errors are logged rather than shown, matching stores/short-links.ts: a
 * raw upstream string in a dialog is worse than a vague one. Our own GistError always
 * carries a code, so it never falls through to that branch.
 */
function describeError(error: unknown, fallback: string): string {
  if (error instanceof GistError) {
    switch (error.code) {
      case 'unauthorized':
        return 'Your GitHub authorization has expired. Connect GitHub again to create a gist.'
      case 'forbidden':
        return 'GitHub declined the request — the gist permission may have been revoked, or you have hit a rate limit. Try connecting GitHub again.'
      case 'too-large':
        return GIST_TOO_LARGE
      case 'invalid':
        return 'GitHub rejected this layout. Check the file name and try again.'
      case 'network':
        return 'Could not reach GitHub. Check your connection and try again.'
      case 'server':
        return 'GitHub could not create the gist right now. Please try again.'
    }
  }

  if (error instanceof Error && error.message) return error.message

  if (error) console.error('Unrecognised gist error:', error)
  return fallback
}

export const useGistsStore = defineStore('gists', () => {
  const busy = ref(false)
  const errorMessage = ref<string | null>(null)
  /**
   * Set when the last failure was GitHub refusing the token. The modal reads it to go
   * back to its connect step instead of offering "try again" on a call that cannot
   * succeed until the user re-authorizes.
   */
  const needsAuthorization = ref(false)

  /**
   * Send the user to GitHub for the `gist` scope. Redirects away, so this resolves only
   * on failure.
   *
   * @param returnHref where to come back to — pass a `#share=` URL so unsaved work
   *   survives the round trip.
   */
  const authorize = async (returnHref?: string): Promise<void> => {
    const auth = useAuthStore()
    try {
      window.sessionStorage.setItem(GIST_RESUME_KEY, '1')
    } catch {
      // Privacy mode or quota. Costs the user one extra click on return, nothing more.
    }
    await auth.connectGithubGists(returnHref)
  }

  /**
   * Create a gist from the given file.
   *
   * @returns the gist's web URL, or null when it could not be created (see errorMessage)
   */
  const create = async (request: CreateGistRequest): Promise<string | null> => {
    // Cleared before the busy guard, for the reason stores/short-links.ts gives: the
    // caller renders errorMessage for any null, so a previous attempt's message must not
    // be reported as the reason a re-entrant call returned nothing.
    errorMessage.value = null
    needsAuthorization.value = false
    if (busy.value) return null

    const auth = useAuthStore()
    const token = auth.githubToken
    if (!token) {
      needsAuthorization.value = true
      errorMessage.value = 'Connect GitHub to create a gist.'
      return null
    }

    // Fast path only — createGist() checks MAX_GIST_FILE_BYTES itself, on bytes rather
    // than characters, and describeError() still translates the result.
    if (request.content.length > MAX_GIST_FILE_BYTES) {
      errorMessage.value = GIST_TOO_LARGE
      return null
    }

    busy.value = true
    try {
      const gist = await createGist({
        token,
        filename: request.filename,
        content: request.content,
        description: request.description,
        isPublic: request.isPublic,
      })
      return gist.htmlUrl
    } catch (error) {
      // Deliberately logs the code and status rather than the error object: a thrown
      // fetch failure can carry the request, and the request carries the token.
      const code = error instanceof GistError ? error.code : 'unknown'
      const status = error instanceof GistError ? error.status : undefined
      console.error('Error creating gist:', code, status ?? '')

      if (error instanceof GistError && error.code === 'unauthorized') {
        // The one place revocation is observable. See applySession() in stores/auth.ts
        // for why an absent provider_token must never be read the same way.
        auth.forgetGithubToken()
        needsAuthorization.value = true
      }
      errorMessage.value = describeError(error, 'Could not create a gist')
      return null
    } finally {
      busy.value = false
    }
  }

  /** Consume the flag set before an authorization redirect. */
  const takeResumeFlag = (): boolean => {
    try {
      const flag = window.sessionStorage.getItem(GIST_RESUME_KEY)
      window.sessionStorage.removeItem(GIST_RESUME_KEY)
      return flag === '1'
    } catch {
      return false
    }
  }

  /** Called on sign-out so the next user starts clean. */
  const reset = () => {
    busy.value = false
    errorMessage.value = null
    needsAuthorization.value = false
  }

  return {
    busy,
    errorMessage,
    needsAuthorization,
    authorize,
    create,
    takeResumeFlag,
    reset,
  }
})
