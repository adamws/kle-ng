import * as LZString from 'lz-string'
import { Serial, Keyboard } from '@ijprest/kle-serial'
import type { KeyboardMetadata, Key } from '@ijprest/kle-serial'

export interface LayoutData {
  keys: Key[]
  metadata: KeyboardMetadata
}

/**
 * Encode layout data into a compressed URL-safe string using KLE format
 */
export function encodeLayoutToUrl(layoutData: LayoutData): string {
  try {
    // Use KLE's standard serialization format which is much more compact
    const keyboard = new Keyboard()
    keyboard.keys = layoutData.keys
    keyboard.meta = layoutData.metadata

    const kleData = Serial.serialize(keyboard)
    const json = JSON.stringify(kleData)
    const compressed = LZString.compressToEncodedURIComponent(json)
    return compressed
  } catch (error) {
    console.error('Error encoding layout to URL:', error)
    throw new Error('Failed to encode layout data')
  }
}

/**
 * Decode a compressed URL string back to layout data
 */
export function decodeLayoutFromUrl(encodedData: string): LayoutData {
  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(encodedData)
    if (!decompressed) {
      throw new Error('Failed to decompress data')
    }

    const kleData = JSON.parse(decompressed)

    // Validate that it's an array (KLE format)
    if (!Array.isArray(kleData)) {
      throw new Error('Invalid KLE layout data structure')
    }

    // Deserialize using KLE's standard format
    const keyboard = Serial.deserialize(kleData)

    return {
      keys: keyboard.keys,
      metadata: keyboard.meta,
    }
  } catch (error) {
    console.error('Error decoding layout from URL:', error)
    throw new Error('Failed to decode layout data from URL')
  }
}

/**
 * Generate a shareable URL with encoded layout data
 */
export function generateShareableUrl(layoutData: LayoutData, baseUrl?: string): string {
  const encoded = encodeLayoutToUrl(layoutData)
  const base = baseUrl || window.location.origin + window.location.pathname
  return `${base}#share=${encoded}`
}

/**
 * Extract layout data from current URL if present
 */
export function extractLayoutFromCurrentUrl(): LayoutData | null {
  try {
    const hash = window.location.hash
    if (!hash.startsWith('#share=')) {
      return null
    }

    const encodedData = hash.substring(7) // Remove '#share='
    return decodeLayoutFromUrl(encodedData)
  } catch (error) {
    console.error('Error extracting layout from URL:', error)
    return null
  }
}

/**
 * Clear share data from URL without page reload
 */
export function clearShareFromUrl(): void {
  if (window.location.hash.startsWith('#share=')) {
    // Remove the hash without triggering a page reload
    const url = window.location.href.split('#')[0]
    window.history.replaceState({}, document.title, url)
  }
}
