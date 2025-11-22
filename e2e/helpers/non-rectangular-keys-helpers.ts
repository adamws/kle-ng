import { expect, type Locator, type Page } from '@playwright/test'
import { WaitHelpers } from './wait-helpers'
import { CanvasTestHelper } from './canvas-test-helpers'

/**
 * Helper for non-rectangular key rendering tests
 *
 * Handles:
 * - Loading non-rectangular key layouts via JSON
 * - Canvas rendering and screenshots
 * - Key selection on canvas
 * - Properties panel verification
 */
export class NonRectangularKeysHelper {
  private canvasHelper: CanvasTestHelper

  constructor(
    private page: Page,
    private waitHelpers: WaitHelpers,
  ) {
    this.canvasHelper = new CanvasTestHelper(page)
  }

  // =============================================================================
  // Locators
  // =============================================================================

  getCanvas(): Locator {
    return this.canvasHelper.getCanvas()
  }

  getKeysCounter(): Locator {
    return this.page.locator('.keys-counter')
  }

  getPropertiesPanel(): Locator {
    return this.page.locator('.key-properties-panel')
  }

  // =============================================================================
  // Layout Loading
  // =============================================================================

  /**
   * Load a big-ass-enter key layout
   */
  async loadBigAssEnterLayout(): Promise<void> {
    const layout = JSON.stringify([
      [{ x: 0.75, a: 0, w: 1.5, h: 2, w2: 2.25, h2: 1, x2: -0.75, y2: 1 }, 'Enter'],
    ])
    await this.loadJsonLayout(layout)
  }

  /**
   * Load an ISO enter key layout
   */
  async loadISOEnterLayout(): Promise<void> {
    const layout = JSON.stringify([
      [{ x: 0.25, w: 1.25, h: 2, w2: 1.5, h2: 1, x2: -0.25 }, 'ISO Enter'],
    ])
    await this.loadJsonLayout(layout)
  }

  /**
   * Load a custom non-rectangular J-shaped key layout
   */
  async loadCustomJLayout(): Promise<void> {
    const layout = JSON.stringify([
      [{ x: 0, w: 2, h: 1, w2: 1, h2: 2, x2: 1, y2: 0.75 }, 'Custom J'],
    ])
    await this.loadJsonLayout(layout)
  }

  /**
   * Load a layout with multiple non-rectangular keys
   */
  async loadMixedNonRectangularLayout(): Promise<void> {
    const layout = JSON.stringify([
      [{ w: 1.5 }, 'Tab', { w: 1, h: 1 }, 'Q', 'W', 'E'],
      [{ w: 1.75 }, 'Caps', 'A', 'S', 'D'],
      [{ x: 0.25, w: 1.25, h: 2, w2: 1.5, h2: 1, x2: -0.25 }, 'ISO Enter'],
      [{ x: 2.75, w: 1.5, h: 2, w2: 2.25, h2: 1, x2: -0.75, y2: 1 }, 'Big Ass Enter'],
    ])
    await this.loadJsonLayout(layout)
  }

  /**
   * Load a colored big-ass-enter key layout
   */
  async loadColoredBigAssEnterLayout(): Promise<void> {
    const layout = JSON.stringify([
      [
        {
          x: 0.75,
          a: 0,
          w: 1.5,
          h: 2,
          w2: 2.25,
          h2: 1,
          x2: -0.75,
          y2: 1,
          c: '#ff6b35',
          t: '#ffffff',
        },
        'Enter',
      ],
    ])
    await this.loadJsonLayout(layout)
  }

  /**
   * Load a custom JSON layout by directly manipulating the JSON editor
   */
  async loadJsonLayout(jsonString: string): Promise<void> {
    const jsonTextarea = this.page.locator('textarea.form-control.font-monospace')
    await jsonTextarea.clear()
    await jsonTextarea.fill(jsonString)
    await this.page.click('button:has-text("Apply Changes")')
    await this.waitHelpers.waitForQuadAnimationFrame()
  }

  // =============================================================================
  // Canvas Operations
  // =============================================================================

  /**
   * Click on canvas at specific position
   */
  async clickCanvasAt(x: number, y: number): Promise<void> {
    await this.getCanvas().click({ position: { x, y }, force: true })
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /**
   * Click on the big-ass-enter key to select it
   * Uses known position for reliable selection
   */
  async selectBigAssEnterKey(): Promise<void> {
    await this.clickCanvasAt(140, 80)
  }

  /**
   * Clear the current layout by evaluating store clear
   */
  async clearLayout(): Promise<void> {
    await this.page.evaluate(() => {
      const store = (
        window as {
          __VUE_DEVTOOLS_GLOBAL_HOOK__?: { apps?: { store?: { clearKeys?: () => void } }[] }
        }
      ).__VUE_DEVTOOLS_GLOBAL_HOOK__?.apps?.[0]?.store
      if (store) {
        store.clearKeys()
      }
    })
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  // =============================================================================
  // Assertions
  // =============================================================================

  /**
   * Assert keys counter shows expected count
   */
  async expectKeysCount(count: number): Promise<void> {
    await expect(this.getKeysCounter()).toContainText(`Keys: ${count}`)
  }

  /**
   * Assert properties panel is visible
   */
  async expectPropertiesPanelVisible(): Promise<void> {
    await expect(this.getPropertiesPanel()).toBeVisible()
  }

  /**
   * Take screenshot of canvas and compare
   */
  async expectCanvasScreenshot(name: string): Promise<void> {
    await expect(this.getCanvas()).toHaveScreenshot(name)
  }
}
