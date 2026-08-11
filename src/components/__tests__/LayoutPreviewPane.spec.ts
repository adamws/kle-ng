import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import LayoutPreviewPane from '../LayoutPreviewPane.vue'
import type { LayoutPreviewRenderer } from '@/utils/preview/layout-preview-renderer'
import type { PreviewLayout } from '@/utils/preview/layout-source'
import type { PreviewState } from '@/composables/useLayoutPreview'

const makeLayout = (overrides: Partial<PreviewLayout> = {}): PreviewLayout =>
  ({
    name: 'planck/rev6',
    raw: {},
    keyboard: { keys: [], meta: {} },
    variants: [
      { label: 'LAYOUT_ortho_4x12', keys: [] },
      { label: 'LAYOUT_planck_2x2u', keys: [] },
    ],
    keyCount: 47,
    tooLarge: false,
    ...overrides,
  }) as unknown as PreviewLayout

const stubRenderer = () =>
  ({
    render: vi.fn().mockReturnValue({
      canvas: document.createElement('canvas'),
      cssWidth: 200,
      cssHeight: 80,
      scale: 0.5,
      unitsWide: 12,
      unitsTall: 4,
    }),
    dispose: vi.fn(),
  }) as unknown as LayoutPreviewRenderer

const mountPane = (props: Partial<Record<string, unknown>> = {}) =>
  mount(LayoutPreviewPane, {
    props: {
      state: 'idle' as PreviewState,
      layout: null,
      variantIndex: 0,
      name: null,
      errorMessage: null,
      renderer: stubRenderer(),
      ...props,
    },
  })

describe('LayoutPreviewPane', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the idle hint before anything is hovered', () => {
    const wrapper = mountPane()
    expect(wrapper.find('[data-testid="layout-preview-idle"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="layout-preview-progress"]').exists()).toBe(false)
  })

  it('shows an accessible indeterminate progress bar while loading', () => {
    const wrapper = mountPane({ state: 'loading', name: 'planck/rev6' })

    const progress = wrapper.find('[data-testid="layout-preview-progress"]')
    expect(progress.exists()).toBe(true)
    expect(progress.attributes('role')).toBe('progressbar')
    expect(progress.attributes('aria-valuetext')).toBe('Loading…')
    expect(progress.find('.progress-bar-indeterminate').exists()).toBe(true)
    expect(wrapper.text()).toContain('planck/rev6')
  })

  it('renders the error message inline rather than throwing it away', () => {
    const wrapper = mountPane({ state: 'error', errorMessage: 'Failed to fetch: 404 Not Found' })

    expect(wrapper.find('[data-testid="layout-preview-error"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Failed to fetch: 404 Not Found')
  })

  it('explains when a layout is too large to import', () => {
    const wrapper = mountPane({
      state: 'too-large',
      layout: makeLayout({ keyCount: 1500, tooLarge: true }),
    })

    expect(wrapper.find('[data-testid="layout-preview-too-large"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('1500 keys')
  })

  it('draws the active variant and reports its dimensions when ready', async () => {
    const renderer = stubRenderer()
    const layout = makeLayout()
    const wrapper = mountPane({ state: 'ready', layout, renderer })
    await wrapper.vm.$nextTick()

    expect(renderer.render).toHaveBeenCalled()
    expect(wrapper.text()).toContain('planck/rev6')
    expect(wrapper.text()).toContain('12 × 4u')
  })

  it('shows variant chips only for multi-variant layouts', async () => {
    const single = mountPane({
      state: 'ready',
      layout: makeLayout({ variants: [{ label: 'LAYOUT', keys: [] }] }),
    })
    await single.vm.$nextTick()
    expect(single.find('[data-testid="layout-preview-variant-next"]').exists()).toBe(false)

    const multi = mountPane({ state: 'ready', layout: makeLayout() })
    await multi.vm.$nextTick()
    expect(multi.find('[data-testid="layout-preview-variant-next"]').exists()).toBe(true)
    expect(multi.text()).toContain('LAYOUT_ortho_4x12 (1/2)')
  })

  it('emits variant navigation events', async () => {
    const wrapper = mountPane({ state: 'ready', layout: makeLayout() })
    await wrapper.vm.$nextTick()

    await wrapper.find('[data-testid="layout-preview-variant-next"]').trigger('click')
    await wrapper.find('[data-testid="layout-preview-variant-prev"]').trigger('click')

    expect(wrapper.emitted('next-variant')).toHaveLength(1)
    expect(wrapper.emitted('previous-variant')).toHaveLength(1)
  })

  it('sizes the canvas to the content box, not the padded stage', async () => {
    // The stage's clientWidth/clientHeight include its padding. Measuring those
    // made every scaled-down layout overflow by the padding and push the stage —
    // and with it the modal — taller. The host is inset to the content box, so
    // it is the only honest measurement of the space available.
    const renderer = stubRenderer()
    const wrapper = mountPane({ state: 'ready', layout: makeLayout(), renderer })
    await wrapper.vm.$nextTick()

    const stage = wrapper.find('.preview-stage').element
    const host = wrapper.find('.preview-canvas-host').element
    const size = (el: Element, w: number, h: number) => {
      Object.defineProperty(el, 'clientWidth', { value: w, configurable: true })
      Object.defineProperty(el, 'clientHeight', { value: h, configurable: true })
    }
    size(stage, 416, 341) // padding box: content + 2 * 0.5rem
    size(host, 400, 325) // content box

    await wrapper.setProps({ variantIndex: 1 })
    await wrapper.vm.$nextTick()

    const calls = (renderer.render as ReturnType<typeof vi.fn>).mock.calls
    expect(calls[calls.length - 1]![2]).toMatchObject({ maxWidth: 400, maxHeight: 325 })
  })

  it('redraws when the selected variant changes', async () => {
    const renderer = stubRenderer()
    const wrapper = mountPane({ state: 'ready', layout: makeLayout(), renderer })
    await wrapper.vm.$nextTick()
    const initialCalls = (renderer.render as ReturnType<typeof vi.fn>).mock.calls.length

    await wrapper.setProps({ variantIndex: 1 })
    await wrapper.vm.$nextTick()

    expect((renderer.render as ReturnType<typeof vi.fn>).mock.calls.length).toBeGreaterThan(
      initialCalls,
    )
  })
})
