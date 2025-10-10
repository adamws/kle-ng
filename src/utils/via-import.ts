import LZString from 'lz-string'

/**
 * Type guard to check if data is in VIA format
 * VIA format is an object that contains a 'layouts' property with a 'keymap' array
 */
export function isViaFormat(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) {
    return false
  }

  const obj = data as Record<string, unknown>

  // VIA format must have a 'layouts' object with a 'keymap' array
  if (!obj.layouts || typeof obj.layouts !== 'object') {
    return false
  }

  const layouts = obj.layouts as Record<string, unknown>
  if (!Array.isArray(layouts.keymap)) {
    return false
  }

  // Additional checks: VIA files typically have name, vendorId, productId
  // But we'll be lenient and just check for the essential keymap
  return true
}

/**
 * Convert VIA format to KLE format with embedded VIA metadata
 *
 * Process:
 * 1. Create a copy of the VIA data
 * 2. Extract the keymap (which is raw KLE data)
 * 3. Remove keymap from the copy to get VIA-specific metadata
 * 4. Compress the VIA metadata using lz-string
 * 5. Embed it into the KLE data as a metadata field '_kleng_via_data'
 *
 * @param viaData - The VIA format data
 * @returns KLE format array with embedded VIA metadata
 */
export function convertViaToKle(viaData: unknown): unknown {
  if (!isViaFormat(viaData)) {
    throw new Error('Invalid VIA format: missing layouts.keymap')
  }

  // Step 1: Create a deep copy of the VIA data
  const viaCopy = JSON.parse(JSON.stringify(viaData)) as Record<string, unknown>

  // Step 2: Extract the keymap (this is raw KLE data)
  const layouts = viaCopy.layouts as Record<string, unknown>
  const kleData = layouts.keymap as unknown[]

  // Step 3: Remove keymap from the copy to create VIA-specific metadata
  delete layouts.keymap
  const viaMetadata = viaCopy

  // Step 4: Compress the VIA metadata using lz-string
  const viaMetadataJson = JSON.stringify(viaMetadata)
  const compressedViaData = LZString.compressToBase64(viaMetadataJson)

  // Step 5: Embed the compressed VIA data into the KLE data as metadata
  // KLE format supports metadata in the first element if it's an object
  // We'll add it to the first row's metadata object
  if (!Array.isArray(kleData) || kleData.length === 0) {
    throw new Error('Invalid VIA format: keymap is empty')
  }

  // Ensure the first element is an array (first row)
  // If it's not an array, we need to wrap the entire keymap appropriately
  // But typically VIA keymaps are already in proper KLE array format

  // Create metadata object to insert at the beginning
  const metadataObject = {
    _kleng_via_data: compressedViaData,
  }

  // Insert metadata object as the first element of the first row
  // KLE format: [ [metadata, key, key, ...], [key, key, ...], ... ]
  const kleDataWithMetadata = JSON.parse(JSON.stringify(kleData)) as unknown[]

  // If first element is an array (first row), prepend metadata to it
  if (Array.isArray(kleDataWithMetadata[0])) {
    ;(kleDataWithMetadata[0] as unknown[]).unshift(metadataObject)
  } else {
    // If it's not an array structure, wrap everything in an array with metadata
    kleDataWithMetadata.unshift(metadataObject)
  }

  return kleDataWithMetadata
}

/**
 * Extract VIA metadata from KLE data if it exists
 *
 * @param kleData - KLE format data that may contain embedded VIA metadata
 * @returns Decompressed VIA metadata object, or null if not found
 */
export function extractViaMetadata(kleData: unknown): Record<string, unknown> | null {
  if (!Array.isArray(kleData)) {
    return null
  }

  // Search for _kleng_via_data in the first few elements
  // It should be in the first row's first object
  for (const row of kleData.slice(0, 3)) {
    // Check first 3 rows
    if (Array.isArray(row)) {
      for (const element of row.slice(0, 3)) {
        // Check first 3 elements of each row
        if (typeof element === 'object' && element !== null && '_kleng_via_data' in element) {
          const compressed = (element as Record<string, unknown>)._kleng_via_data as string
          try {
            const decompressed = LZString.decompressFromBase64(compressed)
            if (decompressed) {
              return JSON.parse(decompressed) as Record<string, unknown>
            }
          } catch (error) {
            console.warn('Failed to decompress VIA metadata:', error)
            return null
          }
        }
      }
    } else if (typeof row === 'object' && row !== null && '_kleng_via_data' in row) {
      const compressed = (row as Record<string, unknown>)._kleng_via_data as string
      try {
        const decompressed = LZString.decompressFromBase64(compressed)
        if (decompressed) {
          return JSON.parse(decompressed) as Record<string, unknown>
        }
      } catch (error) {
        console.warn('Failed to decompress VIA metadata:', error)
        return null
      }
    }
  }

  return null
}

/**
 * Convert KLE data with embedded VIA metadata back to VIA format
 *
 * @param kleData - KLE format data with embedded VIA metadata
 * @returns VIA format data, or null if no VIA metadata found
 */
export function convertKleToVia(kleData: unknown): Record<string, unknown> | null {
  const viaMetadata = extractViaMetadata(kleData)
  if (!viaMetadata) {
    return null
  }

  // Remove the metadata object from KLE data to get clean keymap
  const cleanKleData = JSON.parse(JSON.stringify(kleData)) as unknown[]

  // Remove _kleng_via_data from the KLE data
  if (Array.isArray(cleanKleData)) {
    for (let i = 0; i < Math.min(3, cleanKleData.length); i++) {
      const row = cleanKleData[i]
      if (Array.isArray(row)) {
        cleanKleData[i] = (row as unknown[])
          .map((element) => {
            // If element is an object with _kleng_via_data, remove that property
            if (typeof element === 'object' && element !== null && '_kleng_via_data' in element) {
              const cleaned = { ...element }
              delete (cleaned as Record<string, unknown>)._kleng_via_data

              // If the object only had _kleng_via_data, filter it out entirely
              if (Object.keys(cleaned).length === 0) {
                return null
              }
              return cleaned
            }
            return element
          })
          .filter((element) => element !== null) // Remove null entries (objects that only had _kleng_via_data)
      } else if (typeof row === 'object' && row !== null && '_kleng_via_data' in row) {
        // Handle case where row itself is an object with _kleng_via_data
        const cleaned = { ...row }
        delete (cleaned as Record<string, unknown>)._kleng_via_data

        // If the object only had _kleng_via_data, remove the row entirely
        if (Object.keys(cleaned).length > 0) {
          cleanKleData[i] = cleaned
        } else {
          cleanKleData[i] = null
        }
      }
    }

    // Remove any null rows
    const filtered = cleanKleData.filter((row) => row !== null)
    return {
      ...viaMetadata,
      layouts: {
        ...((viaMetadata.layouts as Record<string, unknown>) || {}),
        keymap: filtered,
      },
    }
  }

  // Fallback: return original if not an array
  return {
    ...viaMetadata,
    layouts: {
      ...((viaMetadata.layouts as Record<string, unknown>) || {}),
      keymap: cleanKleData,
    },
  }
}
