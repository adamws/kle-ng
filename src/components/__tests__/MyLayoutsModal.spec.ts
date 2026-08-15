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
}))

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

describe('MyLayoutsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
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
      expect(wrapper.text()).toContain('Update "two" with the editor contents?')

      await wrapper.find('[data-testid="confirm-action"]').trigger('click')
      await wrapper.vm.$nextTick()

      expect(overwrite).toHaveBeenCalledWith('two', expect.any(String))
      expect(save).not.toHaveBeenCalled()
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
})
