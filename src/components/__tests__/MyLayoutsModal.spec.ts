import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { Keyboard } from '@adamws/kle-serial'

const mocks = vi.hoisted(() => ({
  isAuthConfigured: vi.fn(() => true),
  getTestUser: vi.fn(() => null),
  isLocalSupabase: vi.fn(() => true),
  getSupabaseClient: vi.fn(),
  showSuccess: vi.fn(),
  showError: vi.fn(),
  showInfo: vi.fn(),
  // Typed through the generic rather than with named parameters, so `mock.calls` is
  // typed without declaring arguments the implementation does not use.
  createZip: vi.fn<(entries: Array<{ name: string; text: string }>, modified?: Date) => Uint8Array>(
    () => new Uint8Array([1, 2, 3]),
  ),
}))

// The archive bytes are zip.spec.ts's problem; what matters here is which layouts the
// modal packs, under what names, and with what contents.
vi.mock('@/utils/zip', () => ({ createZip: mocks.createZip }))

vi.mock('@/config/supabase', () => ({
  AUTH_STORAGE_KEY: 'kle-ng-auth',
  isAuthConfigured: mocks.isAuthConfigured,
  getTestUser: mocks.getTestUser,
  isLocalSupabase: mocks.isLocalSupabase,
}))

vi.mock('@/utils/supabase-loader', () => ({
  getSupabaseClient: mocks.getSupabaseClient,
}))

vi.mock('@/composables/useToast', () => ({
  toast: { showSuccess: mocks.showSuccess, showError: mocks.showError, showInfo: mocks.showInfo },
}))

import MyLayoutsModal from '../MyLayoutsModal.vue'
import { useLayoutsStore, type SavedLayout } from '@/stores/layouts'
import { useKeyboardStore } from '@/stores/keyboard'
import { encodeLayoutToUrl } from '@/utils/url-sharing'

const payload = () => {
  const keyboard = new Keyboard()
  keyboard.keys = []
  return encodeLayoutToUrl(keyboard)
}

const makeLayout = (name: string, id = name): SavedLayout => ({
  id,
  name,
  payload: payload(),
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
})

/** Mount with the store pre-populated, bypassing the network entirely. */
const mountModal = (layouts: SavedLayout[], quota = 5) => {
  const pinia = createPinia()
  setActivePinia(pinia)

  const store = useLayoutsStore()
  store.layouts = layouts
  store.quota = quota
  store.loaded = true
  // The modal refetches on open; nothing should reach Supabase in a unit test.
  const fetchAll = vi.spyOn(store, 'fetchAll').mockResolvedValue(undefined)
  const save = vi.spyOn(store, 'save').mockResolvedValue(null)
  const overwrite = vi.spyOn(store, 'overwrite').mockResolvedValue(null)

  const wrapper = mount(MyLayoutsModal, {
    props: { isVisible: true },
    global: {
      plugins: [pinia],
      stubs: { LayoutThumbnail: true },
    },
  })

  return { wrapper, store, save, overwrite, fetchAll }
}

/**
 * Open the modal the way the toolbar does — the component stays mounted and
 * `isVisible` flips — because the prefill happens in the watcher on that prop, not on
 * mount. `editor` seeds the keyboard store before the modal opens.
 */
const openModal = async (editor: { name?: string; filename?: string }) => {
  const pinia = createPinia()
  setActivePinia(pinia)

  const store = useLayoutsStore()
  store.quota = 5
  store.loaded = true
  vi.spyOn(store, 'fetchAll').mockResolvedValue(undefined)

  const keyboard = useKeyboardStore()
  keyboard.metadata.name = editor.name as string
  keyboard.filename = editor.filename ?? ''

  const wrapper = mount(MyLayoutsModal, {
    props: { isVisible: false },
    global: { plugins: [pinia], stubs: { LayoutThumbnail: true } },
  })
  await wrapper.setProps({ isVisible: true })

  return { wrapper, keyboard }
}

const nameField = (wrapper: { find: (s: string) => { element: Element } }) =>
  (wrapper.find('[data-testid="save-layout-name"]').element as HTMLInputElement).value

describe('MyLayoutsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  describe('name prefill', () => {
    it('offers the name from the layout metadata', async () => {
      const { wrapper } = await openModal({ name: 'Planck rev6' })
      expect(nameField(wrapper)).toBe('Planck rev6')
    })

    it('trims it', async () => {
      const { wrapper } = await openModal({ name: '  Planck rev6  ' })
      expect(nameField(wrapper)).toBe('Planck rev6')
    })

    // The reported bug: filename is a download name, it outlives the layout it came
    // from — this modal even sets it when loading a saved layout — so falling back to
    // it proposed the *previous* layout's name. Worse, a stale name that matches
    // something saved turns Save into Update against a row the user never chose.
    it('leaves the field empty rather than proposing a previous layout name', async () => {
      const { wrapper } = await openModal({ name: '', filename: 'Planck rev6' })

      expect(nameField(wrapper)).toBe('')
      expect(wrapper.find('[data-testid="save-layout-name"]').attributes('placeholder')).toBe(
        'Name this layout',
      )
      // …and nothing can be saved until a name is actually given
      expect(wrapper.find('[data-testid="save-layout"]').attributes('disabled')).toBeDefined()
    })

    it('empties a whitespace-only name instead of keeping it', async () => {
      const { wrapper } = await openModal({ name: '   ', filename: 'Planck rev6' })
      expect(nameField(wrapper)).toBe('')
    })

    it('re-derives on every open, following the editor', async () => {
      const { wrapper, keyboard } = await openModal({ name: 'Planck rev6' })
      expect(nameField(wrapper)).toBe('Planck rev6')

      await wrapper.setProps({ isVisible: false })
      keyboard.metadata.name = 'Lily58'
      await wrapper.setProps({ isVisible: true })

      expect(nameField(wrapper)).toBe('Lily58')
    })
  })

  describe('quota', () => {
    it('says nothing about quota while there is room', () => {
      const { wrapper } = mountModal([makeLayout('one')])

      expect(wrapper.find('[data-testid="layouts-quota-warning"]').exists()).toBe(false)
      // The old always-on counter is gone
      expect(wrapper.find('[data-testid="layouts-quota"]').exists()).toBe(false)
      expect(wrapper.text()).not.toContain('1 / 5')
    })

    it('warns only once the limit is reached, naming the real quota', () => {
      const layouts = ['a', 'b', 'c', 'd', 'e'].map((n) => makeLayout(n))
      const { wrapper } = mountModal(layouts)

      const warning = wrapper.find('[data-testid="layouts-quota-warning"]')
      expect(warning.exists()).toBe(true)
      expect(warning.text()).toContain('maximum of 5 layouts')
    })

    it('reports the quota the database returned, not a hardcoded 5', () => {
      const layouts = ['a', 'b', 'c'].map((n) => makeLayout(n))
      const { wrapper } = mountModal(layouts, 3)

      expect(wrapper.find('[data-testid="layouts-quota-warning"]').text()).toContain(
        'maximum of 3 layouts',
      )
    })
  })

  describe('row actions', () => {
    it('no longer offers a per-row replace action', () => {
      const { wrapper } = mountModal([makeLayout('one')])
      expect(wrapper.find('[data-testid="overwrite-layout"]').exists()).toBe(false)
    })

    it('keeps load, rename and delete', () => {
      const { wrapper } = mountModal([makeLayout('one')])
      expect(wrapper.find('[data-testid="load-layout"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="rename-layout"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="delete-layout"]').exists()).toBe(true)
    })
  })

  describe('saving', () => {
    const setName = async (wrapper: ReturnType<typeof mountModal>['wrapper'], name: string) => {
      await wrapper.find('[data-testid="save-layout-name"]').setValue(name)
    }

    it('inserts a new layout when the name is unused', async () => {
      const { wrapper, save, overwrite } = mountModal([makeLayout('one')])
      await setName(wrapper, 'something new')

      expect(wrapper.find('[data-testid="save-layout"]').text()).toContain('Save current')
      await wrapper.find('[data-testid="save-layout"]').trigger('click')

      expect(save).toHaveBeenCalledWith('something new', expect.any(String))
      expect(overwrite).not.toHaveBeenCalled()
    })

    it('confirms in the matching row before updating a layout of the same name', async () => {
      const { wrapper, save, overwrite } = mountModal([makeLayout('one'), makeLayout('two')])
      await setName(wrapper, 'two')

      // The button announces the different outcome up front
      expect(wrapper.find('[data-testid="save-layout"]').text()).toContain('Update')

      await wrapper.find('[data-testid="save-layout"]').trigger('click')

      // Nothing is written until the confirmation is accepted
      expect(save).not.toHaveBeenCalled()
      expect(overwrite).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="confirm-action"]').text()).toBe('Update')
      expect(wrapper.find('[data-testid="confirm-message"]').text()).toBe(
        'Replace with the editor contents?',
      )

      await wrapper.find('[data-testid="confirm-action"]').trigger('click')
      await wrapper.vm.$nextTick()

      expect(overwrite).toHaveBeenCalledWith('two', expect.any(String))
      expect(save).not.toHaveBeenCalled()
    })

    // The prompt used to sit among the buttons, the one column that cannot shrink. A
    // flex item's automatic minimum size is its content width, so quoting a long name
    // made it spill out of the row and crush the name column. It belongs in the info
    // column, which can shrink — and the row already names the layout.
    it('puts the confirmation prompt in the name column, not among the buttons', async () => {
      const longName = 'My 65% split ergo with thumb cluster v3'
      const { wrapper } = mountModal([makeLayout(longName)])
      await setName(wrapper, longName)
      await wrapper.find('[data-testid="save-layout"]').trigger('click')

      const message = wrapper.find('[data-testid="confirm-message"]')
      expect(message.exists()).toBe(true)
      expect(message.element.closest('.layout-item-info')).not.toBeNull()
      expect(message.element.closest('.layout-item-actions')).toBeNull()
      expect(message.classes()).toContain('text-truncate')
      expect(message.text()).not.toContain(longName)

      // …leaving the actions column holding nothing but the two buttons
      const actions = wrapper.find('.layout-item-actions')
      expect(actions.findAll('button').map((b) => b.text())).toEqual(['Update', 'Cancel'])
    })

    it('matches names case-insensitively and ignoring surrounding space', async () => {
      const { wrapper, save } = mountModal([makeLayout('My Layout')])
      await setName(wrapper, '  my layout  ')

      await wrapper.find('[data-testid="save-layout"]').trigger('click')

      expect(save).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="confirm-action"]').exists()).toBe(true)
    })

    it('blocks a new layout at the limit but still allows an update', async () => {
      const layouts = ['a', 'b', 'c', 'd', 'e'].map((n) => makeLayout(n))
      const { wrapper } = mountModal(layouts)
      const button = () => wrapper.find('[data-testid="save-layout"]')

      await setName(wrapper, 'a sixth one')
      expect(button().attributes('disabled')).toBeDefined()

      // An update is not an insert, so the quota does not apply to it
      await setName(wrapper, 'c')
      expect(button().attributes('disabled')).toBeUndefined()
    })

    it('waits for the refetch, so a name is never matched against a stale list', async () => {
      // On the first open of a session the list is still in flight: saving now would
      // miss the existing 'one' and insert a duplicate instead of updating it.
      const { wrapper, store, save, overwrite } = mountModal([])
      store.loading = true
      await setName(wrapper, 'one')

      expect(wrapper.find('[data-testid="save-layout"]').attributes('disabled')).toBeDefined()

      store.layouts = [makeLayout('one')]
      store.loading = false
      await wrapper.vm.$nextTick()

      expect(wrapper.find('[data-testid="save-layout"]').attributes('disabled')).toBeUndefined()
      await wrapper.find('[data-testid="save-layout"]').trigger('click')

      expect(save).not.toHaveBeenCalled()
      expect(overwrite).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="confirm-action"]').exists()).toBe(true)
    })

    it('cannot be triggered with an empty name', async () => {
      const { wrapper } = mountModal([makeLayout('one')])
      await setName(wrapper, '   ')
      expect(wrapper.find('[data-testid="save-layout"]').attributes('disabled')).toBeDefined()
    })
  })

  describe('download all', () => {
    /** Filenames the component asked the browser to save. */
    let downloaded: string[] = []

    beforeEach(() => {
      downloaded = []
      // jsdom implements neither of these, and will not follow a download anyway
      URL.createObjectURL = vi.fn(() => 'blob:mock')
      URL.revokeObjectURL = vi.fn()
      vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
        this: HTMLAnchorElement,
      ) {
        downloaded.push(this.download)
      })
    })

    const button = (wrapper: ReturnType<typeof mountModal>['wrapper']) =>
      wrapper.find('[data-testid="download-all-layouts"]')

    /** The entries handed to createZip by the most recent click. */
    const packed = () => {
      // Not `.at(-1)`: tsconfig.vitest.json sets `lib: []`, so Array.prototype.at is
      // not declared for the specs.
      const calls = mocks.createZip.mock.calls
      return calls[calls.length - 1]![0]
    }

    it('packs one entry per layout, named after it', async () => {
      const { wrapper } = mountModal([makeLayout('Planck rev6'), makeLayout('Lily58')])

      await button(wrapper).trigger('click')

      expect(packed().map((e) => e.name)).toEqual(['Planck rev6.json', 'Lily58.json'])
      expect(downloaded).toHaveLength(1)
      expect(downloaded[0]).toMatch(/^kle-ng-layouts-\d{4}-\d{2}-\d{2}\.zip$/)
    })

    // Each entry has to stand on its own as an import, so it carries exactly what
    // Export → Download JSON writes for that layout — not a bundle format.
    it('writes each entry as ordinary KLE JSON', async () => {
      const { wrapper } = mountModal([makeLayout('Planck rev6')])

      await button(wrapper).trigger('click')

      const parsed = JSON.parse(packed()[0]!.text)
      expect(Array.isArray(parsed)).toBe(true)
    })

    it('replaces characters a filename cannot carry, and keeps entries distinct', async () => {
      const { wrapper } = mountModal([
        makeLayout('60% / ANSI: v2', 'a'),
        makeLayout('60% - ANSI- v2', 'b'),
        makeLayout('...', 'c'),
      ])

      await button(wrapper).trigger('click')

      expect(packed().map((e) => e.name)).toEqual([
        '60% - ANSI- v2.json',
        '60% - ANSI- v2 (2).json',
        'layout.json',
      ])
    })

    // A backup should rescue what is readable rather than fail on the one row that is
    // not, so an undecodable payload is skipped and reported.
    it('skips layouts that cannot be decoded and says how many', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const broken = { ...makeLayout('broken'), payload: 'not-a-payload' }
      const { wrapper } = mountModal([makeLayout('good'), broken])

      await button(wrapper).trigger('click')

      expect(packed().map((e) => e.name)).toEqual(['good.json'])
      expect(mocks.showSuccess).toHaveBeenCalledWith(
        expect.stringContaining('1 could not be read'),
        'My Layouts',
      )
    })

    it('reports a failure instead of downloading an empty archive', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const broken = { ...makeLayout('broken'), payload: 'not-a-payload' }
      const { wrapper } = mountModal([broken])

      await button(wrapper).trigger('click')

      expect(mocks.createZip).not.toHaveBeenCalled()
      expect(downloaded).toEqual([])
      expect(mocks.showError).toHaveBeenCalledWith(expect.any(String), 'Download Failed')
    })

    it('is unavailable with nothing saved, or before the list has arrived', async () => {
      expect(button(mountModal([]).wrapper).attributes('disabled')).toBeDefined()

      const { wrapper, store } = mountModal([makeLayout('one')])
      expect(button(wrapper).attributes('disabled')).toBeUndefined()

      store.loading = true
      await wrapper.vm.$nextTick()
      expect(button(wrapper).attributes('disabled')).toBeDefined()
    })
  })
})
