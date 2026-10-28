import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { saveBlob } from '../download'

describe('saveBlob', () => {
  let clicked: Array<{ href: string; download: string }>

  beforeEach(() => {
    vi.useFakeTimers()
    clicked = []
    // jsdom implements neither of these, and will not follow a download anyway
    URL.createObjectURL = vi.fn(() => 'blob:mock')
    URL.revokeObjectURL = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push({ href: this.href, download: this.download })
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('clicks a download link for the blob', () => {
    const blob = new Blob(['x'], { type: 'text/plain' })

    saveBlob(blob, 'file.txt')

    expect(URL.createObjectURL).toHaveBeenCalledWith(blob)
    expect(clicked).toEqual([{ href: 'blob:mock', download: 'file.txt' }])
  })

  // Revoking in the same turn as the click has raced the download in Firefox and Safari
  it('revokes the URL only after the click has been handed off', () => {
    saveBlob(new Blob(['x']), 'file.txt')
    expect(URL.revokeObjectURL).not.toHaveBeenCalled()

    vi.runAllTimers()

    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })
})
