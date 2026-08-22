import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  GITHUB_TOKEN_STORAGE_KEY,
  clearGithubToken,
  readGithubToken,
  writeGithubToken,
} from '../github-token'

const USER = 'user-a'
const OTHER = 'user-b'
const TOKEN = 'gho_exampletoken'

describe('github-token', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('round-trips a token for the user it was stored against', () => {
    writeGithubToken(USER, TOKEN)
    expect(readGithubToken(USER)).toBe(TOKEN)
  })

  it('uses its own key, distinct from the supabase session', () => {
    writeGithubToken(USER, TOKEN)
    expect(GITHUB_TOKEN_STORAGE_KEY).toBe('kle-ng-github-token')
    expect(window.sessionStorage.getItem(GITHUB_TOKEN_STORAGE_KEY)).toContain(TOKEN)
  })

  // The tab outlives the session: signing out and back in as somebody else must not
  // hand the second user the first user's GitHub account.
  it('does not return a token stored for a different user', () => {
    writeGithubToken(USER, TOKEN)
    expect(readGithubToken(OTHER)).toBeNull()
  })

  it('returns null when nothing is stored', () => {
    expect(readGithubToken(USER)).toBeNull()
  })

  it('returns null for an empty user id, without reading storage', () => {
    writeGithubToken(USER, TOKEN)
    expect(readGithubToken('')).toBeNull()
  })

  it('clears the token', () => {
    writeGithubToken(USER, TOKEN)
    clearGithubToken()
    expect(readGithubToken(USER)).toBeNull()
    expect(window.sessionStorage.getItem(GITHUB_TOKEN_STORAGE_KEY)).toBeNull()
  })

  it('ignores a stored value in some other format rather than throwing', () => {
    window.sessionStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, 'not json')
    expect(readGithubToken(USER)).toBeNull()
  })

  it('ignores a stored entry with no token', () => {
    window.sessionStorage.setItem(GITHUB_TOKEN_STORAGE_KEY, JSON.stringify({ userId: USER }))
    expect(readGithubToken(USER)).toBeNull()
  })

  it('writes nothing for an empty user id or an empty token', () => {
    writeGithubToken('', TOKEN)
    writeGithubToken(USER, '')
    expect(window.sessionStorage.getItem(GITHUB_TOKEN_STORAGE_KEY)).toBeNull()
  })

  // Privacy modes make sessionStorage throw on access. Sign-in must survive that; the
  // user simply gets asked to connect GitHub again.
  it('degrades silently when sessionStorage throws', () => {
    const boom = () => {
      throw new Error('SecurityError')
    }
    // Spied on the prototype, not the instance: jsdom's Storage proxies own-property
    // access, so a spy installed directly on `window.sessionStorage` is never called.
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(boom)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(boom)
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(boom)

    expect(() => writeGithubToken(USER, TOKEN)).not.toThrow()
    expect(readGithubToken(USER)).toBeNull()
    expect(() => clearGithubToken()).not.toThrow()
  })
})
