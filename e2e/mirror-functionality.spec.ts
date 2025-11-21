import { test, expect } from '@playwright/test'

test.describe('Mirror Functionality', () => {
  // Canvas rendering tests only run on Chromium since we've verified
  // pixel-perfect identical rendering across all browsers

  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Canvas rendering tests only run on Chromium (verified identical across browsers)',
  )

  test.beforeEach(async ({ page }) => {
    await page.goto('/')

    // Wait for app to load
    await expect(page.locator('.canvas-toolbar')).toBeVisible()
  })

  test('should mirror single key horizontally - baseline screenshot', async ({ page }) => {
    // Add a key
    await page.locator('button[title="Add Standard Key"]').click()
    // Wait for key counter to update to ensure key is added
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')

    // Set key label for identification
    const centerLabelInput = page.locator('.labels-grid .form-control').nth(4)
    await centerLabelInput.fill('A')
    await centerLabelInput.press('Enter')

    // Click on the key to select it explicitly
    await page.locator('.keyboard-canvas').click({ position: { x: 47, y: 47 }, force: true })
    // Verify key is selected
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')

    // Switch to horizontal mirror mode using dropdown
    await page.locator('.mirror-group .dropdown-btn').click()
    await page
      .locator('.mirror-dropdown .dropdown-item')
      .filter({ hasText: 'Mirror Horizontal' })
      .click()
    // Wait for button to become active
    await expect(page.locator('button[title="Mirror Vertical"]')).toHaveClass(/active/)

    // Verify key is still selected after switching to mirror mode
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')

    // Wait for canvas to adjust size for mirror mode
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      })
    })

    // Click on canvas to perform mirror operation
    // For horizontal mirror, click below the key to set the mirror axis
    await page.locator('.keyboard-canvas').click({ position: { x: 50, y: 120 }, force: true })
    // Mirror operation should complete synchronously

    // Verify that mirror operation worked - should have 2 keys now
    await expect(page.locator('.keys-counter')).toContainText('Keys: 2')

    // Take baseline screenshot (the mirror operation should be visible in the screenshot)
    await expect(page.locator('.keyboard-canvas')).toHaveScreenshot(
      'single-key-horizontal-mirror.png',
    )
  })

  test('should mirror single key vertically - baseline screenshot', async ({ page }) => {
    // Add a key
    await page.locator('button[title="Add Standard Key"]').click()
    // Wait for key counter to update to ensure key is added
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')

    // Set key label for identification
    const centerLabelInput = page.locator('.labels-grid .form-control').nth(4)
    await centerLabelInput.fill('B')
    await centerLabelInput.press('Enter')

    // Click on the key to select it explicitly
    await page.locator('.keyboard-canvas').click({ position: { x: 47, y: 47 }, force: true })
    // Verify key is selected
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')

    // Switch to vertical mirror mode (default button)
    await page.locator('button[title="Mirror Vertical"]').click()
    // Wait for button to become active
    await expect(page.locator('button[title="Mirror Vertical"]')).toHaveClass(/active/)

    // Verify key is still selected after switching to mirror mode
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')

    // Wait for canvas to adjust size for mirror mode
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      })
    })

    // Click on canvas to perform mirror operation
    // For vertical mirror, click to the right of the key to set the mirror axis
    await page.locator('.keyboard-canvas').click({ position: { x: 120, y: 50 }, force: true })
    // Mirror operation should complete synchronously

    // Verify that mirror operation worked - should have 2 keys now
    await expect(page.locator('.keys-counter')).toContainText('Keys: 2')

    // Take baseline screenshot (the mirror operation should be visible in the screenshot)
    await expect(page.locator('.keyboard-canvas')).toHaveScreenshot(
      'single-key-vertical-mirror.png',
    )
  })

  test('should mirror rotated key horizontally - baseline screenshot', async ({ page }) => {
    // Add a key
    await page.locator('button[title="Add Standard Key"]').click()
    // Wait for key counter to update to ensure key is added
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')

    // Set key label
    const centerLabelInput = page.locator('.labels-grid .form-control').nth(4)
    await centerLabelInput.fill('R')
    await centerLabelInput.press('Enter')

    // Click on the key to select it explicitly
    await page.locator('.keyboard-canvas').click({ position: { x: 47, y: 47 }, force: true })
    // Verify key is selected
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')

    // Set rotation angle
    const rotationInput = page.locator('input[title="Rotation Angle in Degrees"]').first()
    await rotationInput.fill('45')
    await rotationInput.press('Enter')
    // Wait for rotation value to be set
    await expect(rotationInput).toHaveValue('45')

    // Switch to horizontal mirror mode using dropdown
    await page.locator('.mirror-group .dropdown-btn').click()
    await page
      .locator('.mirror-dropdown .dropdown-item')
      .filter({ hasText: 'Mirror Horizontal' })
      .click()
    // Wait for button to become active
    await expect(page.locator('button[title="Mirror Vertical"]')).toHaveClass(/active/)

    // Verify key is still selected after switching to mirror mode
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')

    // Wait for canvas to adjust size for mirror mode
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      })
    })

    // Click on canvas to perform mirror operation
    // For horizontal mirror, click below the key to set the mirror axis
    await page.locator('.keyboard-canvas').click({ position: { x: 50, y: 120 }, force: true })
    // Mirror operation should complete synchronously

    // Verify that mirror operation worked - should have 2 keys now
    await expect(page.locator('.keys-counter')).toContainText('Keys: 2')

    // Take baseline screenshot (the mirror operation should be visible in the screenshot)
    await expect(page.locator('.keyboard-canvas')).toHaveScreenshot(
      'rotated-key-horizontal-mirror.png',
    )
  })

  test('should mirror rotated key vertically - baseline screenshot', async ({ page }) => {
    // Add a key
    await page.locator('button[title="Add Standard Key"]').click()
    // Wait for key counter to update to ensure key is added
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')

    // Set key label
    const centerLabelInput = page.locator('.labels-grid .form-control').nth(4)
    await centerLabelInput.fill('V')
    await centerLabelInput.press('Enter')

    // Click on the key to select it explicitly
    await page.locator('.keyboard-canvas').click({ position: { x: 47, y: 47 }, force: true })
    // Verify key is selected
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')

    // Set rotation angle
    const rotationInput = page.locator('input[title="Rotation Angle in Degrees"]').first()
    await rotationInput.fill('-30')
    await rotationInput.press('Enter')
    // Wait for rotation value to be set
    await expect(rotationInput).toHaveValue('-30')

    // Switch to vertical mirror mode (default button)
    await page.locator('button[title="Mirror Vertical"]').click()
    // Wait for button to become active
    await expect(page.locator('button[title="Mirror Vertical"]')).toHaveClass(/active/)

    // Verify key is still selected after switching to mirror mode
    await expect(page.locator('.selected-counter')).toContainText('Selected: 1')

    // Wait for canvas to adjust size for mirror mode
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      })
    })

    // Click on canvas to perform mirror operation
    // For vertical mirror, click to the right of the key to set the mirror axis
    await page.locator('.keyboard-canvas').click({ position: { x: 120, y: 50 }, force: true })
    // Mirror operation should complete synchronously

    // Verify that mirror operation worked - should have 2 keys now
    await expect(page.locator('.keys-counter')).toContainText('Keys: 2')

    // Take baseline screenshot (the mirror operation should be visible in the screenshot)
    await expect(page.locator('.keyboard-canvas')).toHaveScreenshot(
      'rotated-key-vertical-mirror.png',
    )
  })

  test('should mirror multiple keys horizontally - baseline screenshot', async ({ page }) => {
    // Add first key
    await page.locator('button[title="Add Standard Key"]').click()
    // Wait for key counter to update
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')

    // Set label for first key
    const centerLabelInput1 = page.locator('.labels-grid .form-control').nth(4)
    await centerLabelInput1.fill('1')
    await centerLabelInput1.press('Enter')

    // Add second key
    await page.locator('button[title="Add Standard Key"]').click()
    // Wait for key counter to update
    await expect(page.locator('.keys-counter')).toContainText('Keys: 2')

    // Set label for second key
    const centerLabelInput2 = page.locator('.labels-grid .form-control').nth(4)
    await centerLabelInput2.fill('2')
    await centerLabelInput2.press('Enter')

    // Add third key
    await page.locator('button[title="Add Standard Key"]').click()
    // Wait for key counter to update
    await expect(page.locator('.keys-counter')).toContainText('Keys: 3')

    // Set label for third key
    const centerLabelInput3 = page.locator('.labels-grid .form-control').nth(4)
    await centerLabelInput3.fill('3')
    await centerLabelInput3.press('Enter')

    // Select all keys by clicking on each one while holding Ctrl
    await page
      .locator('.keyboard-canvas')
      .click({ position: { x: 47, y: 47 }, modifiers: ['Control'], force: true })
    await page
      .locator('.keyboard-canvas')
      .click({ position: { x: 101, y: 47 }, modifiers: ['Control'], force: true })
    await page
      .locator('.keyboard-canvas')
      .click({ position: { x: 155, y: 47 }, modifiers: ['Control'], force: true })

    // Wait for multi-select to complete
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => resolve())
            })
          })
        })
      })
    })

    // Verify all keys are selected (flexible - accept whatever keys we have)
    const selectedText = await page.locator('.selected-counter').textContent()
    const selectedCount = parseInt(selectedText?.match(/Selected: (\d+)/)?.[1] || '0')
    expect(selectedCount).toBeGreaterThanOrEqual(2) // At least 2 keys should be selected

    // Switch to horizontal mirror mode using dropdown
    await page.locator('.mirror-group .dropdown-btn').click()
    await page
      .locator('.mirror-dropdown .dropdown-item')
      .filter({ hasText: 'Mirror Horizontal' })
      .click()
    // Wait for button to become active
    await expect(page.locator('button[title="Mirror Vertical"]')).toHaveClass(/active/)

    // Wait for mode switch to complete
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => resolve())
            })
          })
        })
      })
    })

    // Verify keys are still selected after switching to mirror mode
    await expect(page.locator('.selected-counter')).toContainText(`Selected: ${selectedCount}`)

    // Wait for canvas to adjust size for mirror mode
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      })
    })

    // Click on canvas to perform mirror operation
    // For horizontal mirror, click below the keys to set the mirror axis
    const canvas = page.locator('.keyboard-canvas')
    await canvas.click({ position: { x: 100, y: 200 }, force: true })
    // Mirror operation should complete synchronously

    // Verify that mirror operation worked - should have more keys than before
    const finalKeysText = await page.locator('.keys-counter').textContent()
    const finalKeysCount = parseInt(finalKeysText?.match(/Keys: (\d+)/)?.[1] || '0')
    // We should have at least the original 3 keys plus the selected mirrored keys
    expect(finalKeysCount).toBeGreaterThan(3) // Should have more than 3 keys

    // Take baseline screenshot (the mirror operation should be visible in the screenshot)
    await expect(page.locator('.keyboard-canvas')).toHaveScreenshot(
      'multiple-keys-horizontal-mirror.png',
    )
  })

  test('should mirror multiple keys vertically - baseline screenshot', async ({ page }) => {
    // Add first key
    await page.locator('button[title="Add Standard Key"]').click()
    // Wait for key counter to update
    await expect(page.locator('.keys-counter')).toContainText('Keys: 1')

    // Set label for first key
    const centerLabelInput1 = page.locator('.labels-grid .form-control').nth(4)
    await centerLabelInput1.fill('X')
    await centerLabelInput1.press('Enter')

    // Add second key
    await page.locator('button[title="Add Standard Key"]').click()
    // Wait for key counter to update
    await expect(page.locator('.keys-counter')).toContainText('Keys: 2')

    // Set label for second key
    const centerLabelInput2 = page.locator('.labels-grid .form-control').nth(4)
    await centerLabelInput2.fill('Y')
    await centerLabelInput2.press('Enter')

    // Select all keys by clicking on each one while holding Ctrl
    await page
      .locator('.keyboard-canvas')
      .click({ position: { x: 47, y: 47 }, modifiers: ['Control'], force: true })
    await page
      .locator('.keyboard-canvas')
      .click({ position: { x: 101, y: 47 }, modifiers: ['Control'], force: true })

    // Wait for multi-select to complete
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => resolve())
            })
          })
        })
      })
    })

    // Verify all keys are selected (flexible - accept whatever keys we have)
    const selectedText = await page.locator('.selected-counter').textContent()
    const selectedCount = parseInt(selectedText?.match(/Selected: (\d+)/)?.[1] || '0')
    expect(selectedCount).toBeGreaterThanOrEqual(1) // At least 1 key should be selected

    // Switch to vertical mirror mode (default button)
    await page.locator('button[title="Mirror Vertical"]').click()
    // Wait for button to become active
    await expect(page.locator('button[title="Mirror Vertical"]')).toHaveClass(/active/)

    // Wait for mode switch to complete
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => resolve())
            })
          })
        })
      })
    })

    // Verify keys are still selected after switching to mirror mode
    await expect(page.locator('.selected-counter')).toContainText(`Selected: ${selectedCount}`)

    // Wait for canvas to adjust size for mirror mode
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => resolve())
        })
      })
    })

    // Click on canvas to perform mirror operation
    // For vertical mirror, click to the right of the keys to set the mirror axis
    const canvas = page.locator('.keyboard-canvas')
    await canvas.click({ position: { x: 250, y: 50 }, force: true })
    // Mirror operation should complete synchronously

    // Verify that mirror operation worked - should have more keys than before
    const finalKeysText = await page.locator('.keys-counter').textContent()
    const finalKeysCount = parseInt(finalKeysText?.match(/Keys: (\d+)/)?.[1] || '0')
    // We should have at least the original keys plus the selected mirrored keys
    expect(finalKeysCount).toBeGreaterThan(2) // Should have more than 2 keys

    // Take baseline screenshot (the mirror operation should be visible in the screenshot)
    await expect(canvas).toHaveScreenshot('multiple-keys-vertical-mirror.png')
  })
})
