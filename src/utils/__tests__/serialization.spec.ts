import { describe, it, expect } from 'vitest'
import { parseJsonString } from '../serialization'
import { Serial, Key, Keyboard } from '@adamws/kle-serial'

describe('Serialization Utils', () => {
  describe('parseJsonString', () => {
    it('should parse valid JSON', () => {
      const jsonString = '{"test": "value"}'
      const result = parseJsonString(jsonString)
      expect(result).toEqual({ test: 'value' })
    })

    it('should parse JSON5 format', () => {
      const json5String = `{
        test: 'value',  // comment
        number: 42,
      }`
      const result = parseJsonString(json5String)
      expect(result).toEqual({ test: 'value', number: 42 })
    })

    it('should throw error for invalid JSON', () => {
      const invalidJson = '{"test": invalid}'
      expect(() => parseJsonString(invalidJson)).toThrow('Invalid JSON format')
    })

    it('should fallback to JSON5 when standard JSON fails', () => {
      const json5Only = "{ test: 'value' }"
      const result = parseJsonString(json5Only)
      expect(result).toEqual({ test: 'value' })
    })

    it('should handle KLE format without outer brackets (simple keys)', () => {
      const kleWithoutBrackets = '["A"], ["B"], ["C"]'
      const result = parseJsonString(kleWithoutBrackets)
      expect(result).toEqual([['A'], ['B'], ['C']])
    })

    it('should handle KLE format without outer brackets (with properties)', () => {
      const kleWithoutBrackets = '[{"w":2},"Backspace"], ["Tab","Q","W"]'
      const result = parseJsonString(kleWithoutBrackets)
      expect(result).toEqual([
        [{ w: 2 }, 'Backspace'],
        ['Tab', 'Q', 'W'],
      ])
    })

    it('should handle original KLE export format', () => {
      // This is the exact format that original keyboard-layout-editor outputs
      const originalKleFormat = `[{a:7},"","","","","","","","","","","","","",{w:2},""],
[{w:1.5},"","","","","","","","","","","","","",{w:1.5},""],
[{w:1.75},"","","","","","","","","","","","",{w:2.25},""],
[{w:2.25},"","","","","","","","","","",{w:2.75},""],
[{w:1.25},"",{w:1.25},"",{w:6.25},"",{w:1.25},"",{w:1.25},"",{w:1.25},"",{w:1.25},""]`

      const result = parseJsonString(originalKleFormat)
      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(5) // 5 rows
    })

    it('should not add brackets to already valid JSON arrays', () => {
      const validArray = '[["A"], ["B"]]'
      const result = parseJsonString(validArray)
      expect(result).toEqual([['A'], ['B']])
    })

    it('should not add brackets to valid JSON objects', () => {
      const validObject = '{"test": "value"}'
      const result = parseJsonString(validObject)
      expect(result).toEqual({ test: 'value' })
    })

    it('should handle mixed KLE format without brackets', () => {
      const kleFormat = '"Esc", {x:1}, "F1", "F2", "F3"'
      const result = parseJsonString(kleFormat)
      expect(result).toEqual(['Esc', { x: 1 }, 'F1', 'F2', 'F3'])
    })

    it('should still throw error for truly invalid input', () => {
      const invalidInput = 'this is not json at all'
      expect(() => parseJsonString(invalidInput)).toThrow('Invalid JSON format')
    })
  })

  describe('kle-serial integration', () => {
    it('should create Key instances', () => {
      const key = new Key()
      expect(key.x).toBe(0)
      expect(key.y).toBe(0)
      expect(key.width).toBe(1)
      expect(key.height).toBe(1)
      expect(key.color).toBe('#cccccc')
    })

    it('should serialize and deserialize layouts', () => {
      const keyboard = new Keyboard()
      keyboard.keys.push(new Key())
      keyboard.keys[0].labels = ['A']

      const serialized = Serial.serialize(keyboard)
      const deserialized = Serial.deserialize(serialized)

      expect(deserialized.keys).toHaveLength(1)
      expect(deserialized.keys[0].labels[0]).toBe('A')
    })

    it('should handle complex layouts', () => {
      const sampleLayout = [
        [{ w: 2 }, 'Backspace'],
        ['Tab', 'Q', 'W', 'E'],
      ]

      const keyboard = Serial.deserialize(sampleLayout)
      expect(keyboard.keys).toHaveLength(5) // Tab + Q + W + E + Backspace
      expect(keyboard.keys[0].width).toBe(2) // Backspace is the first key
      expect(keyboard.keys[0].labels[0]).toBe('Backspace')
    })
  })
})
