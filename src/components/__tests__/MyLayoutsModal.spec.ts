import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import { Key, Keyboard } from '@adamws/kle-serial'

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
import HintTooltip from '../HintTooltip.vue'
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

  const keyboard = useKeyboardStore()

  const wrapper = mount(MyLayoutsModal, {
    props: { isVisible: true },
    global: {
      plugins: [pinia],
      stubs: { LayoutThumbnail: true },
    },
  })

  return { wrapper, store, keyboard, save, overwrite, fetchAll }
}

/**
 * Open the modal the way the toolbar does — the component stays mounted and
 * `isVisible` flips — because the open-time reset happens in the watcher on that prop,
 * not on mount. `editor` seeds the keyboard store before the modal opens.
 */
const openModal = async (editor: { name?: string; filename?: string }) => {
  const pinia = createPinia()
  setActivePinia(pinia)

  const store = useLayoutsStore()
  store.quota = 5
  store.loaded = true
  vi.spyOn(store, 'fetchAll').mockResolvedValue(undefined)
  const save = vi.spyOn(store, 'save').mockResolvedValue(null)

  const keyboard = useKeyboardStore()
  keyboard.metadata.name = editor.name as string
  keyboard.filename = editor.filename ?? ''

  const wrapper = mount(MyLayoutsModal, {
    props: { isVisible: false },
    global: { plugins: [pinia], stubs: { LayoutThumbnail: true } },
  })
  await wrapper.setProps({ isVisible: true })

  return { wrapper, store, keyboard, save }
}

type Wrapper = ReturnType<typeof mountModal>['wrapper']

/** Let an awaited store action settle and the render that follows it land. */
const flush = async (wrapper: Wrapper) => {
  await Promise.resolve()
  await Promise.resolve()
  await wrapper.vm.$nextTick()
}

/** Press a vacant slot's save button; the first one unless another is named. */
const startCreate = async (wrapper: Wrapper, nth = 0) => {
  await wrapper.findAll('[data-testid="save-into-slot"]')[nth]!.trigger('click')
}

const nameField = (wrapper: Wrapper) =>
  (wrapper.find('[data-testid="new-name-input"]').element as HTMLInputElement).value

const setName = async (wrapper: Wrapper, name: string) => {
  await wrapper.find('[data-testid="new-name-input"]').setValue(name)
}

describe('MyLayoutsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  /*
   * The modal is a fixed number of slots, so it is the same height whether nothing or
   * everything is saved — a save or a delete fills or empties a row instead of resizing
   * the dialog under the pointer that just clicked.
   */
  describe('slots', () => {
    const slots = (wrapper: Wrapper) => wrapper.findAll('[data-testid="layout-slot"]')

    const vacant = (wrapper: Wrapper) => wrapper.findAll('.layout-item-vacant')

    it('shows one slot per layout the quota allows, filled or not', () => {
      const { wrapper } = mountModal([makeLayout('one'), makeLayout('two')])

      expect(slots(wrapper)).toHaveLength(5)
      expect(vacant(wrapper)).toHaveLength(3)
      expect(wrapper.findAll('[data-testid="load-layout"]')).toHaveLength(2)
    })

    it('follows the quota the database returned, not a hardcoded 5', () => {
      const { wrapper } = mountModal([makeLayout('one')], 3)
      expect(slots(wrapper)).toHaveLength(3)
    })

    it('keeps the row count fixed as layouts come and go', async () => {
      const { wrapper, store } = mountModal([])
      expect(slots(wrapper)).toHaveLength(5)

      store.layouts = ['a', 'b', 'c', 'd', 'e'].map((n) => makeLayout(n))
      await wrapper.vm.$nextTick()
      expect(slots(wrapper)).toHaveLength(5)
      expect(vacant(wrapper)).toHaveLength(0)

      store.layouts = store.layouts.slice(0, 2)
      await wrapper.vm.$nextTick()
      expect(slots(wrapper)).toHaveLength(5)
    })

    // A quota lowered after the fact must not hide layouts that are already saved —
    // they would be unreachable, and undeletable.
    it('still lists layouts that overflow a lowered quota', () => {
      const { wrapper } = mountModal(
        ['a', 'b', 'c'].map((n) => makeLayout(n)),
        2,
      )

      expect(slots(wrapper)).toHaveLength(3)
      expect(wrapper.findAll('[data-testid="load-layout"]')).toHaveLength(3)
    })

    // Below 576px the thumbnail shrinks and the two text lines are what set a row's
    // height, so every state of the text column has to carry both of them or that state
    // comes out shorter than the rest — and the modal resizes after all.
    it('reserves two text lines in every state of a row', async () => {
      const { wrapper } = mountModal([makeLayout('one')])
      const [filled, empty] = slots(wrapper)

      for (const slot of [filled!, empty!]) {
        // `.text()` trims the nbsp away; the point is that both line boxes exist
        const reserved = slot.findAll('.info-sizer > div')
        expect(reserved.map((line) => line.element.textContent)).toEqual([' ', ' '])
      }
      expect(empty!.find('.vacant-label').text()).toBe('Empty slot')
      // …and the thumbnail's stand-in occupies the space a real one would
      expect(empty!.find('.vacant-preview').exists()).toBe(true)

      // The single-input states share that sizer rather than collapsing to one line
      await startCreate(wrapper)
      expect(slots(wrapper)[1]!.findAll('.info-sizer > div')).toHaveLength(2)
      await wrapper.find('[data-testid="rename-layout"]').trigger('click')
      expect(slots(wrapper)[0]!.findAll('.info-sizer > div')).toHaveLength(2)
    })

    it('does not call a slot empty until the first fetch has landed', async () => {
      const { wrapper, store } = mountModal([])
      store.loading = true
      await wrapper.vm.$nextTick()

      expect(slots(wrapper)).toHaveLength(5)
      expect(wrapper.text()).not.toContain('Empty slot')
      expect(wrapper.findAll('.is-pulsing')).toHaveLength(5)
      // …and nothing can be saved into a slot that is not yet known to be empty
      expect(wrapper.find('[data-testid="save-into-slot"]').exists()).toBe(false)

      store.loading = false
      await wrapper.vm.$nextTick()
      expect(wrapper.findAll('.is-pulsing')).toHaveLength(0)
      expect(wrapper.text()).toContain('Empty slot')
    })

    /*
     * An error arrives in response to a click, and the dialog is centred, so anything
     * that changes the body's height moves every row half that distance — under the
     * pointer that was just used. It takes the caption's line instead of one of its own.
     *
     * Not over the rows, which is where it used to go: a failed save leaves its name
     * field open in the row it was aimed at, and over the last one the alert covered the
     * very buttons that would have tried it again.
     */
    it('puts an error on the caption line, clear of the rows', async () => {
      const { wrapper, store } = mountModal([makeLayout('one')])
      store.errorMessage = 'Could not save this layout'
      await wrapper.vm.$nextTick()

      const alert = wrapper.find('[data-testid="layouts-error"]')
      expect(alert.exists()).toBe(true)
      expect(alert.element.closest('.caption-line')).not.toBeNull()
      expect(alert.element.closest('[data-testid="layouts-list"]')).toBeNull()
      // The caption stays in the DOM holding the line open; the alert only covers it
      expect(wrapper.find('[data-testid="slot-caption"]').exists()).toBe(true)
      expect(slots(wrapper)).toHaveLength(5)
    })
  })

  /*
   * The banner this replaces appeared on the fifth save and pushed the whole list down.
   * A caption that is always there changes its sentence instead of the modal's height.
   */
  describe('how much room is left', () => {
    const caption = (wrapper: Wrapper) => wrapper.find('[data-testid="slot-caption"]')

    it('counts the slots in use', () => {
      const { wrapper } = mountModal([makeLayout('one'), makeLayout('two')])
      expect(caption(wrapper).text()).toBe('2 of 5 slots used')
    })

    it('says what to do about a full list, in the same line', () => {
      const { wrapper } = mountModal(['a', 'b', 'c', 'd', 'e'].map((n) => makeLayout(n)))

      expect(caption(wrapper).text()).toContain('All 5 slots are used')
      expect(caption(wrapper).text()).toContain('delete one')
      // and there is no vacant slot left to save into
      expect(wrapper.find('[data-testid="save-into-slot"]').exists()).toBe(false)
    })

    it('has no banner to appear at the limit', () => {
      const { wrapper } = mountModal(['a', 'b', 'c', 'd', 'e'].map((n) => makeLayout(n)))

      expect(wrapper.find('[data-testid="layouts-quota-warning"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="layouts-quota"]').exists()).toBe(false)
    })
  })

  describe('row actions', () => {
    it('gives every saved layout its own save, beside load', () => {
      const { wrapper } = mountModal([makeLayout('one'), makeLayout('two')])

      expect(wrapper.findAll('[data-testid="save-here"]')).toHaveLength(2)
      expect(wrapper.find('[data-testid="load-layout"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="rename-layout"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="delete-layout"]').exists()).toBe(true)
    })

    // There is no name field to type an existing name into any more, so the row's own
    // button is the only way to overwrite it — and it is the only thing it can mean.
    it('no longer has a name field deciding which row is meant', () => {
      const { wrapper } = mountModal([makeLayout('one')])
      expect(wrapper.find('[data-testid="save-layout-name"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="save-layout"]').exists()).toBe(false)
    })
  })

  describe('naming a new layout', () => {
    it('offers the name from the layout metadata', async () => {
      const { wrapper } = await openModal({ name: 'Planck rev6' })
      await startCreate(wrapper)
      expect(nameField(wrapper)).toBe('Planck rev6')
    })

    it('trims it', async () => {
      const { wrapper } = await openModal({ name: '  Planck rev6  ' })
      await startCreate(wrapper)
      expect(nameField(wrapper)).toBe('Planck rev6')
    })

    // filename is a download name, it outlives the layout it came from — this modal even
    // sets it when loading a saved layout — so falling back to it proposed the *previous*
    // layout's name.
    it('leaves the field empty rather than proposing a previous layout name', async () => {
      const { wrapper } = await openModal({ name: '', filename: 'Planck rev6' })
      await startCreate(wrapper)

      expect(nameField(wrapper)).toBe('')
      expect(wrapper.find('[data-testid="new-name-input"]').attributes('placeholder')).toBe(
        'Name this layout',
      )
      // …and nothing can be saved until a name is actually given
      expect(wrapper.find('[data-testid="new-name-confirm"]').attributes('disabled')).toBeDefined()
    })

    it('empties a whitespace-only name instead of keeping it', async () => {
      const { wrapper } = await openModal({ name: '   ', filename: 'Planck rev6' })
      await startCreate(wrapper)
      expect(nameField(wrapper)).toBe('')
    })

    it('re-derives every time a slot is opened, following the editor', async () => {
      const { wrapper, keyboard } = await openModal({ name: 'Planck rev6' })
      await startCreate(wrapper)
      expect(nameField(wrapper)).toBe('Planck rev6')

      await wrapper.find('[data-testid="new-name-cancel"]').trigger('click')
      keyboard.metadata.name = 'Lily58'
      await startCreate(wrapper)

      expect(nameField(wrapper)).toBe('Lily58')
    })

    it('is abandoned when the modal is closed and opened again', async () => {
      const { wrapper } = await openModal({ name: 'Planck rev6' })
      await startCreate(wrapper)
      expect(wrapper.find('[data-testid="new-name-input"]').exists()).toBe(true)

      await wrapper.setProps({ isVisible: false })
      await wrapper.setProps({ isVisible: true })

      expect(wrapper.find('[data-testid="new-name-input"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="save-into-slot"]').exists()).toBe(true)
    })
  })

  describe('saving into a slot', () => {
    const slotAt = (wrapper: Wrapper, index: number) =>
      wrapper.findAll('[data-testid="layout-slot"]')[index]!

    // The row that is pressed is the row that fills — any of them, because the order is
    // fixed for the session and an insert is drawn where it was put.
    it('offers every vacant slot', () => {
      const { wrapper } = mountModal([makeLayout('one')])

      expect(wrapper.findAll('[data-testid="save-into-slot"]')).toHaveLength(4)
      for (const index of [1, 2, 3, 4]) {
        expect(slotAt(wrapper, index).classes()).toContain('layout-item-open')
      }
      expect(slotAt(wrapper, 0).classes()).not.toContain('layout-item-open')
    })

    it('fills the slot that was pressed, not the first free one', async () => {
      const { wrapper, store, save } = mountModal([makeLayout('one')])
      save.mockImplementation(async (name: string) => {
        const saved = makeLayout(name, 'new-id')
        store.layouts.push(saved)
        return saved
      })

      // the third row, with two vacancies above it
      await startCreate(wrapper, 2)
      await setName(wrapper, 'something new')
      await wrapper.find('[data-testid="new-name-confirm"]').trigger('click')
      await wrapper.vm.$nextTick()

      expect(slotAt(wrapper, 3).text()).toContain('something new')
      expect(slotAt(wrapper, 1).find('.vacant-label').exists()).toBe(true)
      expect(slotAt(wrapper, 2).find('.vacant-label').exists()).toBe(true)
    })

    // Only one row asks for a name at a time; the rest stop offering while it does.
    it('closes the other slots while one is being named', async () => {
      const { wrapper } = mountModal([])

      await startCreate(wrapper, 3)

      expect(wrapper.findAll('[data-testid="save-into-slot"]')).toHaveLength(0)
      expect(slotAt(wrapper, 3).find('[data-testid="new-name-input"]').exists()).toBe(true)
    })

    it('asks for the name inside that slot, then inserts', async () => {
      const { wrapper, save, overwrite } = mountModal([makeLayout('one')])

      await startCreate(wrapper)
      // The question is in the row it is about, not above the list
      expect(slotAt(wrapper, 1).find('[data-testid="new-name-input"]').exists()).toBe(true)
      expect(slotAt(wrapper, 0).find('[data-testid="new-name-input"]').exists()).toBe(false)
      expect(save).not.toHaveBeenCalled()

      await setName(wrapper, 'something new')
      await wrapper.find('[data-testid="new-name-confirm"]').trigger('click')

      expect(save).toHaveBeenCalledWith('something new', expect.any(String))
      expect(overwrite).not.toHaveBeenCalled()
    })

    it('takes a click anywhere on the row, not only on its button', async () => {
      const { wrapper } = mountModal([makeLayout('one')])

      await slotAt(wrapper, 1).trigger('click')

      expect(wrapper.find('[data-testid="new-name-input"]').exists()).toBe(true)
    })

    it('commits on Enter and backs out on cancel', async () => {
      const { wrapper, save } = mountModal([])

      await startCreate(wrapper)
      await setName(wrapper, 'by keyboard')
      await wrapper.find('[data-testid="new-name-input"]').trigger('keydown.enter')
      expect(save).toHaveBeenCalledWith('by keyboard', expect.any(String))

      // The write was refused, so the field is still open with the name in it — cancel
      // is what puts the vacant slot back.
      await wrapper.find('[data-testid="new-name-cancel"]').trigger('click')
      expect(wrapper.find('[data-testid="new-name-input"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="save-into-slot"]').exists()).toBe(true)
    })

    it('cannot be committed with an empty name', async () => {
      const { wrapper, save } = mountModal([])

      await startCreate(wrapper)
      await setName(wrapper, '   ')

      expect(wrapper.find('[data-testid="new-name-confirm"]').attributes('disabled')).toBeDefined()
      await wrapper.find('[data-testid="new-name-input"]').trigger('keydown.enter')
      expect(save).not.toHaveBeenCalled()
    })

    // The point of the failure is to be fixable: retyping the name would be the price of
    // a lost round trip.
    it('keeps the typed name on screen when the write fails', async () => {
      const { wrapper, store } = mountModal([])

      await startCreate(wrapper)
      await setName(wrapper, 'something new')
      await wrapper.find('[data-testid="new-name-confirm"]').trigger('click')
      store.errorMessage = 'Could not save this layout'
      await wrapper.vm.$nextTick()

      expect(nameField(wrapper)).toBe('something new')
    })
  })

  /*
   * Nothing may move under the pointer while the modal is open, and a delete used to be
   * the one thing that still did — every row beneath it took a new number.
   */
  describe('the order a session fixes', () => {
    const slotAt = (wrapper: Wrapper, index: number) =>
      wrapper.findAll('[data-testid="layout-slot"]')[index]!

    const deleteRow = async (wrapper: Wrapper, index: number) => {
      await slotAt(wrapper, index).find('[data-testid="delete-layout"]').trigger('click')
      await slotAt(wrapper, index).find('[data-testid="confirm-action"]').trigger('click')
      // The remove resolves a tick after the click, and the slot is emptied behind it
      await flush(wrapper)
    }

    const openModalOn = async (layouts: SavedLayout[]) => {
      const pinia = createPinia()
      setActivePinia(pinia)
      const store = useLayoutsStore()
      store.layouts = layouts
      store.quota = 5
      store.loaded = true
      vi.spyOn(store, 'fetchAll').mockResolvedValue(undefined)
      vi.spyOn(store, 'remove').mockImplementation(async (id: string) => {
        store.layouts = store.layouts.filter((layout) => layout.id !== id)
        return true
      })
      const wrapper = mount(MyLayoutsModal, {
        props: { isVisible: false },
        global: { plugins: [pinia], stubs: { LayoutThumbnail: true } },
      })
      await wrapper.setProps({ isVisible: true })
      return { wrapper, store }
    }

    it('empties a deleted slot in place, leaving the rows below it alone', async () => {
      const { wrapper } = await openModalOn(['a', 'b', 'c'].map((n) => makeLayout(n)))

      await deleteRow(wrapper, 1)

      expect(slotAt(wrapper, 0).text()).toContain('a')
      expect(slotAt(wrapper, 1).find('.vacant-label').exists()).toBe(true)
      expect(slotAt(wrapper, 2).text()).toContain('c')
    })

    it('lets the next save drop into that gap', async () => {
      const { wrapper, store } = await openModalOn(['a', 'b', 'c'].map((n) => makeLayout(n)))
      vi.spyOn(store, 'save').mockImplementation(async (name: string) => {
        const saved = makeLayout(name, 'new-id')
        store.layouts.push(saved)
        return saved
      })

      await deleteRow(wrapper, 1)
      await slotAt(wrapper, 1).find('[data-testid="save-into-slot"]').trigger('click')
      await setName(wrapper, 'replacement')
      await wrapper.find('[data-testid="new-name-confirm"]').trigger('click')
      await wrapper.vm.$nextTick()

      expect(slotAt(wrapper, 1).text()).toContain('replacement')
      expect(slotAt(wrapper, 2).text()).toContain('c')
    })

    // Reopening is when the gaps close up — that is the one moment the rows are allowed
    // to renumber, because nothing is under the pointer yet.
    it('closes the gaps on the next open', async () => {
      const { wrapper } = await openModalOn(['a', 'b', 'c'].map((n) => makeLayout(n)))

      await deleteRow(wrapper, 1)
      await wrapper.setProps({ isVisible: false })
      await wrapper.setProps({ isVisible: true })

      expect(slotAt(wrapper, 0).text()).toContain('a')
      expect(slotAt(wrapper, 1).text()).toContain('c')
      expect(slotAt(wrapper, 2).find('.vacant-label').exists()).toBe(true)
    })
  })

  describe('saving over a slot', () => {
    it('confirms in the row being replaced', async () => {
      const { wrapper, save, overwrite } = mountModal([makeLayout('one'), makeLayout('two')])

      await wrapper.findAll('[data-testid="save-here"]')[1]!.trigger('click')

      // Nothing is written until the confirmation is accepted
      expect(save).not.toHaveBeenCalled()
      expect(overwrite).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="confirm-action"]').text()).toBe('Replace')
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
      await wrapper.find('[data-testid="save-here"]').trigger('click')

      const message = wrapper.find('[data-testid="confirm-message"]')
      expect(message.exists()).toBe(true)
      expect(message.element.closest('.layout-item-info')).not.toBeNull()
      expect(message.element.closest('.layout-item-actions')).toBeNull()
      expect(message.classes()).toContain('text-truncate')
      expect(message.text()).not.toContain(longName)

      // …leaving the actions column holding nothing but the two buttons
      const actions = wrapper.find('.layout-item-actions')
      expect(actions.findAll('button').map((b) => b.text())).toEqual(['Replace', 'Cancel'])
    })

    /*
     * The row keeps its id across an overwrite, so a cache keyed by id had to be cleared
     * by hand — and that ran after the store mutation had already queued the re-render,
     * which then drew from the entry it was about to drop. The preview stayed on the old
     * layout until something unrelated re-rendered the row.
     */
    it('shows the new contents in the preview straight away', async () => {
      const original = makeLayout('one')
      const { wrapper, store, keyboard, overwrite } = mountModal([original])

      // Already the current row, so the mark this write sets is not a change — nothing
      // else re-renders the row afterwards to cover for a stale preview.
      store.markActive(original.id, keyboard.layoutGeneration)
      await wrapper.vm.$nextTick()

      const replacement = new Keyboard()
      replacement.keys = [new Key()]
      const before = wrapper.findComponent({ name: 'LayoutThumbnail' }).props('keys')

      overwrite.mockImplementation(async (id: string) => {
        const saved = { ...original, id, payload: encodeLayoutToUrl(replacement) }
        store.layouts = store.layouts.map((layout) => (layout.id === id ? saved : layout))
        return saved
      })

      await wrapper.find('[data-testid="save-here"]').trigger('click')
      await wrapper.find('[data-testid="confirm-action"]').trigger('click')
      await flush(wrapper)

      // A new identity is what LayoutThumbnail's watcher redraws on
      expect(wrapper.findComponent({ name: 'LayoutThumbnail' }).props('keys')).not.toBe(before)
      expect(wrapper.find('[data-testid="layout-slot"]').text()).toContain('1 key')
    })

    // An update is not an insert, and the database only counts inserts, so re-saving
    // work in place stays available with every slot full.
    it('stays available at the limit', () => {
      const { wrapper } = mountModal(['a', 'b', 'c', 'd', 'e'].map((n) => makeLayout(n)))

      expect(wrapper.findAll('[data-testid="save-here"]')).toHaveLength(5)
      for (const button of wrapper.findAll('[data-testid="save-here"]')) {
        expect(button.attributes('disabled')).toBeUndefined()
      }
    })
  })

  /*
   * Which slot the editor's work came from. The id alone would go stale the moment
   * something else was loaded, so it is paired with `layoutGeneration`, which the
   * keyboard store moves whenever the editor's contents are replaced wholesale.
   */
  describe('the current-layout marker', () => {
    const marker = (wrapper: Wrapper) => wrapper.find('[data-testid="current-marker"]')

    it('marks nothing until a layout has been loaded or saved', () => {
      const { wrapper } = mountModal([makeLayout('one')])
      expect(marker(wrapper).exists()).toBe(false)
    })

    it('marks the row the editor is showing, and gives it the primary save', async () => {
      const { wrapper, store, keyboard } = mountModal([makeLayout('one'), makeLayout('two')])

      store.markActive('two', keyboard.layoutGeneration)
      await wrapper.vm.$nextTick()

      const rows = wrapper.findAll('[data-testid="layout-slot"]')
      expect(rows[0]!.find('[data-testid="current-marker"]').exists()).toBe(false)
      expect(rows[1]!.find('[data-testid="current-marker"]').text()).toBe('Current')
      expect(rows[1]!.classes()).toContain('layout-item-current')
      expect(rows[1]!.find('[data-testid="save-here"]').classes()).toContain('btn-primary')
      expect(rows[0]!.find('[data-testid="save-here"]').classes()).toContain('btn-outline-primary')
    })

    it('retires the mark once the editor holds something else', async () => {
      const { wrapper, store, keyboard } = mountModal([makeLayout('one')])

      store.markActive('one', keyboard.layoutGeneration)
      await wrapper.vm.$nextTick()
      expect(marker(wrapper).exists()).toBe(true)

      // What every import, preset and share link goes through
      keyboard.loadKeyboard(new Keyboard())
      await wrapper.vm.$nextTick()
      expect(marker(wrapper).exists()).toBe(false)
    })

    /*
     * Editing is not being handed something else. The JSON panel's Apply is the case
     * worth pinning down, because it replaces every key in one go — but it preserves the
     * undo history precisely because it edits the open layout rather than replacing it,
     * and an edited layout is exactly the one you want to put back in its own slot.
     */
    it('keeps the mark through an edit, including applying JSON', async () => {
      const { wrapper, store, keyboard } = mountModal([makeLayout('one')])

      store.markActive('one', keyboard.layoutGeneration)
      await wrapper.vm.$nextTick()

      keyboard.addKey()
      await wrapper.vm.$nextTick()
      expect(marker(wrapper).exists()).toBe(true)

      keyboard.updateLayoutFromJson([['Q', 'W']])
      await wrapper.vm.$nextTick()
      expect(marker(wrapper).exists()).toBe(true)
    })

    it('follows a newly saved layout into its slot', async () => {
      const { wrapper, store, save } = mountModal([])
      save.mockImplementation(async (name: string) => {
        const saved = makeLayout(name, 'new-id')
        store.layouts.push(saved)
        return saved
      })

      await startCreate(wrapper)
      await setName(wrapper, 'something new')
      await wrapper.find('[data-testid="new-name-confirm"]').trigger('click')
      await wrapper.vm.$nextTick()

      expect(store.activeId).toBe('new-id')
      expect(marker(wrapper).exists()).toBe(true)
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

    const button = (wrapper: Wrapper) => wrapper.find('[data-testid="download-all-layouts"]')

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

  /*
   * A disabled button suppresses its own pointer events, so the hint has to come from
   * the HintTooltip wrapper around it — these assert the text that wrapper is given,
   * and that it becomes a tab stop only while the button it wraps cannot take focus.
   */
  describe('explaining an unavailable button', () => {
    const hint = (wrapper: Wrapper, testid: string) =>
      wrapper.findComponent<typeof HintTooltip>(`[data-testid="${testid}"]`)

    it('asks for a name when the field is empty or blank', async () => {
      const { wrapper } = mountModal([])
      await startCreate(wrapper)
      expect(hint(wrapper, 'new-name-tooltip').props('text')).toBe(
        'Enter a name for this layout first',
      )

      await setName(wrapper, '   ')
      expect(hint(wrapper, 'new-name-tooltip').props('text')).toBe(
        'Enter a name for this layout first',
      )
    })

    it('says an action is already in flight rather than nothing at all', async () => {
      const { wrapper, store } = mountModal([makeLayout('one')])
      store.busy = true
      await wrapper.vm.$nextTick()

      expect(hint(wrapper, 'save-into-slot-tooltip').props('text')).toContain('previous action')
      expect(hint(wrapper, 'save-here-tooltip').props('text')).toContain('previous action')
      expect(hint(wrapper, 'load-layout-tooltip').props('text')).toContain('previous action')
    })

    it('says the list is still loading', async () => {
      const { wrapper, store } = mountModal([makeLayout('one')])
      store.loading = true
      await wrapper.vm.$nextTick()

      expect(hint(wrapper, 'save-here-tooltip').props('text')).toContain('load')
      expect(hint(wrapper, 'download-all-tooltip').props('text')).toContain('load')
    })

    // Load has been disabled for an unreadable payload since it was written, and has
    // never said why — a disabled button's own `title` never fires.
    it('says why an unreadable layout cannot be loaded', () => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      const broken = { ...makeLayout('broken'), payload: 'not-a-payload' }
      const { wrapper } = mountModal([broken])

      expect(wrapper.find('[data-testid="load-layout"]').attributes('disabled')).toBeDefined()
      expect(hint(wrapper, 'load-layout-tooltip').props('text')).toBe(
        'This layout could not be read',
      )
    })

    it('says there is nothing to download when nothing is saved', () => {
      const { wrapper } = mountModal([])
      expect(hint(wrapper, 'download-all-tooltip').props('text')).toBe(
        'You have no saved layouts to download yet',
      )
    })

    // A usable button needs no explanation, and a tooltip on one is just something in
    // the way of the click.
    it('says nothing once the button is available', () => {
      const { wrapper } = mountModal([makeLayout('one')])

      expect(hint(wrapper, 'save-into-slot-tooltip').props('text')).toBe('')
      expect(hint(wrapper, 'save-here-tooltip').props('text')).toBe('')
      expect(hint(wrapper, 'load-layout-tooltip').props('text')).toBe('')
      expect(hint(wrapper, 'download-all-tooltip').props('text')).toBe('')
    })

    it('is a tab stop only while the button it wraps is disabled', async () => {
      const { wrapper, store } = mountModal([makeLayout('one')])
      expect(hint(wrapper, 'save-here-tooltip').attributes('tabindex')).toBeUndefined()

      store.busy = true
      await wrapper.vm.$nextTick()
      expect(hint(wrapper, 'save-here-tooltip').attributes('tabindex')).toBe('0')
    })
  })
})
