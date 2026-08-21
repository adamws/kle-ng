import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { Keyboard } from '@adamws/kle-serial'

const mocks = vi.hoisted(() => ({
  resolveShortLinkPayload: vi.fn<(id: string) => Promise<string | null>>(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showInfo: vi.fn(),
}))

// The resolver has its own spec; what matters here is whether the dispatcher routes a
// URL to it at all, and with which id.
vi.mock('@/utils/short-links', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/short-links')>()),
  resolveShortLinkPayload: mocks.resolveShortLinkPayload,
}))

vi.mock('@/composables/useToast', () => ({
  toast: { showSuccess: mocks.showSuccess, showError: mocks.showError, showInfo: mocks.showInfo },
}))

import UrlImportModal from '../UrlImportModal.vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { encodeLayoutToUrl } from '@/utils/url-sharing'

const layoutPayload = () => {
  const keyboard = new Keyboard()
  keyboard.keys = []
  return encodeLayoutToUrl(keyboard)
}

/** Type the URL in and press Import, the way a user does. */
async function importUrl(url: string) {
  const wrapper = mount(UrlImportModal, { props: { isVisible: true } })
  await wrapper.find('#urlInput').setValue(url)
  await wrapper.find('.btn-primary').trigger('click')
  await new Promise((resolve) => setTimeout(resolve, 0))
  return wrapper
}

describe('UrlImportModal — short links', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    vi.stubGlobal('fetch', vi.fn())
    window.history.replaceState({}, '', '/')
  })

  it('imports a ?s= short link', async () => {
    mocks.resolveShortLinkPayload.mockResolvedValue(layoutPayload())

    await importUrl('https://editor.keyboard-tools.xyz/?s=7kQ2mBx9Lp')

    expect(mocks.resolveShortLinkPayload).toHaveBeenCalledWith('7kQ2mBx9Lp')
    expect(useKeyboardStore().filename).toBe('shared-layout')
    expect(mocks.showSuccess).toHaveBeenCalledWith(
      'Layout imported from share link',
      'Import Successful',
    )
    // The point of the fix: this used to be fetched as if it were a JSON file.
    expect(fetch).not.toHaveBeenCalled()
  })

  it('takes the short link over a fragment that came with it', async () => {
    // Matches startup, where `?s=` supersedes any layout-bearing fragment.
    mocks.resolveShortLinkPayload.mockResolvedValue(layoutPayload())

    await importUrl('https://editor.keyboard-tools.xyz/?s=7kQ2mBx9Lp#gist=abc123')

    expect(mocks.resolveShortLinkPayload).toHaveBeenCalledWith('7kQ2mBx9Lp')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('reports an unknown id without loading anything', async () => {
    mocks.resolveShortLinkPayload.mockResolvedValue(null)

    await importUrl('https://editor.keyboard-tools.xyz/?s=zzzzzzzzzz')

    expect(mocks.showError).toHaveBeenCalledWith(
      'That share link does not exist. Check that the whole link was copied.',
      'Import Failed',
    )
    expect(mocks.showSuccess).not.toHaveBeenCalled()
  })

  it('surfaces the resolver error for a build without accounts', async () => {
    mocks.resolveShortLinkPayload.mockRejectedValue(
      new Error('Short links are not available in this build.'),
    )

    await importUrl('https://editor.keyboard-tools.xyz/?s=7kQ2mBx9Lp')

    expect(mocks.showError).toHaveBeenCalledWith(
      'Short links are not available in this build.',
      'Import Failed',
    )
  })

  describe('does not claim a URL that only looks like one', () => {
    // Each of these imported fine before short links existed and has to keep doing so.
    // `?s=` is a common enough parameter that matching it alone would be a regression.
    it.each([
      ['a JSON file with an ?s= query', 'https://example.com/layouts/kbd.json?s=abcdefgh'],
      ['an id too short to be one', 'https://editor.keyboard-tools.xyz/?s=abc'],
      ['an id with characters ours never use', 'https://editor.keyboard-tools.xyz/?s=7kQ2-mBx9L'],
      ['a different parameter entirely', 'https://example.com/kbd?share=7kQ2mBx9Lp'],
    ])('%s', async (_label, url) => {
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        text: async () => '[["a"]]',
      } as unknown as Response)

      await importUrl(url)

      expect(mocks.resolveShortLinkPayload).not.toHaveBeenCalled()
      expect(fetch).toHaveBeenCalled()
    })
  })
})
