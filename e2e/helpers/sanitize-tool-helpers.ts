import { Page, Locator, expect } from '@playwright/test'
import { WaitHelpers } from './wait-helpers'

export type SanitizeRuleId =
  | 'coordinate-offset'
  | 'rotation-angle'
  | 'whitespace-label'
  | 'blank-label-text-size'
  | 'blank-label-text-color'
  | 'stale-rotation-origin'
  | 'stale-stabilizer-rotation'
  | 'ineffective-step'
  | 'key-collisions'

/**
 * Helper class for interacting with the Sanitize Layout tool.
 *
 * @example
 * ```ts
 * const sanitize = new SanitizeToolHelper(page, waitHelpers)
 * await sanitize.openPanel()
 * await sanitize.expectCount('whitespace-label', 1)
 * await sanitize.uncheck('coordinate-offset')
 * await sanitize.apply()
 * ```
 */
export class SanitizeToolHelper {
  constructor(
    private page: Page,
    private waitHelpers: WaitHelpers,
  ) {}

  // ==================== Locators ====================

  /** The Extra Tools dropdown button. */
  getExtraToolsButton(): Locator {
    return this.page.locator('.extra-tools-group > button')
  }

  /** The "Sanitize Layout" entry in the Extra Tools dropdown. */
  getToolMenuItem(): Locator {
    return this.page
      .locator('.extra-tools-group .dropdown-menu .dropdown-item')
      .filter({ hasText: 'Sanitize Layout' })
  }

  getPanel(): Locator {
    return this.page.locator('.sanitize-tool-panel')
  }

  getRuleRow(ruleId: SanitizeRuleId): Locator {
    return this.page.locator(`[data-testid="sanitize-rule-${ruleId}"]`)
  }

  getCategoryCheckbox(ruleId: SanitizeRuleId): Locator {
    return this.page.locator(`[data-testid="sanitize-checkbox-${ruleId}"]`)
  }

  getCountBadge(ruleId: SanitizeRuleId): Locator {
    return this.page.locator(`[data-testid="sanitize-count-${ruleId}"]`)
  }

  getResultBanner(): Locator {
    return this.page.locator('[data-testid="sanitize-result"]')
  }

  getCleanBanner(): Locator {
    return this.page.locator('.sanitize-tool-panel .clean-banner')
  }

  getApplyButton(): Locator {
    return this.page.locator('[data-testid="sanitize-apply"]')
  }

  getRescanButton(): Locator {
    return this.page.locator('.sanitize-tool-panel button').filter({ hasText: 'Rescan' })
  }

  getCloseButton(): Locator {
    return this.page.locator('.sanitize-tool-panel button').filter({ hasText: 'Close' })
  }

  /** The group container for one rule kind. */
  getGroup(kind: 'redundancy' | 'normalization' | 'advisory'): Locator {
    return this.page.locator(`[data-testid="sanitize-group-${kind}"]`)
  }

  /** The banner naming warning-only rules that still need attention. */
  getWarningBanner(): Locator {
    return this.page.locator('[data-testid="sanitize-warnings"]')
  }

  /** The "Select" action on a warning row, which selects its keys on canvas. */
  getSelectButton(ruleId: SanitizeRuleId): Locator {
    return this.page.locator(`[data-testid="sanitize-select-${ruleId}"]`)
  }

  // ==================== Actions ====================

  /** Open the panel via the Extra Tools dropdown. */
  async openPanel(): Promise<void> {
    await this.getExtraToolsButton().click()
    await this.waitHelpers.waitForDoubleAnimationFrame()
    await this.getToolMenuItem().click()
    await expect(this.getPanel()).toBeVisible()
  }

  async close(): Promise<void> {
    await this.getCloseButton().click()
    await expect(this.getPanel()).toBeHidden()
  }

  async check(ruleId: SanitizeRuleId): Promise<void> {
    await this.getCategoryCheckbox(ruleId).check()
  }

  async uncheck(ruleId: SanitizeRuleId): Promise<void> {
    await this.getCategoryCheckbox(ruleId).uncheck()
  }

  /** Click Apply. The panel stays open and rescans. */
  async apply(): Promise<void> {
    await this.getApplyButton().click()
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  async rescan(): Promise<void> {
    await this.getRescanButton().click()
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  /** Read the current count for a category. */
  async getCount(ruleId: SanitizeRuleId): Promise<number> {
    const text = await this.getCountBadge(ruleId).textContent()
    return Number((text ?? '').trim())
  }

  // ==================== Assertions ====================

  async expectPanelVisible(): Promise<void> {
    await expect(this.getPanel()).toBeVisible()
  }

  async expectPanelHidden(): Promise<void> {
    await expect(this.getPanel()).toBeHidden()
  }

  async expectCount(ruleId: SanitizeRuleId, expected: number): Promise<void> {
    await expect(this.getCountBadge(ruleId)).toHaveText(String(expected))
  }

  async expectChecked(ruleId: SanitizeRuleId): Promise<void> {
    await expect(this.getCategoryCheckbox(ruleId)).toBeChecked()
  }

  async expectUnchecked(ruleId: SanitizeRuleId): Promise<void> {
    await expect(this.getCategoryCheckbox(ruleId)).not.toBeChecked()
  }

  async expectCheckboxDisabled(ruleId: SanitizeRuleId): Promise<void> {
    await expect(this.getCategoryCheckbox(ruleId)).toBeDisabled()
  }

  /**
   * Assert a rule has no checkbox at all. Warning-only rules must not render a
   * permanently disabled one — that reads as "already clean".
   */
  async expectNoCheckbox(ruleId: SanitizeRuleId): Promise<void> {
    await expect(this.getRuleRow(ruleId)).toBeVisible()
    await expect(this.getCategoryCheckbox(ruleId)).toHaveCount(0)
  }

  /** Click a warning row's Select action. */
  async select(ruleId: SanitizeRuleId): Promise<void> {
    await this.getSelectButton(ruleId).click()
    await this.waitHelpers.waitForDoubleAnimationFrame()
  }

  async expectApplyEnabled(): Promise<void> {
    await expect(this.getApplyButton()).toBeEnabled()
  }

  /**
   * Assert the panel body fits its content without scrolling.
   *
   * The panel is meant to be readable at a glance: every rule is one line, with
   * its description on hover. A scrollbar here means content was added back into
   * the layout that belongs in a tooltip.
   */
  async expectNoScroll(): Promise<void> {
    const body = this.page.locator('.sanitize-tool-panel .panel-body')
    await expect(body).toBeVisible()

    const overflow = await body.evaluate((el) => el.scrollHeight - el.clientHeight)
    expect(overflow, 'panel body should not scroll').toBeLessThanOrEqual(1)
  }

  async expectApplyDisabled(): Promise<void> {
    await expect(this.getApplyButton()).toBeDisabled()
  }
}
