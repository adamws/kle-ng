import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
// @ts-expect-error - ergogen is a JavaScript library without type definitions
import ergogen from 'ergogen'
import yaml from 'js-yaml'
import { ergogenPointsToKeyboard } from '../ergogen-converter'
import { getSerializedData } from '../serialization'

/**
 * Parametrized tests for ergogen.process() - validates that YAML configs
 * produce the expected points structure
 */

interface TestCase {
  name: string
  configFile: string
  expectedPointsFile: string
  expectedKLEFile: string
}

const testCases: TestCase[] = [
  {
    name: 'simple 2x2 grid',
    configFile: 'simple.yaml',
    expectedPointsFile: 'simple.yaml',
    expectedKLEFile: 'simple.json',
  },
  {
    name: 'rotated keys with splay and origin',
    configFile: 'rotated.yaml',
    expectedPointsFile: 'rotated.yaml',
    expectedKLEFile: 'rotated.json',
  },
  {
    name: 'mirrored split layout',
    configFile: 'mirrored.yaml',
    expectedPointsFile: 'mirrored.yaml',
    expectedKLEFile: 'mirrored.json',
  },
]

const FIXTURES_DIR = join(__dirname, 'fixtures', 'ergogen')

/**
 * Load and parse a YAML config file
 */
function loadConfig(filename: string): unknown {
  const yamlText = readFileSync(join(FIXTURES_DIR, 'configs', filename), 'utf-8')
  return yaml.load(yamlText)
}

/**
 * Load expected KLE layout from JSON file
 */
function loadExpectedKLE(filename: string): unknown[] {
  const jsonText = readFileSync(join(FIXTURES_DIR, 'expected-kle', filename), 'utf-8')
  return JSON.parse(jsonText)
}

/**
 * Load expected points YAML file
 * Note: Users should provide baselines in YAML format (copy-paste from ergogen.xyz)
 */
function loadExpectedPoints(filename: string): unknown {
  const yamlText = readFileSync(join(FIXTURES_DIR, 'expected-points', filename), 'utf-8')
  return yaml.load(yamlText)
}

describe('ergogen.process() - YAML to Points conversion', () => {
  describe.each(testCases)('$name', ({ configFile, expectedPointsFile, expectedKLEFile }) => {
    it('should generate the expected points and kle structures', async () => {
      // Load config
      const config = loadConfig(configFile)
      expect(config).toBeDefined()

      // Process with ergogen (debug: true is required to get points in results)
      const results = await ergogen.process(config, { debug: true })
      expect(results).toBeDefined()
      expect(results.points).toBeDefined()

      const expectedPoints = loadExpectedPoints(expectedPointsFile)
      expect(expectedPoints).toBeDefined()

      const plainPoints = JSON.parse(JSON.stringify(results.points))

      // Validate points structure matches expected
      expect(plainPoints).toEqual(expectedPoints)

      // Convert ergogen points to Keyboard object
      const keyboard = ergogenPointsToKeyboard(results.points)
      expect(keyboard).toBeDefined()
      expect(keyboard.keys.length).toBeGreaterThan(0)

      // Serialize to KLE format using unified serialization
      const kleLayout = getSerializedData(keyboard, 'kle')

      const expectedKLE = loadExpectedKLE(expectedKLEFile)
      expect(kleLayout).toEqual(expectedKLE)
    })
  })
})
