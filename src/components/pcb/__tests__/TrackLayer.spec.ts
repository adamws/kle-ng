import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import TrackLayer from '../TrackLayer.vue'
import type { TrackItem } from '@/types/tracks'

const items: TrackItem[] = [
  { type: 'track', start: { x: 0, y: 0 }, end: { x: 1, y: 0 }, width: 0.25, layer: 'F.Cu' },
  { type: 'track', start: { x: 1, y: 0 }, end: { x: 1, y: 1 }, width: 0.25, layer: 'B.Cu' },
  { type: 'via', position: { x: 1, y: 0 }, diameter: 0.6, drillDiameter: 0.3 },
]

function render(props: Partial<InstanceType<typeof TrackLayer>['$props']> = {}) {
  return mount(TrackLayer, { props: { items, pxPerMm: 10, ...props } })
}

const drawn = (w: ReturnType<typeof render>) =>
  w.findAll('[data-testid="pcb-track-overlay-track"]').map((t) => t.attributes('data-item-index'))

describe('TrackLayer', () => {
  it('draws every track with an edge when no visibility is given', () => {
    const w = render()
    expect(drawn(w)).toEqual(['0', '1'])
    expect(w.findAll('.track-edge')).toHaveLength(2)
    expect(w.findAll('[data-testid="pcb-track-overlay-via"]')).toHaveLength(1)
  })

  it('hides tracks on hidden layers, and vias only when both are hidden', () => {
    expect(drawn(render({ visibleLayers: { 'F.Cu': false, 'B.Cu': true } }))).toEqual(['1'])
    const none = render({ visibleLayers: { 'F.Cu': false, 'B.Cu': false } })
    expect(drawn(none)).toEqual([])
    expect(none.findAll('.track-edge')).toHaveLength(0)
    expect(none.findAll('[data-testid="pcb-track-overlay-via"]')).toHaveLength(0)
  })

  it('highlights the hovered track unless it is selected', () => {
    expect(render({ hovered: 1 }).findAll('[data-testid="pcb-track-hover"]')).toHaveLength(1)
    const both = render({ hovered: 1, selected: [1] })
    expect(both.findAll('[data-testid="pcb-track-hover"]')).toHaveLength(0)
    expect(both.findAll('.track-halo')).toHaveLength(1)
  })
})
