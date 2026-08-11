import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { nextTick } from 'vue'
import KeyboardListImportModal from '../KeyboardListImportModal.vue'
import type { LayoutSource, PreviewLayout } from '@/utils/preview/layout-source'

vi.mock('@/composables/useToast', () => ({
  toast: { showSuccess: vi.fn(), showError: vi.fn() },
}))

const KEYBOARDS = ['planck/rev6', 'preonic/rev3', 'crkbd/rev1']

const previewLayout = (name: string): PreviewLayout =>
  ({
    name,
    raw: { keyboards: { [name]: {} } },
    keyboard: { keys: [], meta: {} },
    variants: [{ label: 'LAYOUT', keys: [] }],
    keyCount: 47,
    tooLarge: false,
  }) as unknown as PreviewLayout

const layoutRequests: string[] = []

const testSource: LayoutSource = {
  id: 'qmk',
  listUrl: 'https://example.test/keyboard_list.json',
  layoutUrl: (name) => `https://example.test/${name}.json`,
  toPreviewLayout: (_raw, name) => previewLayout(name),
}

/**
 * The component fetches its list from the `isVisible` watcher, which only runs
 * on a transition — so mount closed and open it, exactly as KeyboardToolbar does.
 */
const openModal = async (props: Record<string, unknown> = {}) => {
  const wrapper = mountModal(props)
  await wrapper.setProps({ isVisible: true })
  await flushPromises()
  return wrapper
}

const mountModal = (props: Record<string, unknown> = {}) =>
  mount(KeyboardListImportModal, {
    props: {
      isVisible: false,
      title: 'Import from QMK',
      listUrl: testSource.listUrl,
      label: 'QMK',
      prefix: 'qmk',
      importFn: vi.fn().mockResolvedValue(undefined),
      ...props,
    },
    global: {
      stubs: {
        // The pane owns a real canvas renderer; its behaviour is covered by
        // LayoutPreviewPane.spec.ts.
        LayoutPreviewPane: {
          name: 'LayoutPreviewPane',
          props: ['pinned'],
          template: '<div data-testid="preview-pane-stub" :data-pinned="String(!!pinned)" />',
        },
      },
    },
  })

describe('KeyboardListImportModal', () => {
  let wrapper: VueWrapper | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    layoutRequests.length = 0
    vi.stubGlobal('IntersectionObserver', undefined)
    vi.stubGlobal('fetch', (url: string) => {
      if (url.endsWith('keyboard_list.json')) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ keyboards: KEYBOARDS }),
        })
      }
      layoutRequests.push(url)
      return Promise.resolve({ ok: true, status: 200, statusText: 'OK', json: async () => ({}) })
    })
  })

  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    vi.unstubAllGlobals()
  })

  it('lists every keyboard returned by the index', async () => {
    wrapper = await openModal()

    expect(wrapper.findAll('.qmk-keyboard-item')).toHaveLength(KEYBOARDS.length)
    expect(wrapper.text()).toContain('3 keyboards available')
  })

  it('makes no layout requests at all without a source', async () => {
    wrapper = await openModal()

    await wrapper.findAll('.qmk-keyboard-item')[0]!.trigger('mouseenter')
    await flushPromises()

    expect(layoutRequests).toHaveLength(0)
    expect(wrapper.find('[data-testid="preview-pane-stub"]').exists()).toBe(false)
  })

  it('renders the preview pane and widens the dialog when given a source', async () => {
    wrapper = await openModal({ source: testSource })

    expect(wrapper.find('[data-testid="preview-pane-stub"]').exists()).toBe(true)
    expect(wrapper.find('.modal-dialog').classes()).toContain('modal-xl')
  })

  it('downloads the hovered layout', async () => {
    vi.useFakeTimers()
    wrapper = await openModal({ source: testSource })

    await wrapper.findAll('.qmk-keyboard-item')[0]!.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()

    expect(layoutRequests).toEqual(['https://example.test/planck/rev6.json'])
    vi.useRealTimers()
  })

  it('does not spend a request on a row the pointer merely passes over', async () => {
    vi.useFakeTimers()
    wrapper = await openModal({ source: testSource })

    const items = wrapper.findAll('.qmk-keyboard-item')
    await items[0]!.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(40)
    await items[1]!.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(40)
    await items[2]!.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()

    // Only the row the pointer settled on was fetched
    expect(layoutRequests).toEqual(['https://example.test/crkbd/rev1.json'])
    vi.useRealTimers()
  })

  it('keeps a pending download alive when the same row is hovered again', async () => {
    vi.useFakeTimers()
    wrapper = await openModal({ source: testSource })

    // mouseenter arms the intent timer; the click that follows re-enters the
    // same row and must not cancel it.
    const item = wrapper.findAll('.qmk-keyboard-item')[0]!
    await item.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(50)
    await item.trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(100)
    await flushPromises()

    expect(layoutRequests).toEqual(['https://example.test/planck/rev6.json'])
    vi.useRealTimers()
  })

  it('drives the preview from keyboard selection too', async () => {
    vi.useFakeTimers()
    wrapper = await openModal({ source: testSource })

    await wrapper.findAll('.qmk-keyboard-item')[1]!.trigger('focus')
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()

    expect(layoutRequests).toEqual(['https://example.test/preonic/rev3.json'])
    vi.useRealTimers()
  })

  describe('selection pinning', () => {
    /**
     * Emulates a real click. `mousedown` lands before the button's `focus`
     * handler, and `detail` must come from a native MouseEvent because
     * vue-test-utils cannot set that read-only property.
     */
    const clickRow = async (
      row: { element: Element; trigger: (event: string) => Promise<void> },
      detail = 1,
    ) => {
      await row.trigger('mousedown')
      await row.trigger('focus')
      row.element.dispatchEvent(new MouseEvent('click', { bubbles: true, detail }))
      await nextTick()
    }

    it('holds the preview on the selected result while other rows are hovered', async () => {
      vi.useFakeTimers()
      wrapper = await openModal({ source: testSource })

      const items = wrapper.findAll('.qmk-keyboard-item')
      await clickRow(items[0]!)
      await vi.advanceTimersByTimeAsync(200)
      await flushPromises()
      expect(layoutRequests).toEqual(['https://example.test/planck/rev6.json'])

      // Sweeping across other rows on the way to Import must not swap it out
      await items[1]!.trigger('mouseenter')
      await items[2]!.trigger('mouseenter')
      await vi.advanceTimersByTimeAsync(500)
      await flushPromises()

      expect(layoutRequests).toEqual(['https://example.test/planck/rev6.json'])
      vi.useRealTimers()
    })

    it('marks the pinned state on the preview pane', async () => {
      wrapper = await openModal({ source: testSource })
      const pane = () => wrapper!.find('[data-testid="preview-pane-stub"]')

      expect(pane().attributes('data-pinned')).toBe('false')
      await clickRow(wrapper.findAll('.qmk-keyboard-item')[0]!)
      expect(pane().attributes('data-pinned')).toBe('true')
    })

    it('deselects when the selected result is clicked again', async () => {
      wrapper = await openModal({ source: testSource })
      const row = wrapper.findAll('.qmk-keyboard-item')[0]!

      await clickRow(row)
      expect(row.classes()).toContain('selected')
      expect(wrapper.find('.btn-primary').attributes('disabled')).toBeUndefined()

      await clickRow(row)
      expect(row.classes()).not.toContain('selected')
      expect(wrapper.find('.btn-primary').attributes('disabled')).toBeDefined()
    })

    it('resumes hover previews after deselecting', async () => {
      vi.useFakeTimers()
      wrapper = await openModal({ source: testSource })
      const items = wrapper.findAll('.qmk-keyboard-item')

      await clickRow(items[0]!)
      await vi.advanceTimersByTimeAsync(200)
      await flushPromises()

      await clickRow(items[0]!) // deselect
      await items[1]!.trigger('mouseenter')
      await vi.advanceTimersByTimeAsync(200)
      await flushPromises()

      expect(layoutRequests).toEqual([
        'https://example.test/planck/rev6.json',
        'https://example.test/preonic/rev3.json',
      ])
      vi.useRealTimers()
    })

    it('does not deselect on the second click of a double-click', async () => {
      const importFn = vi.fn().mockResolvedValue(undefined)
      wrapper = await openModal({ source: testSource, importFn })
      const row = wrapper.findAll('.qmk-keyboard-item')[0]!

      await clickRow(row, 1)
      await clickRow(row, 2)
      await row.trigger('dblclick')
      await flushPromises()

      expect(importFn).toHaveBeenCalledTimes(1)
      expect(importFn.mock.calls[0]![0]).toBe('planck/rev6')
    })
  })

  it('hands the cached layout to importFn so it is not downloaded twice', async () => {
    vi.useFakeTimers()
    const importFn = vi.fn().mockResolvedValue(undefined)
    wrapper = await openModal({ source: testSource, importFn })

    const item = wrapper.findAll('.qmk-keyboard-item')[0]!
    await item.trigger('mouseenter')
    await item.trigger('click')
    await vi.advanceTimersByTimeAsync(200)
    await flushPromises()

    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()

    expect(importFn).toHaveBeenCalledTimes(1)
    expect(importFn.mock.calls[0]![0]).toBe('planck/rev6')
    expect(importFn.mock.calls[0]![1]).toMatchObject({ name: 'planck/rev6' })
    vi.useRealTimers()
  })

  it('calls importFn without a cached layout when nothing was previewed', async () => {
    const importFn = vi.fn().mockResolvedValue(undefined)
    wrapper = await openModal({ importFn })

    await wrapper.findAll('.qmk-keyboard-item')[0]!.trigger('click')
    await wrapper.find('.btn-primary').trigger('click')
    await flushPromises()

    expect(importFn).toHaveBeenCalledWith('planck/rev6', undefined)
  })
})
