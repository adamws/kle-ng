/**
 * Pixel-based (LSB steganography) fallback for embedding KLE layout data in
 * PNG images.
 *
 * The primary mechanism (see png-metadata.ts) stores the layout in PNG `tEXt`
 * chunks. However, most browsers re-encode images placed on the system
 * clipboard, which strips those ancillary chunks. PNG pixel data, on the other
 * hand, is preserved losslessly through such a re-encode, so we additionally
 * hide the layout in the least-significant bit of each pixel's alpha channel
 * (the least visually destructive channel). This lets a layout image copied to
 * the clipboard still round-trip back into the editor after being pasted and
 * saved elsewhere.
 */

import * as LZString from 'lz-string'
import { cleanNullValues, extractKleLayout } from '@/utils/png-metadata'

// "KLENG" — magic prefix so we can detect our payload and avoid mis-reading the
// LSBs of an unrelated image as metadata.
const MAGIC = [0x4b, 0x4c, 0x45, 0x4e, 0x47]
// magic (5 bytes) + payload length as big-endian uint32 (4 bytes)
const HEADER_BYTES = MAGIC.length + 4

/**
 * Embed the KLE layout into the alpha-channel LSBs of the given ImageData
 * (mutates it in place). Returns true on success, or false if the image is too
 * small to hold the payload (caller should then fall back to tEXt only).
 */
export function embedKleLayoutInImageData(imageData: ImageData, layoutData: unknown): boolean {
  const compressed = LZString.compressToBase64(JSON.stringify(cleanNullValues(layoutData)))
  const bytes = new TextEncoder().encode(compressed)

  const payload = new Uint8Array(HEADER_BYTES + bytes.length)
  payload.set(MAGIC, 0)
  new DataView(payload.buffer).setUint32(MAGIC.length, bytes.length, false)
  payload.set(bytes, HEADER_BYTES)

  const data = imageData.data
  const capacityBits = data.length / 4 // one bit per pixel (alpha LSB)
  const totalBits = payload.length * 8
  if (totalBits > capacityBits) {
    return false
  }

  for (let i = 0; i < totalBits; i++) {
    const bit = (payload[i >> 3]! >> (7 - (i & 7))) & 1
    const alphaIndex = i * 4 + 3
    data[alphaIndex] = (data[alphaIndex]! & 0xfe) | bit
  }

  return true
}

/**
 * Recover a KLE layout previously embedded with embedKleLayoutInImageData.
 * Returns the parsed (null-cleaned) layout data, or null if no valid payload is
 * present.
 */
export function extractKleLayoutFromImageData(imageData: ImageData): unknown | null {
  const data = imageData.data
  const pixelCount = data.length / 4

  // Not enough pixels to even hold the header
  if (pixelCount < HEADER_BYTES * 8) {
    return null
  }

  const readByte = (byteIndex: number): number => {
    let byte = 0
    for (let k = 0; k < 8; k++) {
      const bitIndex = byteIndex * 8 + k
      byte = (byte << 1) | (data[bitIndex * 4 + 3]! & 1)
    }
    return byte
  }

  // Validate magic prefix
  for (let m = 0; m < MAGIC.length; m++) {
    if (readByte(m) !== MAGIC[m]) {
      return null
    }
  }

  // Read payload length
  let length = 0
  for (let m = 0; m < 4; m++) {
    length = length * 256 + readByte(MAGIC.length + m)
  }

  const capacityBytes = Math.floor(pixelCount / 8)
  if (length <= 0 || HEADER_BYTES + length > capacityBytes) {
    return null
  }

  const bytes = new Uint8Array(length)
  for (let m = 0; m < length; m++) {
    bytes[m] = readByte(HEADER_BYTES + m)
  }

  try {
    const compressed = new TextDecoder().decode(bytes)
    const decompressed = LZString.decompressFromBase64(compressed)
    if (!decompressed) {
      return null
    }
    return cleanNullValues(JSON.parse(decompressed))
  } catch {
    return null
  }
}

/**
 * Decode a PNG blob into ImageData via an offscreen canvas. Returns null if the
 * blob can't be decoded or a canvas context isn't available (e.g. non-browser
 * environments).
 */
export async function blobToImageData(blob: Blob): Promise<ImageData | null> {
  try {
    const bitmap = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close?.()
      return null
    }
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close?.()
    return ctx.getImageData(0, 0, canvas.width, canvas.height)
  } catch {
    return null
  }
}

/**
 * Extract an embedded KLE layout from a PNG blob, preferring the standard tEXt
 * metadata and falling back to the pixel-embedded (LSB) copy when the tEXt
 * chunks are absent (e.g. the image was re-encoded by the clipboard). Returns
 * the parsed layout data, or null if neither source contains a valid layout.
 */
export async function extractKleLayoutWithFallback(pngBlob: Blob): Promise<unknown | null> {
  const fromText = await extractKleLayout(pngBlob)
  if (fromText) {
    return fromText
  }

  const imageData = await blobToImageData(pngBlob)
  if (!imageData) {
    return null
  }
  return extractKleLayoutFromImageData(imageData)
}
