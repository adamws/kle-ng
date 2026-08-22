import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  isAuthConfigured: vi.fn(() => true),
  getTestUser: vi.fn(() => null),
  getSupabaseClient: vi.fn(),
  createGist: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
}))

vi.mock('@/config/supabase', () => ({
  AUTH_STORAGE_KEY: 'kle-ng-auth',
  isAuthConfigured: mocks.isAuthConfigured,
  getTestUser: mocks.getTestUser,
}))
vi.mock('@/utils/supabase-loader', () => ({ getSupabaseClient: mocks.getSupabaseClient }))
vi.mock('@/composables/useToast', () => ({
  toast: { showError: mocks.showError, showSuccess: mocks.showSuccess },
}))
// Only the error mapping and the token handling are this store's business; the request
// itself is github-gists.spec.ts's problem.
vi.mock('@/utils/github-gists', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/github-gists')>()),
  createGist: mocks.createGist,
}))

import { GIST_RESUME_KEY, GIST_TOO_LARGE, useGistsStore } from '../gists'
import { useAuthStore } from '../auth'
import { GistError, MAX_GIST_FILE_BYTES } from '@/utils/github-gists'
import { writeGithubToken, readGithubToken } from '@/utils/github-token'

const USER_ID = 'user-a'
const TOKEN = 'gho_exampletoken'

const REQUEST = { filename: 'layout.json', content: '[["Q"]]' }

/** Signs a user in far enough for the store to find a token, with no network involved. */
function signInWithToken(token: string | null = TOKEN) {
  const auth = useAuthStore()
  auth.user = { id: USER_ID, email: 'a@example.com', name: 'a', avatarUrl: '' }
  if (token) {
    writeGithubToken(USER_ID, token)
    auth.githubToken = token
  } else {
    auth.githubToken = null
  }
  return auth
}

describe('Gists Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    window.sessionStorage.clear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('creates a gist and returns its web URL', async () => {
    signInWithToken()
    mocks.createGist.mockResolvedValue({ id: 'abc', htmlUrl: 'https://gist.github.com/a/abc' })
    const store = useGistsStore()

    await expect(store.create({ ...REQUEST, description: 'hi', isPublic: true })).resolves.toBe(
      'https://gist.github.com/a/abc',
    )
    expect(mocks.createGist).toHaveBeenCalledWith({
      token: TOKEN,
      filename: 'layout.json',
      content: '[["Q"]]',
      description: 'hi',
      isPublic: true,
    })
    expect(store.errorMessage).toBeNull()
    expect(store.busy).toBe(false)
  })

  it('asks for authorization instead of calling GitHub when there is no token', async () => {
    signInWithToken(null)
    const store = useGistsStore()

    await expect(store.create(REQUEST)).resolves.toBeNull()
    expect(mocks.createGist).not.toHaveBeenCalled()
    expect(store.needsAuthorization).toBe(true)
  })

  it('rejects an oversized layout locally, without calling GitHub', async () => {
    signInWithToken()
    const store = useGistsStore()

    await expect(
      store.create({ ...REQUEST, content: 'x'.repeat(MAX_GIST_FILE_BYTES + 1) }),
    ).resolves.toBeNull()
    expect(mocks.createGist).not.toHaveBeenCalled()
    expect(store.errorMessage).toBe(GIST_TOO_LARGE)
  })

  // The one place a revoked token is observable. An absent provider_token on a refreshed
  // session must NOT be treated this way — see the auth store.
  it('discards the token on a 401 and sends the user back to the connect step', async () => {
    const auth = signInWithToken()
    mocks.createGist.mockRejectedValue(new GistError('unauthorized', 'nope', undefined, 401))
    const store = useGistsStore()

    await expect(store.create(REQUEST)).resolves.toBeNull()
    expect(auth.githubToken).toBeNull()
    expect(readGithubToken(USER_ID)).toBeNull()
    expect(store.needsAuthorization).toBe(true)
    expect(store.errorMessage).toContain('Connect GitHub again')
  })

  // A 403 is as likely to be a rate limit as a missing scope, and throwing away a good
  // token over a rate limit would cost the user a pointless round trip.
  it('keeps the token on a 403', async () => {
    const auth = signInWithToken()
    mocks.createGist.mockRejectedValue(new GistError('forbidden', 'nope', undefined, 403))
    const store = useGistsStore()

    await store.create(REQUEST)
    expect(auth.githubToken).toBe(TOKEN)
    expect(store.errorMessage).toContain('GitHub declined the request')
  })

  it.each([
    ['too-large', GIST_TOO_LARGE],
    ['invalid', 'GitHub rejected this layout'],
    ['network', 'Could not reach GitHub'],
    ['server', 'GitHub could not create the gist'],
  ] as const)('describes the %s failure', async (code, expected) => {
    signInWithToken()
    mocks.createGist.mockRejectedValue(new GistError(code, 'raw'))
    const store = useGistsStore()

    await store.create(REQUEST)
    expect(store.errorMessage).toContain(expected)
  })

  it('falls back to a generic message for an unrecognised failure, and logs it', async () => {
    signInWithToken()
    mocks.createGist.mockRejectedValue({ weird: true })
    const store = useGistsStore()

    await store.create(REQUEST)
    expect(store.errorMessage).toBe('Could not create a gist')
    expect(console.error).toHaveBeenCalled()
  })

  it('clears a previous error before the busy guard, so a re-entrant call explains nothing stale', async () => {
    signInWithToken()
    mocks.createGist.mockRejectedValueOnce(new GistError('network', 'nope'))
    const store = useGistsStore()

    await store.create(REQUEST)
    expect(store.errorMessage).not.toBeNull()

    store.busy = true
    await expect(store.create(REQUEST)).resolves.toBeNull()
    expect(store.errorMessage).toBeNull()
  })

  it('sets busy for the duration of the call', async () => {
    signInWithToken()
    let release: (value: unknown) => void = () => {}
    mocks.createGist.mockReturnValue(new Promise((resolve) => (release = resolve)))
    const store = useGistsStore()

    const pending = store.create(REQUEST)
    expect(store.busy).toBe(true)
    release({ id: 'abc', htmlUrl: 'https://gist.github.com/a/abc' })
    await pending
    expect(store.busy).toBe(false)
  })

  it('flags the export for resuming before redirecting to GitHub', async () => {
    const auth = signInWithToken(null)
    const connect = vi.spyOn(auth, 'connectGithubGists').mockResolvedValue(undefined)
    const store = useGistsStore()

    await store.authorize('https://editor.example/#share=abc')

    expect(window.sessionStorage.getItem(GIST_RESUME_KEY)).toBe('1')
    expect(connect).toHaveBeenCalledWith('https://editor.example/#share=abc')
  })

  it('consumes the resume flag exactly once', () => {
    const store = useGistsStore()
    window.sessionStorage.setItem(GIST_RESUME_KEY, '1')

    expect(store.takeResumeFlag()).toBe(true)
    expect(store.takeResumeFlag()).toBe(false)
  })

  it('resets on sign-out', async () => {
    signInWithToken()
    mocks.createGist.mockRejectedValue(new GistError('network', 'nope'))
    const store = useGistsStore()

    await store.create(REQUEST)
    store.reset()

    expect(store.errorMessage).toBeNull()
    expect(store.busy).toBe(false)
    expect(store.needsAuthorization).toBe(false)
  })
})
