import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import yaml from 'js-yaml'
import { ergogenGetPoints, ergogenPointsToKeyboard } from '../ergogen-converter'
import { getSerializedData } from '../serialization'
import { getKeyCenter } from '../keyboard-geometry'

interface TestCase {
  name: string
  configName: string
}

const simpleTestCases: TestCase[] = [
  {
    name: 'simple 2x2 grid',
    configName: 'simple',
  },
  {
    name: 'rotated keys with splay and origin',
    configName: 'rotated',
  },
  {
    name: 'mirrored split layout',
    configName: 'mirrored',
  },
  {
    name: 'simple 2x2 grid with 18x17mm spacing',
    configName: 'choc-spacing',
  },
]

const ergogenExamples: TestCase[] = [
  {
    name: 'absolem',
    configName: 'absolem',
  },
  {
    name: 'adux',
    configName: 'adux',
  },
  {
    name: 'alpha',
    configName: 'alpha',
  },
  {
    name: 'atreus',
    configName: 'atreus',
  },
  {
    name: 'corney-island',
    configName: 'corney-island',
  },
  {
    name: 'plank',
    configName: 'plank',
  },
  {
    name: 'reviung41',
    configName: 'reviung41',
  },
  {
    name: 'sweeplike',
    configName: 'sweeplike',
  },
  {
    name: 'tiny20',
    configName: 'tiny20',
  },
  {
    name: 'wubbo',
    configName: 'wubbo',
  },
]

const FIXTURES_DIR = join(__dirname, 'fixtures', 'ergogen')

/**
 * Load and parse a YAML config file
 */
function loadConfig(name: string): unknown {
  const yamlText = readFileSync(join(FIXTURES_DIR, 'configs', name + '.yaml'), 'utf-8')
  return yaml.load(yamlText)
}

/**
 * Load expected KLE layout from JSON file
 */
function loadExpectedKLE(name: string): unknown[] {
  const jsonText = readFileSync(join(FIXTURES_DIR, 'expected-kle', name + '.json'), 'utf-8')
  return JSON.parse(jsonText)
}

/**
 * Load expected points YAML file
 * Note: Users should provide baselines in YAML format (copy-paste from ergogen.xyz)
 */
function loadExpectedPoints(name: string): unknown {
  const yamlText = readFileSync(join(FIXTURES_DIR, 'expected-points', name + '.yaml'), 'utf-8')
  return yaml.load(yamlText)
}

/**
 * Extract positions from ergogen points
 */
function getPositionsFromPoints(
  points: Record<string, { x: number; y: number }>,
): Array<[number, number]> {
  return Object.values(points).map((point) => [point.x, point.y] as [number, number])
}

/**
 * Sort positions by y then x (top to bottom, left to right)
 */
function sortPositions(positions: Array<[number, number]>): Array<[number, number]> {
  return [...positions].sort((a, b) => {
    const yDiff = a[1] - b[1]
    if (Math.abs(yDiff) > 1e-10) {
      return yDiff
    }
    return a[0] - b[0]
  })
}

/**
 * Normalize positions so first position is (0,0)
 */
function normalizePositions(positions: Array<[number, number]>): Array<[number, number]> {
  if (positions.length === 0) return positions

  const [firstX, firstY] = positions[0]!
  return positions.map(([x, y]) => [x - firstX, y - firstY])
}

describe('ergogen.process() - YAML to Points conversion', () => {
  describe.each(simpleTestCases)('$name', ({ configName }) => {
    it('should generate the expected points and kle structures', async () => {
      // Load config
      const config = loadConfig(configName)
      expect(config).toBeDefined()

      const points = await ergogenGetPoints(config)
      expect(points).toBeDefined()

      const expectedPoints = loadExpectedPoints(configName)
      expect(expectedPoints).toBeDefined()

      const plainPoints = JSON.parse(JSON.stringify(points))

      // Validate points structure matches expected
      expect(plainPoints).toEqual(expectedPoints)

      // Convert ergogen points to Keyboard object
      const keyboard = ergogenPointsToKeyboard(points)
      expect(keyboard).toBeDefined()
      expect(keyboard.keys.length).toBeGreaterThan(0)

      // Serialize to KLE format using unified serialization
      const kleLayout = getSerializedData(keyboard, 'kle')

      const expectedKLE = loadExpectedKLE(configName)
      expect(kleLayout).toEqual(expectedKLE)
    })
  })

  describe.each(ergogenExamples)('$name', ({ configName }) => {
    it('should result in same key placement', async () => {
      const config = loadConfig(configName)
      expect(config).toBeDefined()

      const points = await ergogenGetPoints(config)
      expect(points).toBeDefined()

      const keyboard = ergogenPointsToKeyboard(points)
      expect(keyboard).toBeDefined()
      expect(keyboard.keys.length).toBeGreaterThan(0)

      // Extract positions from ergogen points (in mm)
      const ergogenPositions = getPositionsFromPoints(points)
      expect(ergogenPositions.length).toBe(keyboard.keys.length)

      // Extract key centers from keyboard (in KLE units) using getKeyCenter
      const keyboardCenters = keyboard.keys.map((key) => getKeyCenter(key))
      expect(keyboardCenters.length).toBe(keyboard.keys.length)

      // Convert keyboard centers from KLE units to mm using spacing metadata
      // IMPORTANT: KLE uses Y-down coordinate system, ergogen uses Y-up
      // We need to flip the Y-axis when comparing positions
      const spacingUnitX = keyboard.meta?.spacing_x || 19.05
      const spacingUnitY = keyboard.meta?.spacing_y || 19.05
      const keyboardCentersMm: [number, number][] = keyboardCenters.map(({ x, y }) => [
        x * spacingUnitX,
        -y * spacingUnitY,
      ])

      // Sort positions by y then x (top to bottom, left to right)
      const sortedErgogenPositions = sortPositions(ergogenPositions)
      const sortedKeyboardCentersMm = sortPositions(keyboardCentersMm)

      // Normalize so first position is (0,0)
      const normalizedErgogenPositions = normalizePositions(sortedErgogenPositions)
      const normalizedKeyboardCentersMm = normalizePositions(sortedKeyboardCentersMm)

      // Assert exact equality with 6 decimal places precision
      for (let i = 0; i < normalizedErgogenPositions.length; i++) {
        const [ergoX, ergoY] = normalizedErgogenPositions[i]!
        const [keyX, keyY] = normalizedKeyboardCentersMm[i]!

        // Compare with 6 decimal places precision (keyboard supported accuracy)
        expect(ergoX).toBeCloseTo(keyX, 6)
        expect(ergoY).toBeCloseTo(keyY, 6)
      }
    })
  })
})
