import * as LZString from 'lz-string'
import { Serial, Keyboard } from '@adamws/kle-serial'
import type { KeyboardMetadata, Key } from '@adamws/kle-serial'

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

/**
 * Extract URL from current URL hash if present (#url=...)
 * Supports GitHub Gists, raw GitHub URLs, and any other JSON URL
 */
export function extractUrlFromCurrentUrl(): string | null {
  try {
    const hash = window.location.hash
    if (!hash.startsWith('#url=')) {
      return null
    }

    const urlParam = hash.substring(5) // Remove '#url='

    // Decode the URL in case it's URL-encoded
    const decodedUrl = decodeURIComponent(urlParam)

    return decodedUrl
  } catch (error) {
    console.error('Error extracting URL from hash:', error)
    return null
  }
}

/**
 * @deprecated Use extractUrlFromCurrentUrl() instead. This function is kept for backward compatibility.
 * Extract gist ID from current URL if present
 */
export function extractGistFromCurrentUrl(): string | null {
  try {
    const hash = window.location.hash
    if (!hash.startsWith('#gist=')) {
      return null
    }

    const gistIdentifier = hash.substring(6) // Remove '#gist='

    // Handle full gist URLs like: https://gist.github.com/username/gist_id
    if (gistIdentifier.startsWith('https://gist.github.com/')) {
      const match = gistIdentifier.match(/https:\/\/gist\.github\.com\/[^/]+\/([a-f0-9]+)/)
      if (match && match[1]) {
        return match[1]
      }
      throw new Error('Invalid gist URL format')
    }

    // Handle direct gist ID
    if (/^[a-f0-9]+$/i.test(gistIdentifier)) {
      return gistIdentifier
    }

    throw new Error('Invalid gist ID format')
  } catch (error) {
    console.error('Error extracting gist from URL:', error)
    return null
  }
}

/**
 * Find the best layout file from gist files
 */
function findLayoutFile(files: Record<string, { content: string }>): { content: string } | null {
  const fileNames = Object.keys(files)

  // Prioritized file name patterns for keyboard layouts
  const patterns = [
    /^layout\.json$/i,
    /^keyboard\.json$/i,
    /^kle\.json$/i,
    /layout/i,
    /keyboard/i,
    /\.json$/i,
  ]

  for (const pattern of patterns) {
    const matchingFile = fileNames.find((name) => pattern.test(name))
    if (matchingFile && files[matchingFile]) {
      return files[matchingFile]
    }
  }

  return null
}

/**
 * Fetch layout data from GitHub gist
 */
export async function fetchGistLayout(gistId: string): Promise<LayoutData> {
  try {
    const response = await fetch(`https://api.github.com/gists/${gistId}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        'X-Requested-With': 'XMLHttpRequest', // Help with CORS
      },
    })

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Gist not found')
      } else if (response.status === 403) {
        throw new Error('Rate limit exceeded or access denied')
      } else {
        throw new Error(`Failed to fetch gist: ${response.status}`)
      }
    }

    const gistData = await response.json()

    // Look for JSON files containing keyboard layout data
    const layoutFile = findLayoutFile(gistData.files)
    if (!layoutFile) {
      throw new Error('No keyboard layout file found in gist')
    }

    // Parse the layout data
    let kleData
    try {
      kleData = JSON.parse(layoutFile.content)
    } catch {
      throw new Error('Invalid JSON format in layout file')
    }

    // Validate that it looks like KLE format (should be an array)
    if (!Array.isArray(kleData)) {
      throw new Error('Invalid KLE layout data structure - expected array format')
    }

    // Deserialize using KLE's standard format
    const keyboard = Serial.deserialize(kleData)

    return {
      keys: keyboard.keys,
      metadata: keyboard.meta,
    }
  } catch (error) {
    console.error('Error fetching gist layout:', error)
    throw error instanceof Error ? error : new Error('Failed to fetch gist layout')
  }
}

/**
 * Clear URL import data from hash without page reload
 */
export function clearUrlFromHash(): void {
  if (window.location.hash.startsWith('#url=')) {
    // Remove the hash without triggering a page reload
    const url = window.location.href.split('#')[0]
    window.history.replaceState({}, document.title, url)
  }
}

/**
 * @deprecated Use clearUrlFromHash() instead. This function is kept for backward compatibility.
 * Clear gist data from URL without page reload
 */
export function clearGistFromUrl(): void {
  if (window.location.hash.startsWith('#gist=')) {
    // Remove the hash without triggering a page reload
    const url = window.location.href.split('#')[0]
    window.history.replaceState({}, document.title, url)
  }
}
