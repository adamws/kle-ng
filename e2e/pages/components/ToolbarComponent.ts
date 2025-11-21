import { Locator, Page, expect } from '@playwright/test'
import { SELECTORS } from '../../constants/selectors'

/**
 * ToolbarComponent - Canvas toolbar interactions
 *
 * Encapsulates all toolbar button interactions and state checks.
 * Used as part of KeyboardEditorPage.
 *
 * @example
 * const toolbar = new ToolbarComponent(page)
 * await toolbar.addKey()
 * await toolbar.expectUndoEnabled()
 */
export class ToolbarComponent {
  private readonly addKeyButton: Locator
  private readonly deleteKeysButton: Locator
  private readonly undoButton: Locator
  private readonly redoButton: Locator
  private readonly rotationToolButton: Locator
  private readonly mirrorVerticalButton: Locator
  private readonly moveExactlyButton: Locator

  constructor(private readonly page: Page) {
    this.addKeyButton = page.locator(SELECTORS.TOOLBAR.ADD_KEY)
    this.deleteKeysButton = page.locator(SELECTORS.TOOLBAR.DELETE_KEYS)
    this.undoButton = page.locator(SELECTORS.TOOLBAR.UNDO)
    this.redoButton = page.locator(SELECTORS.TOOLBAR.REDO)
    this.rotationToolButton = page.locator(SELECTORS.TOOLBAR.ROTATE_SELECTION)
    this.mirrorVerticalButton = page.locator(SELECTORS.TOOLBAR.MIRROR_VERTICAL)
    this.moveExactlyButton = page.locator(SELECTORS.TOOLBAR.MOVE_EXACTLY)
  }

  /**
   * Click the "Add Standard Key" button
   */
  async addKey() {
    await this.addKeyButton.click()
  }

  /**
   * Click the "Delete Keys" button
   */
  async deleteKeys() {
    await this.deleteKeysButton.click()
  }

  /**
   * Click the "Undo" button
   */
  async undo() {
    await this.undoButton.click()
  }

  /**
   * Click the "Redo" button
   */
  async redo() {
    await this.redoButton.click()
  }

  /**
   * Open the rotation tool
   */
  async openRotationTool() {
    await this.rotationToolButton.click()
  }

  /**
   * Open the mirror tool (vertical by default)
   */
  async openMirrorTool() {
    await this.mirrorVerticalButton.click()
  }

  /**
   * Open the move exactly tool
   */
  async openMoveExactly() {
    await this.moveExactlyButton.click()
  }

  /**
   * Check if the undo button is enabled
   */
  async isUndoEnabled(): Promise<boolean> {
    return await this.undoButton.isEnabled()
  }

  /**
   * Check if the redo button is enabled
   */
  async isRedoEnabled(): Promise<boolean> {
    return await this.redoButton.isEnabled()
  }

  /**
   * Assert that the undo button is enabled
   */
  async expectUndoEnabled() {
    await expect(this.undoButton).toBeEnabled()
  }

  /**
   * Assert that the undo button is disabled
   */
  async expectUndoDisabled() {
    await expect(this.undoButton).toBeDisabled()
  }

  /**
   * Assert that the redo button is enabled
   */
  async expectRedoEnabled() {
    await expect(this.redoButton).toBeEnabled()
  }

  /**
   * Assert that the redo button is disabled
   */
  async expectRedoDisabled() {
    await expect(this.redoButton).toBeDisabled()
  }

  /**
   * Assert that the rotation tool button is enabled
   */
  async expectRotationToolEnabled() {
    await expect(this.rotationToolButton).toBeEnabled()
  }

  /**
   * Assert that the rotation tool button is disabled
   */
  async expectRotationToolDisabled() {
    await expect(this.rotationToolButton).toBeDisabled()
  }
}
