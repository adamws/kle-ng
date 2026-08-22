import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

const mocks = vi.hoisted(() => ({
  isAuthConfigured: vi.fn(() => true),
  getTestUser: vi.fn(() => null),
  isLocalSupabase: vi.fn(() => false),
  getSupabaseClient: vi.fn(),
  showError: vi.fn(),
  showSuccess: vi.fn(),
  showInfo: vi.fn(),
}))

vi.mock('@/config/supabase', () => ({
  AUTH_STORAGE_KEY: 'kle-ng-auth',
  isAuthConfigured: mocks.isAuthConfigured,
  getTestUser: mocks.getTestUser,
  isLocalSupabase: mocks.isLocalSupabase,
}))
vi.mock('@/utils/supabase-loader', () => ({ getSupabaseClient: mocks.getSupabaseClient }))
vi.mock('@/composables/useToast', () => ({
  toast: { showError: mocks.showError, showSuccess: mocks.showSuccess, showInfo: mocks.showInfo },
}))

import GistExportModal from '../GistExportModal.vue'
import { useAuthStore } from '@/stores/auth'
import { useGistsStore } from '@/stores/gists'
import { useKeyboardStore } from '@/stores/keyboard'

const GIST_URL = 'https://gist.github.com/someone/abc123'

/**
 * Mounts the modal already open, with the stores seeded directly — nothing here should
 * reach Supabase or GitHub.
 */
const mountModal = ({ hasToken = true }: { hasToken?: boolean } = {}) => {
  const pinia = createPinia()
  setActivePinia(pinia)

  const auth = useAuthStore()
  auth.user = { id: 'user-1', email: 'a@example.com', name: 'adamws', avatarUrl: '' }
  auth.githubToken = hasToken ? 'gho_token' : null

  const gists = useGistsStore()
  const create = vi.spyOn(gists, 'create').mockResolvedValue(GIST_URL)
  const authorize = vi.spyOn(gists, 'authorize').mockResolvedValue(undefined)

  const keyboard = useKeyboardStore()

  const wrapper = mount(GistExportModal, {
    props: { isVisible: true },
    global: { plugins: [pinia] },
  })

  return { wrapper, auth, gists, keyboard, create, authorize }
}

describe('GistExportModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.sessionStorage.clear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('prefills the file name the way Export → Download JSON names its file', async () => {
    const { wrapper, keyboard } = mountModal()
    keyboard.filename = 'my-board'
    await wrapper.setProps({ isVisible: false })
    await wrapper.setProps({ isVisible: true })

    expect((wrapper.get('[data-testid="gist-filename"]').element as HTMLInputElement).value).toBe(
      'my-board.json',
    )
  })

  it('falls back to the layout metadata name, then to a generic one', async () => {
    const { wrapper, keyboard } = mountModal()

    keyboard.filename = ''
    keyboard.metadata.name = 'Planck'
    await wrapper.setProps({ isVisible: false })
    await wrapper.setProps({ isVisible: true })
    expect((wrapper.get('[data-testid="gist-filename"]').element as HTMLInputElement).value).toBe(
      'Planck.json',
    )

    keyboard.metadata.name = ''
    await wrapper.setProps({ isVisible: false })
    await wrapper.setProps({ isVisible: true })
    expect((wrapper.get('[data-testid="gist-filename"]').element as HTMLInputElement).value).toBe(
      'keyboard-layout.json',
    )
  })

  it('defaults to a secret gist', () => {
    const { wrapper } = mountModal()

    expect((wrapper.get('[data-testid="gist-secret"]').element as HTMLInputElement).checked).toBe(
      true,
    )
    expect((wrapper.get('[data-testid="gist-public"]').element as HTMLInputElement).checked).toBe(
      false,
    )
  })

  it('opens on the connect step when there is no GitHub token', () => {
    const { wrapper } = mountModal({ hasToken: false })

    expect(wrapper.find('[data-testid="gist-connect"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="gist-confirm"]').exists()).toBe(false)
  })

  // There is no autosave, so the redirect has to carry the layout in the fragment or
  // the user's unsaved work does not come back with them.
  it('carries the current layout across the authorization redirect', async () => {
    const { wrapper, keyboard, authorize } = mountModal({ hasToken: false })
    vi.spyOn(keyboard, 'generateShareUrl').mockReturnValue('https://editor.example/#share=abc')

    await wrapper.get('[data-testid="gist-connect"]').trigger('click')

    expect(authorize).toHaveBeenCalledWith('https://editor.example/#share=abc')
  })

  it('creates the gist from the form and shows the returned link', async () => {
    const { wrapper, create } = mountModal()

    await wrapper.get('[data-testid="gist-filename"]').setValue('board.json')
    await wrapper.get('[data-testid="gist-description"]').setValue('  my layout  ')
    await wrapper.get('[data-testid="gist-public"]').setValue()
    await wrapper.get('[data-testid="gist-confirm"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        filename: 'board.json',
        description: 'my layout',
        isPublic: true,
      }),
    )
    expect((wrapper.get('[data-testid="gist-url"]').element as HTMLInputElement).value).toBe(
      GIST_URL,
    )
  })

  it('sends the same JSON that Download JSON would produce', async () => {
    const { wrapper, create } = mountModal()

    await wrapper.get('[data-testid="gist-confirm"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))

    const { content } = create.mock.calls[0]![0]
    expect(() => JSON.parse(content)).not.toThrow()
    expect(Array.isArray(JSON.parse(content))).toBe(true)
  })

  it('omits an empty description rather than sending a blank one', async () => {
    const { wrapper, create } = mountModal()

    await wrapper.get('[data-testid="gist-confirm"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(create.mock.calls[0]![0].description).toBeUndefined()
  })

  it('will not create a gist with a blank file name', async () => {
    const { wrapper, create } = mountModal()

    await wrapper.get('[data-testid="gist-filename"]').setValue('   ')

    expect(
      (wrapper.get('[data-testid="gist-confirm"]').element as HTMLButtonElement).disabled,
    ).toBe(true)
    expect(create).not.toHaveBeenCalled()
  })

  it('shows the failure inline and offers another attempt', async () => {
    const { wrapper, gists, create } = mountModal()
    create.mockResolvedValue(null)
    gists.errorMessage = 'Could not reach GitHub. Check your connection and try again.'

    await wrapper.get('[data-testid="gist-confirm"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="gist-error"]').text()).toContain('Could not reach GitHub')
    expect(wrapper.get('[data-testid="gist-confirm"]').text()).toContain('Try again')
  })

  // A rejected token cannot be retried, so "Try again" would be a guaranteed failure.
  it('returns to the connect step when the token was rejected', async () => {
    const { wrapper, gists, create } = mountModal()
    create.mockImplementation(async () => {
      gists.needsAuthorization = true
      gists.errorMessage = 'Your GitHub authorization has expired.'
      return null
    })

    await wrapper.get('[data-testid="gist-confirm"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="gist-connect"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="gist-error"]').text()).toContain('expired')
  })

  // `stage` only reaches the DOM on the next tick, so the disabled attribute alone does
  // not stop two clicks landing in the same tick.
  it('creates one gist for two clicks in the same tick', async () => {
    const { wrapper, create } = mountModal()

    const button = wrapper.get('[data-testid="gist-confirm"]')
    await button.trigger('click')
    await button.trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(create).toHaveBeenCalledTimes(1)
  })

  it('copies the link and says so', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const { wrapper } = mountModal()

    await wrapper.get('[data-testid="gist-confirm"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-testid="gist-copy"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(writeText).toHaveBeenCalledWith(GIST_URL)
    expect(wrapper.get('[data-testid="gist-copy"]').text()).toBe('Copied')
  })

  it('falls back to a manual-copy hint when the clipboard refuses', async () => {
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    const { wrapper } = mountModal()

    await wrapper.get('[data-testid="gist-confirm"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()
    await wrapper.get('[data-testid="gist-copy"]').trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.get('[data-testid="gist-hint"]').text()).toContain('copy it manually')
  })

  // A misclick on the backdrop must not take the only copy of the link away.
  it('ignores a backdrop click once the link is on screen', async () => {
    const { wrapper } = mountModal()

    await wrapper.get('.modal').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)

    await wrapper.get('[data-testid="gist-confirm"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    await wrapper.get('.modal').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('starts clean when reopened, so the previous layout’s link is never shown', async () => {
    const { wrapper } = mountModal()

    await wrapper.get('[data-testid="gist-confirm"]').trigger('click')
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="gist-url"]').exists()).toBe(true)

    await wrapper.setProps({ isVisible: false })
    await wrapper.setProps({ isVisible: true })

    expect(wrapper.find('[data-testid="gist-url"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="gist-confirm"]').exists()).toBe(true)
  })
})
