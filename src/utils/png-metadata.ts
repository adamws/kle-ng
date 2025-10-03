/**
 * PNG metadata utilities for embedding and extracting keyboard layout data
 * Uses PNG tEXt chunks to store KLE layout information
 */

import * as LZString from 'lz-string'

export interface PngMetadata {
  [key: string]: string
}

/**
 * Convert a Blob to ArrayBuffer
 */
function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = reject
    reader.readAsArrayBuffer(blob)
  })
}

/**
 * Convert ArrayBuffer to Blob
 */
function arrayBufferToBlob(buffer: ArrayBuffer, type: string = 'image/png'): Blob {
  return new Blob([buffer], { type })
}

/**
 * Calculate CRC32 checksum for PNG chunks
 */
function crc32(data: Uint8Array): number {
  const crcTable = new Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    }
    crcTable[i] = c
  }

  let crc = 0xffffffff
  for (let i = 0; i < data.length; i++) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/**
 * Create a PNG tEXt chunk with the given key and value
 */
function createTextChunk(key: string, value: string): Uint8Array {
  const keyBytes = new TextEncoder().encode(key)
  const valueBytes = new TextEncoder().encode(value)

  // tEXt chunk: key + null separator + value
  const dataLength = keyBytes.length + 1 + valueBytes.length
  const chunkData = new Uint8Array(dataLength)

  chunkData.set(keyBytes, 0)
  chunkData[keyBytes.length] = 0 // null separator
  chunkData.set(valueBytes, keyBytes.length + 1)

  // PNG chunk format: length (4 bytes) + type (4 bytes) + data + CRC (4 bytes)
  const chunk = new Uint8Array(4 + 4 + dataLength + 4)
  const view = new DataView(chunk.buffer)

  // Length (big-endian)
  view.setUint32(0, dataLength, false)

  // Chunk type "tEXt"
  chunk.set([0x74, 0x45, 0x58, 0x74], 4)

  // Data
  chunk.set(chunkData, 8)

  // CRC of type + data
  const crcData = new Uint8Array(4 + dataLength)
  crcData.set(chunk.slice(4, 8 + dataLength))
  const crc = crc32(crcData)
  view.setUint32(8 + dataLength, crc, false)

  return chunk
}

/**
 * Extract text chunks from PNG data
 */
function extractTextChunks(pngData: ArrayBuffer): PngMetadata {
  const data = new Uint8Array(pngData)
  const view = new DataView(pngData)
  const metadata: PngMetadata = {}

  // Check PNG signature
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  for (let i = 0; i < 8; i++) {
    if (data[i] !== pngSignature[i]) {
      throw new Error('Invalid PNG file format')
    }
  }

  let offset = 8 // Skip PNG signature

  while (offset < data.length) {
    if (offset + 8 > data.length) break

    // Read chunk length (big-endian)
    const chunkLength = view.getUint32(offset, false)
    offset += 4

    // Read chunk type
    const chunkType = String.fromCharCode(
      data[offset],
      data[offset + 1],
      data[offset + 2],
      data[offset + 3],
    )
    offset += 4

    // Process tEXt chunks
    if (chunkType === 'tEXt' && offset + chunkLength <= data.length) {
      const chunkData = data.slice(offset, offset + chunkLength)

      // Find null separator
      let nullIndex = -1
      for (let i = 0; i < chunkData.length; i++) {
        if (chunkData[i] === 0) {
          nullIndex = i
          break
        }
      }

      if (nullIndex > 0) {
        const key = new TextDecoder().decode(chunkData.slice(0, nullIndex))
        const value = new TextDecoder().decode(chunkData.slice(nullIndex + 1))
        metadata[key] = value
      }
    }

    // Skip chunk data and CRC
    offset += chunkLength + 4

    // Stop at IEND chunk
    if (chunkType === 'IEND') break
  }

  return metadata
}

/**
 * Add metadata to a PNG blob by inserting tEXt chunks before IEND
 */
export async function addMetadataToPng(pngBlob: Blob, metadata: PngMetadata): Promise<Blob> {
  const pngData = await blobToArrayBuffer(pngBlob)
  const data = new Uint8Array(pngData)
  const view = new DataView(pngData)

  // Find IEND chunk position
  let iendOffset = -1
  let offset = 8 // Skip PNG signature

  while (offset < data.length) {
    if (offset + 8 > data.length) break

    const chunkLength = view.getUint32(offset, false)
    const chunkType = String.fromCharCode(
      data[offset + 4],
      data[offset + 5],
      data[offset + 6],
      data[offset + 7],
    )

    if (chunkType === 'IEND') {
      iendOffset = offset
      break
    }

    offset += 8 + chunkLength + 4
  }

  if (iendOffset === -1) {
    throw new Error('Invalid PNG: IEND chunk not found')
  }

  // Create text chunks for each metadata entry
  const textChunks: Uint8Array[] = []
  for (const [key, value] of Object.entries(metadata)) {
    textChunks.push(createTextChunk(key, value))
  }

  // Calculate total size of new PNG
  const textChunksSize = textChunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const newSize = data.length + textChunksSize

  // Create new PNG data
  const newData = new Uint8Array(newSize)

  // Copy data before IEND
  newData.set(data.slice(0, iendOffset))

  // Insert text chunks
  let insertOffset = iendOffset
  for (const chunk of textChunks) {
    newData.set(chunk, insertOffset)
    insertOffset += chunk.length
  }

  // Copy IEND chunk
  newData.set(data.slice(iendOffset), insertOffset)

  return arrayBufferToBlob(newData.buffer)
}

/**
 * Extract metadata from a PNG blob
 */
export async function extractMetadataFromPng(pngBlob: Blob): Promise<PngMetadata> {
  const pngData = await blobToArrayBuffer(pngBlob)
  return extractTextChunks(pngData)
}

/**
 * Check if a PNG contains KLE layout metadata
 */
export async function hasKleMetadata(pngBlob: Blob): Promise<boolean> {
  try {
    const metadata = await extractMetadataFromPng(pngBlob)
    return 'KLE-Layout' in metadata || 'kle-layout' in metadata
  } catch {
    return false
  }
}

/**
 * Extract KLE layout data from PNG metadata
 */
export async function extractKleLayout(pngBlob: Blob): Promise<unknown | null> {
  try {
    const metadata = await extractMetadataFromPng(pngBlob)
    const layoutData = metadata['KLE-Layout'] || metadata['kle-layout']

    if (!layoutData) {
      return null
    }

    // Try to decompress the layout data first (new format)
    const decompressed = LZString.decompressFromBase64(layoutData)

    let parsedData
    if (decompressed) {
      // Successfully decompressed, parse the JSON
      parsedData = JSON.parse(decompressed)
    } else {
      // If decompression fails, treat as uncompressed JSON (fallback for any existing files)
      parsedData = JSON.parse(layoutData)
    }

    // Clean null values from extracted data (for backwards compatibility with old PNGs)
    return cleanNullValues(parsedData)
  } catch (error) {
    console.error('Error extracting KLE layout from PNG:', error)
    return null
  }
}

/**
 * Clean null values from KLE layout data
 * The KLE serial library can't handle null values in arrays during deserialization
 */
function cleanNullValues(data: unknown): unknown {
  if (data === null || data === undefined) {
    return undefined
  }
  if (Array.isArray(data)) {
    return data
      .map((item) => cleanNullValues(item))
      .filter((item) => item !== undefined && item !== null)
  }
  if (typeof data === 'object') {
    const cleaned: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const cleanedValue = cleanNullValues(value)
      if (cleanedValue !== undefined && cleanedValue !== null) {
        cleaned[key] = cleanedValue
      }
    }
    return cleaned
  }
  return data
}

/**
 * Create a PNG with embedded KLE layout metadata
 */
export async function createPngWithKleLayout(
  pngBlob: Blob,
  layoutData: unknown,
  additionalMetadata: PngMetadata = {},
): Promise<Blob> {
  // Clean null values from layout data before embedding
  const cleanedLayoutData = cleanNullValues(layoutData)

  // Compress the layout data using LZ-string
  const compressedLayout = LZString.compressToBase64(JSON.stringify(cleanedLayoutData))

  const metadata: PngMetadata = {
    ...additionalMetadata,
    'KLE-Layout': compressedLayout,
    Software: 'Keyboard Layout Editor NG',
    'Creation-Time': new Date().toISOString(),
  }

  return addMetadataToPng(pngBlob, metadata)
}
