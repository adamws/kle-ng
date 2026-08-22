import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { GIST_API_URL, GistError, MAX_GIST_FILE_BYTES, createGist } from '../github-gists'

const TOKEN = 'gho_exampletoken'

const BASE = {
  token: TOKEN,
  filename: 'my-layout.json',
  content: '[["Q","W"]]',
}

/** Modelled on jsonResponse() in short-links.spec.ts. */
function jsonResponse(body: unknown, status = 201): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response
}

const CREATED = { id: 'abc123', html_url: 'https://gist.github.com/someone/abc123' }

describe('createGist', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('posts the file to the gists endpoint and returns the id and web URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(CREATED))
    vi.stubGlobal('fetch', fetchMock)

    await expect(createGist({ ...BASE, description: 'A layout' })).resolves.toEqual({
      id: 'abc123',
      htmlUrl: 'https://gist.github.com/someone/abc123',
    })

    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe(GIST_API_URL)
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe(`Bearer ${TOKEN}`)
    expect(init.headers.Accept).toBe('application/vnd.github+json')
    expect(init.headers['X-GitHub-Api-Version']).toBe('2022-11-28')
    // The bearer token is the whole authorisation; an ambient github.com cookie must not
    // be able to change whose account this writes to.
    expect(init.credentials).toBe('omit')
    expect(JSON.parse(init.body)).toEqual({
      description: 'A layout',
      public: false,
      files: { 'my-layout.json': { content: '[["Q","W"]]' } },
    })
  })

  it('creates a secret gist unless asked otherwise', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(CREATED))
    vi.stubGlobal('fetch', fetchMock)

    await createGist(BASE)
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).public).toBe(false)

    await createGist({ ...BASE, isPublic: true })
    expect(JSON.parse(fetchMock.mock.calls[1]![1].body).public).toBe(true)
  })

  it('sends an empty description rather than omitting the field', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(CREATED))
    vi.stubGlobal('fetch', fetchMock)

    await createGist(BASE)
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body).description).toBe('')
  })

  it('rejects without a token, before reaching the network', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    await expect(createGist({ ...BASE, token: '' })).rejects.toMatchObject({
      code: 'unauthorized',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // The API refuses a file of 1 MB or more. Caught locally so the message is about the
  // layout rather than a 422 about "files".
  it('rejects an oversized layout locally, without reaching the network', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const huge = 'x'.repeat(MAX_GIST_FILE_BYTES + 1)
    await expect(createGist({ ...BASE, content: huge })).rejects.toMatchObject({
      code: 'too-large',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  // Legends are not ASCII, so a character count would let a too-large file through.
  it('measures the size in bytes, not characters', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    // Three bytes per character, so half the character budget is over the byte budget.
    const multibyte = '€'.repeat(Math.ceil(MAX_GIST_FILE_BYTES / 2))
    expect(multibyte.length).toBeLessThan(MAX_GIST_FILE_BYTES)

    await expect(createGist({ ...BASE, content: multibyte })).rejects.toMatchObject({
      code: 'too-large',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    // A write that the token cannot see reads as a missing scope, not a missing resource.
    [404, 'forbidden'],
    [422, 'invalid'],
    [500, 'server'],
  ])('maps HTTP %i onto the %s code', async (status, code) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, status)))

    await expect(createGist(BASE)).rejects.toMatchObject({ code, status })
  })

  it('reports an unreachable network as retryable rather than as a server error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))

    const error = await createGist(BASE).catch((e) => e)
    expect(error).toBeInstanceOf(GistError)
    expect(error.code).toBe('network')
    // Own property rather than Error's `cause`: the tsconfig lib predates it.
    expect(error.reason).toBeInstanceOf(Error)
  })

  it('rejects a success response that is missing the fields it needs', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ id: 'abc123' })))

    await expect(createGist(BASE)).rejects.toMatchObject({ code: 'server' })
  })

  // fetch settles when the headers arrive, so the timeout has to cover the body read
  // too — otherwise a server that stalls mid-body leaves the modal spinning forever.
  it('aborts a stalled body read and reports it as a network failure', async () => {
    vi.useFakeTimers()
    try {
      let signal: AbortSignal | undefined
      vi.stubGlobal(
        'fetch',
        vi.fn(async (_url: string, init: RequestInit) => {
          signal = init.signal ?? undefined
          return {
            ok: true,
            status: 201,
            json: () =>
              new Promise((_resolve, reject) => {
                // Caught inline so the rejection is never briefly unhandled.
                signal?.addEventListener('abort', () => reject(new Error('aborted')))
              }),
          } as unknown as Response
        }),
      )

      const pending = createGist(BASE).catch((e) => e)
      await vi.advanceTimersByTimeAsync(15_000)

      const error = await pending
      expect(error).toBeInstanceOf(GistError)
      expect(error.code).toBe('network')
    } finally {
      vi.useRealTimers()
    }
  })

  // The token is the highest-value thing in this module. A thrown fetch can carry the
  // request, and the request carries the header, so nothing here may log the error raw.
  it('never writes the token to the console', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({}, 401)))

    await createGist(BASE).catch(() => {})

    const logged = (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .flat()
      .map((entry) => JSON.stringify(entry))
      .join(' ')
    expect(logged).not.toContain(TOKEN)
  })
})
