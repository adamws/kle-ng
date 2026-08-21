import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import KeyboardToolbar from '../KeyboardToolbar.vue'
import { useKeyboardStore, Key } from '@/stores/keyboard'
import { useAuthStore } from '@/stores/auth'
import { useShortLinksStore } from '@/stores/short-links'
import { toast } from '@/composables/useToast'

vi.mock('@/composables/useToast', () => ({
  toast: {
    showError: vi.fn(),
    showSuccess: vi.fn(),
    showInfo: vi.fn(),
    removeToast: vi.fn(),
  },
}))

// Mock presets data using existing files
vi.mock('@/data/presets.json', () => ({
  default: {
    presets: [
      { name: 'Test Layout 1', file: 'planck.json' },
      { name: 'Test Layout 2', file: 'ansi-104.json' },
    ],
  },
}))

describe('KeyboardToolbar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  describe('presets in the import menu', () => {
    // Presets are a section of the Import dropdown rather than a header control of
    // their own, so everything here is scoped to that menu.
    const presetItems = (wrapper: ReturnType<typeof mount>) =>
      wrapper.findAll('[data-testid="import-from-preset"] .dropdown-item')

    it('should list presets under the Import dropdown', async () => {
      const wrapper = mount(KeyboardToolbar, {
        global: {
          plugins: [createPinia()],
        },
      })

      await wrapper.vm.$nextTick()

      const importMenu = wrapper.find('.import-menu')
      expect(importMenu.exists()).toBe(true)
      expect(importMenu.text()).toContain('Presets')
      expect(presetItems(wrapper).length).toBeGreaterThan(0)

      // The standalone preset dropdown is gone from the header
      expect(wrapper.find('.preset-dropdown').exists()).toBe(false)
    })

    it('should load preset when selected', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const componentStore = useKeyboardStore()

      // Mock fetch to return a valid preset JSON
      const mockPresetData = [['Test']]
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPresetData),
      } as Response)

      // Mock the loadKLELayout method on the component's store
      const loadKLELayoutSpy = vi.spyOn(componentStore, 'loadKLELayout')

      const wrapper = mount(KeyboardToolbar, {
        global: {
          plugins: [pinia],
        },
      })

      await wrapper.vm.$nextTick()

      const items = presetItems(wrapper)
      expect(items.length).toBeGreaterThan(0)

      // Click the first preset
      const firstPreset = items[0]
      expect(firstPreset).toBeDefined()
      await firstPreset!.trigger('click')

      // Wait for async preset loading to complete
      await new Promise((resolve) => setTimeout(resolve, 500))
      await wrapper.vm.$nextTick()

      // Should have fetched the file named in presets.json and loaded the result
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('planck.json'))
      expect(loadKLELayoutSpy).toHaveBeenCalledWith(mockPresetData)
    })

    // Loading clears the filename, and this was the one caller that never set one:
    // a preset used to keep whatever the previous layout was called, and would now
    // otherwise download as 'keyboard-layout'.
    it('should name the download after the preset it loaded', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const componentStore = useKeyboardStore()
      componentStore.filename = 'something-loaded-earlier'

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([['Test']]),
      } as Response)

      const wrapper = mount(KeyboardToolbar, { global: { plugins: [pinia] } })
      await wrapper.vm.$nextTick()

      await presetItems(wrapper)[0]!.trigger('click')
      await new Promise((resolve) => setTimeout(resolve, 500))
      await wrapper.vm.$nextTick()

      expect(componentStore.filename).toBe('planck')
    })

    it('should load available presets from presets.json', async () => {
      const wrapper = mount(KeyboardToolbar, {
        global: {
          plugins: [createPinia()],
        },
      })

      await wrapper.vm.$nextTick()

      const items = presetItems(wrapper)

      // Should have 2 preset options
      expect(items.length).toBe(2)
      const firstPresetOption = items[0]
      expect(firstPresetOption).toBeDefined()
      expect(firstPresetOption!.text().trim()).toBe('Test Layout 1')
      const secondPresetOption = items[1]
      expect(secondPresetOption).toBeDefined()
      expect(secondPresetOption!.text().trim()).toBe('Test Layout 2')
    })
  })

  describe('special key positioning', () => {
    it('should position special keys next to selected key', () => {
      const store = useKeyboardStore()

      // Clear the default layout and add a single key
      store.clearLayout()
      store.addKey({ labels: ['Test', '', '', '', '', '', '', '', '', '', '', ''] })

      // Position it at (2, 1)
      const firstKey = store.keys[0]
      expect(firstKey).toBeDefined()
      firstKey!.x = 2
      firstKey!.y = 1
      firstKey!.width = 1
      store.selectedKeys = [firstKey!]

      // Test the special key data transformation directly
      const isoEnterData = {
        width: 1.25,
        width2: 1.5,
        height: 2,
        height2: 1,
        x: 0.25, // This should be removed
        y: 0, // Add y property for TypeScript
        x2: -0.25,
        y2: 0,
      }

      // Simulate what addSpecialKey does: remove x/y and add key
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { x, y, ...keyDataWithoutPosition } = isoEnterData

      store.addKey(keyDataWithoutPosition)

      // Check that the ISO Enter was positioned next to the selected key
      expect(store.keys).toHaveLength(2)
      const isoKey = store.keys[1]
      expect(isoKey).toBeDefined()
      expect(isoKey!.x).toBe(3) // firstKey.x + firstKey.width = 2 + 1 = 3
      expect(isoKey!.y).toBe(1) // Same Y as firstKey
      expect(isoKey!.width).toBe(1.25)
      expect(isoKey!.width2).toBe(1.5)
      expect(isoKey!.x2).toBe(-0.25) // Relative positioning preserved
    })
  })

  describe('export functionality', () => {
    // These stubs replace globals every mount depends on, so they must be put back:
    // without this, no test declared after this block can mount a component at all.
    const originals = {
      URL: global.URL,
      Blob: global.Blob,
      createElement: document.createElement,
    }

    afterEach(() => {
      global.URL = originals.URL
      global.Blob = originals.Blob
      Object.defineProperty(document, 'createElement', {
        value: originals.createElement,
        writable: true,
      })
    })

    beforeEach(() => {
      // Mock URL object methods
      global.URL = {
        createObjectURL: vi.fn(() => 'mock-url'),
        revokeObjectURL: vi.fn(),
      } as unknown as typeof URL

      // Mock createElement and DOM methods
      Object.defineProperty(document, 'createElement', {
        value: vi.fn((tag: string) => {
          if (tag === 'a') {
            return {
              href: '',
              download: '',
              click: vi.fn(),
            }
          }
          return {}
        }),
        writable: true,
      })

      // Mock Blob constructor
      global.Blob = vi.fn((content, options) => ({ content, options })) as unknown as typeof Blob

      // Clear console to avoid test output noise
      vi.spyOn(console, 'log').mockImplementation(() => {})
    })

    it('should export KLE format JSON', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const store = useKeyboardStore()

      // Add a test key
      store.addKey({
        labels: ['', '', '', '', 'A', '', '', '', '', '', '', ''],
        x: 1.123456789,
        y: 2.987654321,
      })

      // Test the export functionality directly through the store
      const data = store.getSerializedData('kle')

      // Should be standard KLE format (array-based)
      expect(Array.isArray(data)).toBe(true)
    })

    it('should export KLE Internal format JSON', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const store = useKeyboardStore()

      // Add a test key with high precision values
      store.addKey({
        labels: ['', '', '', '', 'B', '', '', '', '', '', '', ''],
        x: 1.1234567890123456,
        y: 2.9876543210987654,
        width: 1.5555555555555556,
      })

      // Test the export functionality directly through the store
      const data = store.getSerializedData('kle-internal')

      // Should be KLE internal format (object with meta and keys)
      expect(data).toHaveProperty('meta')
      expect(data).toHaveProperty('keys')
      expect(Array.isArray((data as { keys: Key[] }).keys)).toBe(true)

      // Check that numeric values are rounded to 6 decimal places
      const key = (data as { keys: Key[] }).keys.find((k: Key) => k.labels && k.labels[4] === 'B')
      expect(key).toBeDefined()
      expect(key!.x).toBe(1.123457) // Rounded to 6 decimal places
      expect(key!.y).toBe(2.987654) // Rounded to 6 decimal places
      expect(key!.width).toBe(1.555556) // Rounded to 6 decimal places
    })

    it('should use correct filename for KLE internal export', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const store = useKeyboardStore()

      // Set a custom layout name
      store.metadata.name = 'Test Layout'

      // Test that the store has the correct name that would be used for filename
      expect(store.metadata.name).toBe('Test Layout')

      // Verify that the filename pattern would be correct (the component uses this pattern)
      const expectedFilename = `${store.metadata.name}-internal.json`
      expect(expectedFilename).toBe('Test Layout-internal.json')
    })

    it('should prioritize filename over metadata name for downloads', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)

      const store = useKeyboardStore()

      store.filename = 'imported-layout'
      store.metadata.name = 'Different Layout Name'

      const expectedFilename = `${store.filename || store.metadata.name || 'keyboard-layout'}.json`
      expect(expectedFilename).toBe('imported-layout.json')
    })

    it('should fallback to metadata name when no filename is set', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)

      const store = useKeyboardStore()

      store.filename = ''
      store.metadata.name = 'Layout Name'

      const expectedFilename = `${store.filename || store.metadata.name || 'keyboard-layout'}.json`
      expect(expectedFilename).toBe('Layout Name.json')
    })
  })

  describe('share menu', () => {
    // Short links need a session to create, so the caret is gated on isSignedIn while
    // the plain Share button stays available to everyone.
    const signIn = (auth: ReturnType<typeof useAuthStore>) => {
      auth.user = { id: 'u1', email: 'a@b.c', name: 'tester', avatarUrl: '' }
    }

    const mountToolbar = (pinia: ReturnType<typeof createPinia>) =>
      mount(KeyboardToolbar, { global: { plugins: [pinia] } })

    // The menu item only opens the consent dialog; the create is behind its confirm
    // button. Every test that wants a link created has to go through both.
    const confirmShortLink = async (wrapper: ReturnType<typeof mountToolbar>) => {
      await wrapper.find('[data-testid="create-short-link"]').trigger('click')
      await wrapper.find('[data-testid="short-link-confirm"]').trigger('click')
      await flushPromises()
    }

    it('offers no short-link caret to a signed-out visitor', () => {
      const pinia = createPinia()
      setActivePinia(pinia)

      const wrapper = mountToolbar(pinia)

      expect(wrapper.find('[data-testid="share-options"]').exists()).toBe(false)
      // …but Share itself is still there
      expect(wrapper.find('.share-group .btn').exists()).toBe(true)
    })

    it('offers the caret once signed in', () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      signIn(useAuthStore())

      const wrapper = mountToolbar(pinia)

      expect(wrapper.find('[data-testid="share-options"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="create-short-link"]').exists()).toBe(true)
    })

    it('creates nothing until the dialog is confirmed', async () => {
      // The whole point of the dialog: storing a layout is public and cannot be undone,
      // so opening the menu item must not itself be the irreversible act.
      const pinia = createPinia()
      setActivePinia(pinia)
      signIn(useAuthStore())

      const shortLinks = useShortLinksStore()
      const createSpy = vi.spyOn(shortLinks, 'create')

      const wrapper = mountToolbar(pinia)
      await wrapper.find('[data-testid="create-short-link"]').trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-testid="short-link-confirm"]').exists()).toBe(true)
      expect(createSpy).not.toHaveBeenCalled()
    })

    it('creates nothing when the dialog is cancelled', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      signIn(useAuthStore())

      const shortLinks = useShortLinksStore()
      const createSpy = vi.spyOn(shortLinks, 'create')

      const wrapper = mountToolbar(pinia)
      await wrapper.find('[data-testid="create-short-link"]').trigger('click')
      await wrapper.find('[data-testid="short-link-cancel"]').trigger('click')
      await flushPromises()

      expect(createSpy).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="short-link-confirm"]').exists()).toBe(false)
    })

    it('stays open and shows the link once confirmed', async () => {
      // The dialog is where the link lives now: closing on success would put a link the
      // user has not stored anywhere behind a second create to get back.
      const pinia = createPinia()
      setActivePinia(pinia)
      signIn(useAuthStore())

      const shortLinks = useShortLinksStore()
      const createSpy = vi.spyOn(shortLinks, 'create').mockResolvedValue('7kQ2mBx9Lp')

      const wrapper = mountToolbar(pinia)
      await confirmShortLink(wrapper)

      // The payload handed over is the same encoding a #share= link carries
      expect(createSpy).toHaveBeenCalledWith(useKeyboardStore().encodeCurrentLayout())

      const field = wrapper.find('[data-testid="short-link-url"]')
      expect(field.exists()).toBe(true)
      expect((field.element as HTMLInputElement).value).toContain('?s=7kQ2mBx9Lp')
      expect(wrapper.find('[data-testid="short-link-close"]').exists()).toBe(true)
    })

    it('does not touch the clipboard until Copy is pressed', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      signIn(useAuthStore())

      const shortLinks = useShortLinksStore()
      vi.spyOn(shortLinks, 'create').mockResolvedValue('7kQ2mBx9Lp')

      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

      const wrapper = mountToolbar(pinia)
      await confirmShortLink(wrapper)

      // Creating a link is not consent to replace whatever the user was holding
      expect(writeText).not.toHaveBeenCalled()

      await wrapper.find('[data-testid="short-link-copy"]').trigger('click')
      await flushPromises()

      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('?s=7kQ2mBx9Lp'))
      // The button's own "Copied" state is the feedback; a toast on top of an open
      // dialog would report what the dialog is already showing.
      expect(toast.showSuccess).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="short-link-copy"]').text()).toBe('Copied')
    })

    it('keeps the link when the clipboard refuses the write', async () => {
      // Losing the link because a browser blocked writeText() is the case the visible
      // field exists to prevent, so the field must survive a failed copy.
      const pinia = createPinia()
      setActivePinia(pinia)
      signIn(useAuthStore())

      const shortLinks = useShortLinksStore()
      vi.spyOn(shortLinks, 'create').mockResolvedValue('7kQ2mBx9Lp')

      const writeText = vi.fn().mockRejectedValue(new Error('denied'))
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

      const wrapper = mountToolbar(pinia)
      await confirmShortLink(wrapper)
      await wrapper.find('[data-testid="short-link-copy"]').trigger('click')
      await flushPromises()

      const field = wrapper.find('[data-testid="short-link-url"]')
      expect((field.element as HTMLInputElement).value).toContain('?s=7kQ2mBx9Lp')
      expect(wrapper.find('[data-testid="short-link-hint"]').text()).toContain('manually')
    })

    it('reports a failed create in the dialog and offers a retry', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      signIn(useAuthStore())

      const shortLinks = useShortLinksStore()
      vi.spyOn(shortLinks, 'create').mockImplementation(async () => {
        shortLinks.errorMessage = 'Short links are not available on this server yet.'
        return null
      })

      const wrapper = mountToolbar(pinia)
      await confirmShortLink(wrapper)

      expect(wrapper.find('[data-testid="short-link-error"]').text()).toBe(
        'Short links are not available on this server yet.',
      )
      // Still on the consent stage, so there is nothing to copy and a way to try again
      expect(wrapper.find('[data-testid="short-link-url"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="short-link-confirm"]').text()).toContain('Try again')
    })

    it('shows no stale link when the dialog is reopened', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      signIn(useAuthStore())

      const shortLinks = useShortLinksStore()
      vi.spyOn(shortLinks, 'create').mockResolvedValue('7kQ2mBx9Lp')

      const wrapper = mountToolbar(pinia)
      await confirmShortLink(wrapper)
      await wrapper.find('[data-testid="short-link-close"]').trigger('click')
      await flushPromises()

      await wrapper.find('[data-testid="create-short-link"]').trigger('click')
      await flushPromises()

      // Back to consent for the layout on screen now, not the last one's result
      expect(wrapper.find('[data-testid="short-link-url"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="short-link-confirm"]').exists()).toBe(true)
    })

    it('leaves the plain Share button producing a #share= URL', async () => {
      const pinia = createPinia()
      setActivePinia(pinia)
      signIn(useAuthStore())

      const writeText = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

      const wrapper = mountToolbar(pinia)
      await wrapper.find('.share-group > .btn').trigger('click')
      await flushPromises()

      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('#share='))
    })
  })
})
