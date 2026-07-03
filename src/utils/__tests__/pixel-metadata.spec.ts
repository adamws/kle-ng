import { describe, it, expect } from 'vitest'
import { embedKleLayoutInImageData, extractKleLayoutFromImageData } from '@/utils/pixel-metadata'

// Build a minimal ImageData-like object backed by a Uint8ClampedArray. The pure
// embed/extract functions only touch `.data`, so we avoid needing a real canvas.
function makeImageData(pixelCount: number, fillAlpha = 255): ImageData {
  const data = new Uint8ClampedArray(pixelCount * 4)
  for (let i = 0; i < pixelCount; i++) {
    data[i * 4 + 3] = fillAlpha
  }
  return { data, width: pixelCount, height: 1, colorSpace: 'srgb' } as ImageData
}

const sampleLayout = [
  { name: 'Test Layout', author: 'tester' },
  ['Esc', 'Q', 'W', 'E', 'R', 'T', 'Y'],
  [{ x: 0.5 }, 'A', 'S', 'D', 'F'],
]

describe('pixel-metadata (LSB steganography)', () => {
  it('round-trips a KLE layout through the alpha-channel LSBs', () => {
    const imageData = makeImageData(20000)
    const ok = embedKleLayoutInImageData(imageData, sampleLayout)
    expect(ok).toBe(true)

    const recovered = extractKleLayoutFromImageData(imageData)
    expect(recovered).toEqual(sampleLayout)
  })

  it('only modifies the alpha channel (RGB untouched)', () => {
    const imageData = makeImageData(20000)
    for (let i = 0; i < imageData.data.length; i += 4) {
      imageData.data[i] = 10
      imageData.data[i + 1] = 20
      imageData.data[i + 2] = 30
    }
    embedKleLayoutInImageData(imageData, sampleLayout)
    for (let i = 0; i < imageData.data.length; i += 4) {
      expect(imageData.data[i]).toBe(10)
      expect(imageData.data[i + 1]).toBe(20)
      expect(imageData.data[i + 2]).toBe(30)
    }
  })

  it('returns false when the image is too small to hold the payload', () => {
    const imageData = makeImageData(16)
    expect(embedKleLayoutInImageData(imageData, sampleLayout)).toBe(false)
  })

  it('returns null when no payload is present (random image)', () => {
    const imageData = makeImageData(20000)
    // Alpha all 255 → LSBs all 1 → magic won't match
    expect(extractKleLayoutFromImageData(imageData)).toBeNull()
  })

  it('returns null for an image too small to contain a header', () => {
    const imageData = makeImageData(4)
    expect(extractKleLayoutFromImageData(imageData)).toBeNull()
  })
})
