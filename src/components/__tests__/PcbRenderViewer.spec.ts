import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PcbRenderViewer from '../PcbRenderViewer.vue'
import PcbBuildLog from '../PcbBuildLog.vue'
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'

const baseProps = {
  frontSvg: 'blob:front',
  backSvg: 'blob:back',
  schematics: [{ name: 'schematic', sheet: '', label: 'Schematic', url: 'blob:schematic' }],
}

describe('PcbRenderViewer', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('does not show a Logs tab when hasLogs is false', () => {
    const wrapper = mount(PcbRenderViewer, { props: { ...baseProps, hasLogs: false } })
    const labels = wrapper.findAll('.tab-bar-item').map((t) => t.text())
    expect(labels).not.toContain('Logs')
  })

  it('appends a Logs tab as the last tab when hasLogs is true', () => {
    const wrapper = mount(PcbRenderViewer, { props: { ...baseProps, hasLogs: true } })
    const labels = wrapper.findAll('.tab-bar-item').map((t) => t.text())
    expect(labels[labels.length - 1]).toBe('Logs')
  })

  it('renders the build-log terminal (not the SVG viewer) when the Logs tab is active', async () => {
    const store = usePcbGeneratorStore()
    store.buildLogs = [{ source: 'worker', line: 'Task completed successfully' }]

    const wrapper = mount(PcbRenderViewer, { props: { ...baseProps, hasLogs: true } })

    // SVG viewer shown by default
    expect(wrapper.find('.svg-container').exists()).toBe(true)
    expect(wrapper.findComponent(PcbBuildLog).exists()).toBe(false)

    // Click the Logs tab
    const logsTab = wrapper.findAll('.tab-bar-item').find((t) => t.text() === 'Logs')!
    await logsTab.trigger('click')

    expect(wrapper.find('.svg-container').exists()).toBe(false)
    const buildLog = wrapper.findComponent(PcbBuildLog)
    expect(buildLog.exists()).toBe(true)
    expect(buildLog.props('fill')).toBe(true)
    expect(buildLog.text()).toContain('Task completed successfully')
  })
})
