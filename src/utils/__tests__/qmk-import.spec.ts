import { describe, it, expect } from 'vitest'
import LZString from 'lz-string'
import { isQmkFormat, convertQmkToKle, extractQmkMetadata } from '../qmk-import'

describe('QMK Import', () => {
  describe('isQmkFormat', () => {
    it('should return true for valid QMK format', () => {
      const qmkData = {
        keyboard_name: 'Test',
        layouts: {
          LAYOUT_default: {
            layout: [
              { matrix: [0, 0], x: 0, y: 0 },
              { matrix: [0, 1], x: 1, y: 0 },
            ],
          },
        },
      }
      expect(isQmkFormat(qmkData)).toBe(true)
    })

    it('should return false for VIA format', () => {
      const viaData = {
        name: 'Test',
        layouts: {
          keymap: [['A', 'B', 'C']],
        },
      }
      expect(isQmkFormat(viaData)).toBe(false)
    })

    it('should return false for raw KLE format', () => {
      const kleData = [
        ['A', 'B', 'C'],
        ['D', 'E', 'F'],
      ]
      expect(isQmkFormat(kleData)).toBe(false)
    })

    it('should return false for internal KLE format', () => {
      const internalData = {
        meta: { name: 'Test' },
        keys: [{ x: 0, y: 0 }],
      }
      expect(isQmkFormat(internalData)).toBe(false)
    })

    it('should return false for null', () => {
      expect(isQmkFormat(null)).toBe(false)
    })

    it('should return false for objects without layouts', () => {
      const data = { keyboard_name: 'Test' }
      expect(isQmkFormat(data)).toBe(false)
    })

    it('should return false for layouts without layout arrays', () => {
      const data = {
        layouts: {
          LAYOUT: { other: 'data' },
        },
      }
      expect(isQmkFormat(data)).toBe(false)
    })

    it('should return false for layout arrays without matrix property', () => {
      const data = {
        layouts: {
          LAYOUT: {
            layout: [{ x: 0, y: 0 }], // Missing matrix
          },
        },
      }
      expect(isQmkFormat(data)).toBe(false)
    })
  })

  describe('extractQmkMetadata', () => {
    it('should extract keyboard_name as name', () => {
      const data = { keyboard_name: 'Corne' }
      const meta = extractQmkMetadata(data)
      expect(meta.name).toBe('Corne')
    })

    it('should extract manufacturer as author', () => {
      const data = { manufacturer: 'foostan' }
      const meta = extractQmkMetadata(data)
      expect(meta.author).toBe('foostan')
    })

    it('should handle missing properties', () => {
      const data = {}
      const meta = extractQmkMetadata(data)
      expect(meta.name).toBeUndefined()
      expect(meta.author).toBeUndefined()
    })

    it('should handle null input', () => {
      const meta = extractQmkMetadata(null)
      expect(meta).toEqual({})
    })
  })

  describe('convertQmkToKle', () => {
    it('should convert a simple QMK layout to KLE', () => {
      const qmkData = {
        keyboard_name: 'Test Keyboard',
        manufacturer: 'Test Mfg',
        layouts: {
          LAYOUT: {
            layout: [
              { matrix: [0, 0], x: 0, y: 0 },
              { matrix: [0, 1], x: 1, y: 0 },
              { matrix: [1, 0], x: 0, y: 1 },
              { matrix: [1, 1], x: 1, y: 1 },
            ],
          },
        },
      }

      const keyboard = convertQmkToKle(qmkData)

      expect(keyboard.keys).toHaveLength(4)
      expect(keyboard.meta.name).toBe('Test Keyboard')
      expect(keyboard.meta.author).toBe('Test Mfg')
    })

    it('should set matrix coordinates in labels[0]', () => {
      const qmkData = {
        layouts: {
          LAYOUT: {
            layout: [{ matrix: [2, 3], x: 0, y: 0 }],
          },
        },
      }

      const keyboard = convertQmkToKle(qmkData)

      expect(keyboard.keys[0]?.labels[0]).toBe('2,3')
    })

    it('should handle width and height', () => {
      const qmkData = {
        layouts: {
          LAYOUT: {
            layout: [{ matrix: [0, 0], x: 0, y: 0, w: 2, h: 1.5 }],
          },
        },
      }

      const keyboard = convertQmkToKle(qmkData)

      expect(keyboard.keys[0]?.width).toBe(2)
      expect(keyboard.keys[0]?.height).toBe(1.5)
    })

    it('should always produce rectangular keys (width2=width, height2=height)', () => {
      const qmkData = {
        layouts: {
          LAYOUT: {
            layout: [
              { matrix: [0, 0], x: 0, y: 0 }, // Default 1x1
              { matrix: [0, 1], x: 1, y: 0, w: 2 }, // Wide key
              { matrix: [0, 2], x: 3, y: 0, h: 1.5 }, // Tall key
              { matrix: [0, 3], x: 4, y: 0, w: 1.5, h: 2 }, // Both dimensions
            ],
          },
        },
      }

      const keyboard = convertQmkToKle(qmkData)

      // QMK doesn't support non-rectangular keys, so width2=width and height2=height
      keyboard.keys.forEach((key) => {
        expect(key.width2).toBe(key.width)
        expect(key.height2).toBe(key.height)
      })
    })

    it('should handle rotation properties', () => {
      const qmkData = {
        layouts: {
          LAYOUT: {
            layout: [{ matrix: [0, 0], x: 0, y: 0, r: 15, rx: 4.5, ry: 9.1 }],
          },
        },
      }

      const keyboard = convertQmkToKle(qmkData)

      expect(keyboard.keys[0]?.rotation_angle).toBe(15)
      expect(keyboard.keys[0]?.rotation_x).toBe(4.5)
      expect(keyboard.keys[0]?.rotation_y).toBe(9.1)
    })

    it('should sort keys by matrix position', () => {
      const qmkData = {
        layouts: {
          LAYOUT: {
            layout: [
              { matrix: [1, 1], x: 1, y: 1 },
              { matrix: [0, 0], x: 0, y: 0 },
              { matrix: [0, 1], x: 1, y: 0 },
              { matrix: [1, 0], x: 0, y: 1 },
            ],
          },
        },
      }

      const keyboard = convertQmkToKle(qmkData)

      expect(keyboard.keys[0]?.labels[0]).toBe('0,0')
      expect(keyboard.keys[1]?.labels[0]).toBe('0,1')
      expect(keyboard.keys[2]?.labels[0]).toBe('1,0')
      expect(keyboard.keys[3]?.labels[0]).toBe('1,1')
    })

    it('should deduplicate identical keys across layouts', () => {
      const qmkData = {
        layouts: {
          LAYOUT_ansi: {
            layout: [{ matrix: [0, 0], x: 0, y: 0 }],
          },
          LAYOUT_iso: {
            layout: [
              { matrix: [0, 0], x: 0, y: 0 }, // Same key
            ],
          },
        },
      }

      const keyboard = convertQmkToKle(qmkData)

      // Should have only 1 key (shared across both layouts)
      expect(keyboard.keys).toHaveLength(1)
      // Shared key has no membership tag
      expect(keyboard.keys[0]?.labels[9] ?? '').toBe('')
    })

    it('should keep both keys when same matrix position has different sizes across layouts', () => {
      const qmkData = {
        layouts: {
          LAYOUT_ansi: {
            layout: [{ matrix: [0, 0], x: 0, y: 0, w: 2.25 }],
          },
          LAYOUT_iso: {
            layout: [{ matrix: [0, 0], x: 0, y: 0, w: 1.25 }],
          },
        },
      }

      const keyboard = convertQmkToKle(qmkData)

      // Both physical configurations must be preserved
      expect(keyboard.keys).toHaveLength(2)
      // Neither should use labels[8] (no VIA option/choice)
      expect(keyboard.keys[0]?.labels[8] ?? '').toBe('')
      expect(keyboard.keys[1]?.labels[8] ?? '').toBe('')
      // Each must carry a labels[9] membership tag
      expect(keyboard.keys[0]?.labels[9]).toBeTruthy()
      expect(keyboard.keys[1]?.labels[9]).toBeTruthy()
    })

    it('should assign correct layout membership in labels[9]', () => {
      // 3 layouts: key [0,0] identical in all; key [0,1] differs between 0 and 1+2
      const qmkData = {
        layouts: {
          LAYOUT_a: {
            layout: [
              { matrix: [0, 0], x: 0, y: 0 }, // shared
              { matrix: [0, 1], x: 1, y: 0, w: 2 }, // layout 0 only
            ],
          },
          LAYOUT_b: {
            layout: [
              { matrix: [0, 0], x: 0, y: 0 }, // shared
              { matrix: [0, 1], x: 1, y: 0, w: 1 }, // layouts 1 and 2
            ],
          },
          LAYOUT_c: {
            layout: [
              { matrix: [0, 0], x: 0, y: 0 }, // shared
              { matrix: [0, 1], x: 1, y: 0, w: 1 }, // layouts 1 and 2
              { matrix: [0, 2], x: 2, y: 0 }, // layout 2 only
            ],
          },
        },
      }

      const keyboard = convertQmkToKle(qmkData)

      expect(keyboard.keys).toHaveLength(4) // [0,0] shared + [0,1] w=2 + [0,1] w=1 + [0,2]

      const shared = keyboard.keys.find((k) => k.labels[0] === '0,0')
      expect(shared?.labels[9] ?? '').toBe('')

      const wide = keyboard.keys.find((k) => k.labels[0] === '0,1' && k.width === 2)
      expect(wide?.labels[9]).toBe('0')

      const narrow = keyboard.keys.find((k) => k.labels[0] === '0,1' && k.width === 1)
      expect(narrow?.labels[9]).toBe('1;2')

      const extra = keyboard.keys.find((k) => k.labels[0] === '0,2')
      expect(extra?.labels[9]).toBe('2')
    })

    it('should throw error for invalid format', () => {
      expect(() => convertQmkToKle({ invalid: 'data' })).toThrow()
    })

    it('should embed _kleng_qmk_data in keyboard.meta', () => {
      const qmkData = {
        keyboard_name: 'Test',
        manufacturer: 'Tester',
        layouts: {
          LAYOUT: {
            layout: [{ matrix: [0, 0], x: 0, y: 0 }],
          },
        },
      }
      const keyboard = convertQmkToKle(qmkData)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((keyboard.meta as any)._kleng_qmk_data).toBeDefined()
    })

    it('should store layout names but not key definitions in _kleng_qmk_data', () => {
      const qmkData = {
        keyboard_name: 'Test',
        layouts: {
          LAYOUT_default: {
            layout: [
              { matrix: [0, 0], x: 0, y: 0 },
              { matrix: [0, 1], x: 1, y: 0 },
            ],
          },
        },
      }
      const keyboard = convertQmkToKle(qmkData)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const compressed = (keyboard.meta as any)._kleng_qmk_data as string
      const stored = JSON.parse(LZString.decompressFromBase64(compressed)!)

      expect(Object.keys(stored.layouts)).toContain('LAYOUT_default')
      expect(stored.layouts.LAYOUT_default).toEqual({}) // no key definitions
    })

    it('should store all layout names when multiple layouts present', () => {
      const qmkData = {
        layouts: {
          LAYOUT_ansi: { layout: [{ matrix: [0, 0], x: 0, y: 0, w: 2.25 }] },
          LAYOUT_iso: { layout: [{ matrix: [0, 0], x: 0, y: 0, w: 1.25 }] },
        },
      }
      const keyboard = convertQmkToKle(qmkData)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const compressed = (keyboard.meta as any)._kleng_qmk_data as string
      const stored = JSON.parse(LZString.decompressFromBase64(compressed)!)

      expect(Object.keys(stored.layouts)).toEqual(['LAYOUT_ansi', 'LAYOUT_iso'])
    })

    it('should preserve extra QMK fields in _kleng_qmk_data', () => {
      const qmkData = {
        keyboard_name: 'Test',
        manufacturer: 'Tester',
        url: 'https://example.com',
        maintainer: 'testuser',
        layouts: {
          LAYOUT: { layout: [{ matrix: [0, 0], x: 0, y: 0 }] },
        },
      }
      const keyboard = convertQmkToKle(qmkData)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const compressed = (keyboard.meta as any)._kleng_qmk_data as string
      const stored = JSON.parse(LZString.decompressFromBase64(compressed)!)

      expect(stored.url).toBe('https://example.com')
      expect(stored.maintainer).toBe('testuser')
    })

    it('should handle real Corne-like layout', () => {
      // Simplified version of the Corne layout
      const qmkData = {
        keyboard_name: 'Corne',
        manufacturer: 'foostan',
        layouts: {
          LAYOUT_default: {
            layout: [
              { matrix: [0, 0], x: 0.5, y: 1.375 },
              { matrix: [0, 1], x: 1.5, y: 1.375 },
              { matrix: [0, 2], x: 2.5, y: 1.125 },
              { matrix: [3, 5], x: 4, y: 4.25, h: 1.5, r: 30, rx: 5.4, ry: 9.3 },
            ],
          },
        },
      }

      const keyboard = convertQmkToKle(qmkData)

      expect(keyboard.keys).toHaveLength(4)
      expect(keyboard.meta.name).toBe('Corne')

      // Check rotated thumb key
      const thumbKey = keyboard.keys.find((k) => k.labels[0] === '3,5')
      expect(thumbKey?.height).toBe(1.5)
      expect(thumbKey?.rotation_angle).toBe(30)
      expect(thumbKey?.rotation_x).toBe(5.4)
      expect(thumbKey?.rotation_y).toBe(9.3)
    })
  })
})
