import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PresetImportModal from '../PresetImportModal.vue'
import LayoutThumbnail from '../LayoutThumbnail.vue'
import { clearPresetCache } from '@/utils/presets'
import { useKeyboardStore } from '@/stores/keyboard'
import { toast } from '@/composables/useToast'

vi.mock('@/composables/useToast', () => ({
  toast: {
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showInfo: vi.fn(),
    removeToast: vi.fn(),
  },
}))

vi.mock('@/data/presets.json', () => ({
  default: {
    presets: [
      { id: 'ansi-104', name: 'Test ANSI', file: 'ansi-104.json', keywords: ['fullsize'] },
      { id: 'planck', name: 'Test Ortho', file: 'planck.json', keywords: ['ortholinear', 'grid'] },
      { id: 'blank', name: 'Test Blank', file: 'blank.json', keywords: ['empty'] },
      {
        id: 'multi-104',
        name: 'Test Multilingual',
        defaultLanguage: 'en',
        languages: [
          { code: 'en', name: 'English', file: 'multi-104/en.json' },
          { code: 'pl', name: 'Polish', file: 'multi-104/pl.json' },
        ],
      },
    ],
  },
}))

const ONE_KEY_LAYOUT = [['A']]

const mountModal = (pinia: ReturnType<typeof createPinia>) =>
  mount(PresetImportModal, {
    props: { isVisible: false },
    // jsdom's canvas.getContext() returns null, so the renderer inside
    // LayoutThumbnail cannot run here.
    global: { plugins: [pinia], stubs: { LayoutThumbnail: true } },
  })

const open = async (wrapper: ReturnType<typeof mountModal>) => {
  await wrapper.setProps({ isVisible: true })
  await flushPromises()
}

describe('PresetImportModal', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    vi.clearAllMocks()
    clearPresetCache()
    pinia = createPinia()
    setActivePinia(pinia)

    // No IntersectionObserver in jsdom, so the component falls back to loading the
    // whole (tiny) catalogue at once — which is how previews get requested here.
    global.fetch = vi.fn().mockImplementation((url: string) =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(url.includes('blank.json') ? [] : ONE_KEY_LAYOUT),
      } as Response),
    )
  })

  afterEach(() => {
    document.body.classList.remove('modal-open')
  })

  const cards = (wrapper: ReturnType<typeof mountModal>) =>
    wrapper.findAll('[data-testid="preset-card"]')

  it('renders nothing until it is opened', () => {
    const wrapper = mountModal(pinia)
    expect(wrapper.find('[data-testid="modal-preset-import"]').exists()).toBe(false)
  })

  it('shows one card per catalogue entry with the total underneath', async () => {
    const wrapper = mountModal(pinia)
    await open(wrapper)

    expect(cards(wrapper)).toHaveLength(4)
    expect(wrapper.find('[data-testid="preset-count"]').text()).toBe('4 presets available')
    expect(document.body.classList.contains('modal-open')).toBe(true)
  })

  it('draws a thumbnail for a layout with keys', async () => {
    const wrapper = mountModal(pinia)
    await open(wrapper)

    // Every preset but the blank one: three flat-or-multilingual boards with keys.
    expect(wrapper.findAllComponents(LayoutThumbnail).length).toBe(3)
    const ansi = wrapper.find('[data-preset-name="Test ANSI"]')
    expect(ansi.text()).toContain('1 key')
  })

  // An empty layout renders as a tiny white square, which reads as a broken preview
  // rather than as "this one is blank on purpose".
  it('labels an empty preset instead of drawing it', async () => {
    const wrapper = mountModal(pinia)
    await open(wrapper)

    const blank = wrapper.find('[data-preset-name="Test Blank"]')
    expect(blank.find('[data-testid="preset-card-empty"]').exists()).toBe(true)
    expect(blank.findComponent(LayoutThumbnail).exists()).toBe(false)
    expect(blank.text()).toContain('Empty')
  })

  it('filters by name and reports the result count', async () => {
    const wrapper = mountModal(pinia)
    await open(wrapper)

    await wrapper.find('[data-testid="preset-search"]').setValue('ansi')

    expect(cards(wrapper)).toHaveLength(1)
    expect(wrapper.find('[data-preset-name="Test ANSI"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="preset-count"]').text()).toBe('1 result(s)')
  })

  it('filters on keywords that never appear in the name', async () => {
    const wrapper = mountModal(pinia)
    await open(wrapper)

    await wrapper.find('[data-testid="preset-search"]').setValue('ortholinear')

    expect(cards(wrapper)).toHaveLength(1)
    expect(wrapper.find('[data-preset-name="Test Ortho"]').exists()).toBe(true)
    // The match was on a keyword, so nothing in the displayed name may be marked up:
    // the highlight indices belong to a different string.
    expect(wrapper.find('[data-preset-name="Test Ortho"]').html()).not.toContain('<mark>')
  })

  it('says so when nothing matches', async () => {
    const wrapper = mountModal(pinia)
    await open(wrapper)

    await wrapper.find('[data-testid="preset-search"]').setValue('zzzznotathing')

    expect(cards(wrapper)).toHaveLength(0)
    expect(wrapper.find('[data-testid="preset-empty-state"]').exists()).toBe(true)
  })

  it('loads the preset on a single click and closes', async () => {
    const store = useKeyboardStore()
    const loadSpy = vi.spyOn(store, 'loadKLELayout')

    const wrapper = mountModal(pinia)
    await open(wrapper)

    await wrapper.find('[data-preset-name="Test ANSI"]').trigger('click')
    await flushPromises()

    expect(loadSpy).toHaveBeenCalledWith(ONE_KEY_LAYOUT)
    expect(store.filename).toBe('ansi-104')
    expect(wrapper.emitted('close')).toBeTruthy()
  })

  it('reports a failed load as a toast', async () => {
    const wrapper = mountModal(pinia)
    await open(wrapper)

    global.fetch = vi.fn().mockRejectedValue(new Error('network down'))
    clearPresetCache()

    await wrapper.find('[data-preset-name="Test ANSI"]').trigger('click')
    await flushPromises()

    expect(toast.showError).toHaveBeenCalledWith('Failed to load Test ANSI', 'Error loading preset')
  })

  it('shows a placeholder for a preview that could not be read', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch = vi.fn().mockRejectedValue(new Error('network down'))

    const wrapper = mountModal(pinia)
    await open(wrapper)

    expect(wrapper.findAll('[data-testid="preset-card-error"]')).toHaveLength(4)
    expect(wrapper.find('[data-preset-name="Test ANSI"]').text()).toContain('Preview unavailable')
  })

  it('closes on Escape and releases the body scroll lock', async () => {
    const wrapper = mountModal(pinia)
    await open(wrapper)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(wrapper.emitted('close')).toBeTruthy()

    await wrapper.setProps({ isVisible: false })
    expect(document.body.classList.contains('modal-open')).toBe(false)
  })

  it('closes on a backdrop click', async () => {
    const wrapper = mountModal(pinia)
    await open(wrapper)

    await wrapper.find('[data-testid="modal-preset-import"]').trigger('click')

    expect(wrapper.emitted('close')).toBeTruthy()
  })

  describe('a multilingual preset', () => {
    const multiCard = (wrapper: ReturnType<typeof mountModal>) =>
      wrapper.find('[data-preset-name="Test Multilingual"]')
    const toggle = (wrapper: ReturnType<typeof mountModal>) =>
      wrapper.find('[data-testid="preset-language-toggle"]')
    const menu = (wrapper: ReturnType<typeof mountModal>) =>
      wrapper.find('[data-testid="preset-language-menu"]')
    const options = (wrapper: ReturnType<typeof mountModal>) =>
      wrapper.findAll('[data-testid="preset-language-option"]')

    it('offers a language control, and only on a card that has languages', async () => {
      const wrapper = mountModal(pinia)
      await open(wrapper)

      expect(toggle(wrapper).attributes('data-preset-languages')).toBe('2')
      // One toggle in the whole grid: the other three presets have no languages.
      expect(wrapper.findAll('[data-testid="preset-language-toggle"]')).toHaveLength(1)
    })

    // The whole point of moving this out of a modal: the common case costs one click.
    it('loads the default language when the card itself is clicked', async () => {
      const wrapper = mountModal(pinia)
      await open(wrapper)
      const store = useKeyboardStore()

      await multiCard(wrapper).trigger('click')
      await flushPromises()

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('multi-104/en.json'))
      expect(store.filename).toBe('multi-104-en')
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('shows which language one click would load', async () => {
      const wrapper = mountModal(pinia)
      await open(wrapper)

      expect(toggle(wrapper).text()).toContain('EN')
    })

    it('opens the menu without loading anything', async () => {
      const wrapper = mountModal(pinia)
      await open(wrapper)
      const store = useKeyboardStore()
      const loadSpy = vi.spyOn(store, 'loadKLELayout')

      await toggle(wrapper).trigger('click')
      await flushPromises()

      expect(menu(wrapper).exists()).toBe(true)
      expect(options(wrapper).map((option) => option.text())).toEqual([
        expect.stringContaining('English'),
        expect.stringContaining('Polish'),
      ])
      expect(loadSpy).not.toHaveBeenCalled()
      expect(wrapper.emitted('close')).toBeUndefined()
    })

    // The toggle sits on top of the card; its click must not also load the default.
    it('does not load the card underneath when the toggle is clicked', async () => {
      const wrapper = mountModal(pinia)
      await open(wrapper)
      const store = useKeyboardStore()
      const loadSpy = vi.spyOn(store, 'loadKLELayout')

      await toggle(wrapper).trigger('click')
      await flushPromises()

      expect(loadSpy).not.toHaveBeenCalled()
    })

    // Picking is staging, not committing. Collapsing the two would make the choice
    // unrevisable: there would be no way to change your mind about a language without
    // importing the first one on the way.
    it('picking a language stages it without importing', async () => {
      const wrapper = mountModal(pinia)
      await open(wrapper)
      const store = useKeyboardStore()
      const loadSpy = vi.spyOn(store, 'loadKLELayout')

      await toggle(wrapper).trigger('click')
      await flushPromises()
      await options(wrapper)[1]!.trigger('click')
      await flushPromises()

      expect(loadSpy).not.toHaveBeenCalled()
      expect(wrapper.emitted('close')).toBeUndefined()
      // The menu closes and the card now advertises the new choice.
      expect(menu(wrapper).exists()).toBe(false)
      expect(toggle(wrapper).text()).toContain('PL')
    })

    it('loads the staged language when the card is then clicked', async () => {
      const wrapper = mountModal(pinia)
      await open(wrapper)
      const store = useKeyboardStore()

      await toggle(wrapper).trigger('click')
      await flushPromises()
      await options(wrapper)[1]!.trigger('click')
      await flushPromises()

      await multiCard(wrapper).trigger('click')
      await flushPromises()

      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('multi-104/pl.json'))
      expect(store.filename).toBe('multi-104-pl')
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('lets a choice be changed again before committing to it', async () => {
      const wrapper = mountModal(pinia)
      await open(wrapper)
      const store = useKeyboardStore()

      await toggle(wrapper).trigger('click')
      await flushPromises()
      await options(wrapper)[1]!.trigger('click')
      await flushPromises()

      await toggle(wrapper).trigger('click')
      await flushPromises()
      await options(wrapper)[0]!.trigger('click')
      await flushPromises()

      expect(toggle(wrapper).text()).toContain('EN')

      await multiCard(wrapper).trigger('click')
      await flushPromises()
      expect(store.filename).toBe('multi-104-en')
    })

    it('marks the staged language in the menu, not the preset default', async () => {
      const wrapper = mountModal(pinia)
      await open(wrapper)

      await toggle(wrapper).trigger('click')
      await flushPromises()
      await options(wrapper)[1]!.trigger('click')
      await flushPromises()

      await toggle(wrapper).trigger('click')
      await flushPromises()

      const checked = options(wrapper).map((option) =>
        option.find('.preset-lang-option-check').exists(),
      )
      expect(checked).toEqual([false, true])
    })

    // The staged choice belongs to one visit, the same way the search box does.
    it('forgets a staged language once the modal is closed', async () => {
      const wrapper = mountModal(pinia)
      await open(wrapper)

      await toggle(wrapper).trigger('click')
      await flushPromises()
      await options(wrapper)[1]!.trigger('click')
      await flushPromises()
      expect(toggle(wrapper).text()).toContain('PL')

      await wrapper.setProps({ isVisible: false })
      await open(wrapper)

      expect(toggle(wrapper).text()).toContain('EN')
    })

    it('closes the open menu when the toggle is clicked again', async () => {
      const wrapper = mountModal(pinia)
      await open(wrapper)

      await toggle(wrapper).trigger('click')
      await flushPromises()
      expect(menu(wrapper).exists()).toBe(true)

      await toggle(wrapper).trigger('click')
      await flushPromises()
      expect(menu(wrapper).exists()).toBe(false)
    })

    // One Escape peels off one layer.
    it('gives Escape to the menu first, then to the modal', async () => {
      const wrapper = mountModal(pinia)
      await open(wrapper)

      await toggle(wrapper).trigger('click')
      await flushPromises()

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await flushPromises()
      expect(menu(wrapper).exists()).toBe(false)
      expect(wrapper.emitted('close')).toBeUndefined()

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
      await flushPromises()
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    // The menu is positioned from a rect taken once, so a filter that re-renders the
    // grid must not leave it floating over whatever moved into that spot.
    it('closes the menu when the search narrows the grid', async () => {
      const wrapper = mountModal(pinia)
      await open(wrapper)

      await toggle(wrapper).trigger('click')
      await flushPromises()
      expect(menu(wrapper).exists()).toBe(true)

      await wrapper.find('[data-testid="preset-search"]').setValue('ortho')
      await flushPromises()

      expect(menu(wrapper).exists()).toBe(false)
    })

    describe('attached to the document', () => {
      // Focus and document-level click listeners only behave for real once the
      // component is in the document.
      let wrapper: ReturnType<typeof mountModal>

      beforeEach(async () => {
        wrapper = mount(PresetImportModal, {
          props: { isVisible: false },
          attachTo: document.body,
          global: { plugins: [pinia], stubs: { LayoutThumbnail: true } },
        })
        await open(wrapper)
      })

      afterEach(() => wrapper.unmount())

      // Clicking away is how a menu is dismissed; landing that click on another card
      // must not replace the layout and wipe the undo history as a side effect.
      it('treats a card click while the menu is open as dismissing it', async () => {
        const loadSpy = vi.spyOn(useKeyboardStore(), 'loadKLELayout')

        await toggle(wrapper).trigger('click')
        await flushPromises()
        await wrapper.find('[data-preset-name="Test Ortho"]').trigger('click')
        await flushPromises()

        expect(menu(wrapper).exists()).toBe(false)
        expect(loadSpy).not.toHaveBeenCalled()
        expect(wrapper.emitted('close')).toBeUndefined()
      })

      it('moves focus into the menu when the toggle is activated from the keyboard', async () => {
        // Enter and Space reach a button as a click with detail 0.
        toggle(wrapper).element.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }))
        await flushPromises()

        expect(document.activeElement).toBe(options(wrapper)[0]!.element)
      })

      it('keeps the menu open on a second ArrowDown and focuses the first option', async () => {
        await toggle(wrapper).trigger('keydown', { key: 'ArrowDown' })
        await flushPromises()
        ;(toggle(wrapper).element as HTMLElement).focus()

        await toggle(wrapper).trigger('keydown', { key: 'ArrowDown' })
        await flushPromises()

        expect(menu(wrapper).exists()).toBe(true)
        expect(document.activeElement).toBe(options(wrapper)[0]!.element)
      })

      // Otherwise focus drops onto the page behind the modal once the menu is gone.
      it('returns focus to the toggle when Tab leaves the menu', async () => {
        await toggle(wrapper).trigger('keydown', { key: 'ArrowDown' })
        await flushPromises()

        const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true })
        options(wrapper)[0]!.element.dispatchEvent(tab)
        await flushPromises()

        expect(tab.defaultPrevented).toBe(true)
        expect(menu(wrapper).exists()).toBe(false)
        expect(document.activeElement).toBe(toggle(wrapper).element)
      })
    })

    it('reserves room under the language chip for the key count', async () => {
      const wrapper = mountModal(pinia)
      await open(wrapper)

      expect(multiCard(wrapper).find('.preset-card-meta').classes()).toContain(
        'preset-card-meta-inset',
      )
      expect(
        wrapper.find('[data-preset-name="Test Ortho"] .preset-card-meta').classes(),
      ).not.toContain('preset-card-meta-inset')
    })
  })
})
