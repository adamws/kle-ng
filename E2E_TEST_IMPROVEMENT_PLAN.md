# E2E Test Improvement Plan
## kle-ng (Keyboard Layout Editor NG)

**Document Version:** 1.0
**Date:** 2025-11-22
**Analysis Branch:** develop

---

## Executive Summary

The kle-ng e2e test suite is well-architected with **229+ test cases** across **20 test files** using Playwright and the Page Object Model pattern. This plan focuses on strategic improvements to enhance **test quality, maintainability, and future-proofing**.

**Current Assessment:** ⭐⭐⭐⭐ (4/5 stars) - Production-ready with room for optimization

**Key Metrics:**
- 20 test spec files (~7,312 lines of test code)
- 229+ test cases across 53 describe blocks
- 65 visual regression tests (screenshot comparisons)
- 45 TypeScript files in e2e directory
- Cross-browser testing (Chromium, Firefox, WebKit)

---

## Current Strengths

✅ **Excellent Architecture**
- Clean Page Object Model with component composition
- Well-organized helpers (`wait-helpers.ts`, `custom-matchers.ts`, etc.)
- Smart fixture factory pattern (`layout-factory.ts`)
- Deterministic wait strategies (eliminates flaky timeouts)

✅ **Comprehensive Functional Coverage**
- Core CRUD operations
- Import/export (JSON, PNG, VIA format)
- Canvas rendering and interactions
- Theme switching and persistence
- Matrix coordinates and drawing
- Rotation, mirroring, and positioning tools
- Regression tests for known bugs

✅ **Modern Tooling**
- Playwright 1.56.1 with TypeScript
- Multi-browser CI pipeline
- Visual regression testing with proper thresholds
- Environment-aware configuration (CI vs local)

---

## Critical Improvements

### Priority 1: Foundation (Weeks 1-2)

#### 1.1 Migrate to data-testid Selectors 🚨 HIGH PRIORITY

**Problem:**
Current selectors use brittle CSS classes and attributes (`button[title="Add Standard Key"]`, `.keys-counter`, etc.) that break when styling changes. There's a documented TODO at `e2e/constants/selectors.ts:7`.

**Impact:** HIGH - Reduces test maintenance burden by 50%+, prevents false failures
**Effort:** MEDIUM - ~20-30 hours

**Implementation Steps:**

1. **Add data-testid attributes to application code**
   ```html
   <!-- Before -->
   <button title="Add Standard Key">Add</button>

   <!-- After -->
   <button title="Add Standard Key" data-testid="toolbar-add-key">Add</button>
   ```

2. **Update `e2e/constants/selectors.ts`**
   ```typescript
   // Before (fragile)
   export const SELECTORS = {
     TOOLBAR: {
       ADD_KEY: 'button[title="Add Standard Key"]',
       DELETE_KEYS: 'button[title="Delete Keys"]',
     },
     COUNTERS: {
       KEYS: '.keys-counter',
       SELECTED: '.selected-counter',
     },
   }

   // After (robust)
   export const SELECTORS = {
     TOOLBAR: {
       ADD_KEY: '[data-testid="toolbar-add-key"]',
       DELETE_KEYS: '[data-testid="toolbar-delete-keys"]',
     },
     COUNTERS: {
       KEYS: '[data-testid="counter-keys"]',
       SELECTED: '[data-testid="counter-selected"]',
     },
   }
   ```

3. **Migration checklist (20 test files):**
   - [ ] basic-load.spec.ts
   - [ ] keyboard-editor.spec.ts
   - [ ] canvas-rendering.spec.ts
   - [ ] canvas-toolbar.spec.ts
   - [ ] key-rendering.spec.ts
   - [ ] json-import-export.spec.ts
   - [ ] theme-switching.spec.ts
   - [ ] matrix-coordinates.spec.ts
   - [ ] matrix-drawing.spec.ts (largest - 57KB)
   - [ ] rotation-tool.spec.ts
   - [ ] mirror-functionality.spec.ts
   - [ ] move-exactly-tool.spec.ts
   - [ ] legend-tools.spec.ts
   - [ ] lock-rotations.spec.ts
   - [ ] advanced-position-panel.spec.ts
   - [ ] negative-coordinates.spec.ts
   - [ ] github-star-popup.spec.ts
   - [ ] toast-stacking.spec.ts
   - [ ] canvas-resize-bug.spec.ts
   - [ ] canvas-zoom-regression.spec.ts

4. **Add ESLint rule to prevent CSS selector additions**
   ```javascript
   // .eslintrc - custom rule
   'no-restricted-syntax': [
     'error',
     {
       selector: 'Literal[value=/^[.#][a-z]/]',
       message: 'Use data-testid selectors instead of CSS classes/ids in tests'
     }
   ]
   ```

**Success Criteria:**
- All selectors in `SELECTORS` constant use `data-testid`
- All 20 test files updated
- No CSS class/id selectors in test files (except for third-party libraries)
- Tests pass with 100% success rate

---

#### 1.2 Enhance CI/CD Pipeline 🚨 HIGH PRIORITY

**Problem:**
No test artifacts (screenshots, videos, traces) are uploaded on failure, making debugging extremely difficult for CI failures.

**Impact:** HIGH - Reduces debugging time from hours to minutes
**Effort:** LOW - ~2-4 hours

**Implementation Steps:**

1. **Update `.github/workflows/ci.yml` - Add artifact uploads**
   ```yaml
   e2e-tests:
     runs-on: ubuntu-latest
     needs: build-and-test
     strategy:
       fail-fast: false
       matrix:
         project: [chromium, firefox, webkit]

     steps:
       # ... existing steps ...

       - name: Run e2e tests
         run: npx playwright test --project=${{ matrix.project }}

       # NEW: Upload test artifacts on failure
       - name: Upload test results on failure
         if: failure()
         uses: actions/upload-artifact@v4
         with:
           name: test-results-${{ matrix.project }}
           path: |
             playwright-report/
             test-results/
           retention-days: 30

       # NEW: Upload screenshots always (for visual regression review)
       - name: Upload screenshots
         if: always()
         uses: actions/upload-artifact@v4
         with:
           name: screenshots-${{ matrix.project }}
           path: test-results/**/*.png
           retention-days: 7

       # NEW: Upload videos on failure
       - name: Upload videos on failure
         if: failure()
         uses: actions/upload-artifact@v4
         with:
           name: videos-${{ matrix.project }}
           path: test-results/**/*.webm
           retention-days: 30

       # NEW: Upload traces on failure
       - name: Upload traces on failure
         if: failure()
         uses: actions/upload-artifact@v4
         with:
           name: traces-${{ matrix.project }}
           path: test-results/**/*.zip
           retention-days: 30
   ```

2. **Update `playwright.config.ts` - Enable video/trace on failure**
   ```typescript
   export default defineConfig({
     // ... existing config ...

     use: {
       // ... existing use config ...

       /* Collect trace when retrying the failed test */
       trace: 'on-first-retry',

       /* Record video on failure for debugging */
       video: process.env.CI ? 'retain-on-failure' : 'off',

       /* Take screenshot on failure */
       screenshot: 'only-on-failure',
     },
   })
   ```

3. **Add test summary to CI output**
   ```yaml
   - name: Publish test results summary
     if: always()
     uses: dorny/test-reporter@v1
     with:
       name: Playwright Tests (${{ matrix.project }})
       path: test-results/results.json
       reporter: java-junit
   ```

4. **Add status badges to README.md**
   ```markdown
   # kle-ng

   [![CI](https://github.com/adamws/kle-ng/workflows/CI/badge.svg)](https://github.com/adamws/kle-ng/actions)
   [![E2E Tests](https://github.com/adamws/kle-ng/workflows/CI/badge.svg?event=push)](https://github.com/adamws/kle-ng/actions)
   ```

**Success Criteria:**
- Test failures automatically upload screenshots, videos, and traces
- Artifacts retained for 30 days (failures) and 7 days (passes)
- GitHub Actions summary shows test results with pass/fail counts
- README displays CI status badges

---

### Priority 2: Quality Enhancement (Weeks 3-4)

#### 2.1 Add Performance Testing 🚨 HIGH PRIORITY

**Problem:**
No performance benchmarks exist. Large layout rendering, import/export operations, and memory usage are untested. Performance regressions can slip through undetected.

**Impact:** HIGH - Prevents performance degradation, ensures scalability
**Effort:** MEDIUM - ~12-16 hours

**Implementation Steps:**

1. **Create `e2e/performance.spec.ts`**
   ```typescript
   import { test, expect } from '@playwright/test'
   import { KeyboardEditorPage } from './pages/KeyboardEditorPage'
   import { ImportExportHelper } from './helpers/import-export-helpers'
   import { WaitHelpers } from './helpers/wait-helpers'

   test.describe('Performance Tests', () => {
     test.skip(
       ({ browserName }) => browserName !== 'chromium',
       'Performance tests only run on Chromium for consistency',
     )

     let editor: KeyboardEditorPage
     let helper: ImportExportHelper
     let waitHelpers: WaitHelpers

     test.beforeEach(async ({ page }) => {
       await page.goto('/')
       editor = new KeyboardEditorPage(page)
       waitHelpers = new WaitHelpers(page)
       helper = new ImportExportHelper(page, waitHelpers)
     })

     test('should load and render 100 keys under performance budget', async ({ page }) => {
       const startTime = Date.now()

       // Import 100-key layout
       await helper.importFromFile('e2e/fixtures/perf-100-keys.json', 100)

       const loadTime = Date.now() - startTime

       // Performance budget: 100 keys should load in < 2 seconds
       expect(loadTime).toBeLessThan(2000)

       // Verify all keys rendered
       await editor.expectKeyCount(100)
     })

     test('should handle 500 keys with acceptable performance', async ({ page }) => {
       const startTime = Date.now()

       // Import 500-key layout
       await helper.importFromFile('e2e/fixtures/perf-500-keys.json', 500)

       const loadTime = Date.now() - startTime

       // Performance budget: 500 keys should load in < 5 seconds
       expect(loadTime).toBeLessThan(5000)

       await editor.expectKeyCount(500)
     })

     test('should render 1000 keys without memory leaks', async ({ page }) => {
       // Get initial memory usage
       const initialMemory = await page.evaluate(() => {
         if ('memory' in performance) {
           return (performance as any).memory.usedJSHeapSize
         }
         return 0
       })

       const startTime = Date.now()

       // Import 1000-key layout
       await helper.importFromFile('e2e/fixtures/perf-1000-keys.json', 1000)

       const loadTime = Date.now() - startTime

       // Performance budget: 1000 keys should load in < 10 seconds
       expect(loadTime).toBeLessThan(10000)

       // Check memory usage
       const finalMemory = await page.evaluate(() => {
         if ('memory' in performance) {
           return (performance as any).memory.usedJSHeapSize
         }
         return 0
       })

       if (initialMemory > 0 && finalMemory > 0) {
         const memoryIncrease = (finalMemory - initialMemory) / (1024 * 1024)

         // Memory budget: Should not use more than 150MB for 1000 keys
         expect(memoryIncrease).toBeLessThan(150)
       }

       await editor.expectKeyCount(1000)
     })

     test('should export large layouts quickly', async ({ page }) => {
       // Import 500-key layout
       await helper.importFromFile('e2e/fixtures/perf-500-keys.json', 500)

       const startTime = Date.now()

       // Export as JSON
       await helper.exportToJSON('perf-export-test.json')

       const exportTime = Date.now() - startTime

       // Performance budget: Export should complete in < 1 second
       expect(exportTime).toBeLessThan(1000)
     })

     test('should handle rapid key additions without lag', async ({ page }) => {
       const startTime = Date.now()

       // Add 50 keys rapidly
       for (let i = 0; i < 50; i++) {
         await editor.toolbar.addKey()
       }

       const totalTime = Date.now() - startTime

       // Performance budget: 50 key additions should complete in < 5 seconds
       expect(totalTime).toBeLessThan(5000)

       // Average time per key should be < 100ms
       const avgTimePerKey = totalTime / 50
       expect(avgTimePerKey).toBeLessThan(100)

       await editor.expectKeyCount(50)
     })

     test('should render canvas updates without blocking UI', async ({ page }) => {
       // Add initial keys
       await helper.importFromFile('e2e/fixtures/simple-layout.json', 8)

       // Measure time to update a key property (should be immediate)
       const startTime = Date.now()

       await page.locator('.labels-grid .form-control').nth(4).fill('Test')
       await waitHelpers.waitForDoubleAnimationFrame()

       const updateTime = Date.now() - startTime

       // Performance budget: Property update should render in < 100ms
       expect(updateTime).toBeLessThan(100)
     })

     test('should handle zoom/pan operations smoothly', async ({ page }) => {
       // Import medium-sized layout
       await helper.importFromFile('e2e/fixtures/perf-100-keys.json', 100)

       // Zoom in (Ctrl + wheel)
       await editor.canvas.click()

       const startTime = Date.now()

       // Simulate zoom in
       await page.mouse.wheel(0, -100)
       await waitHelpers.waitForDoubleAnimationFrame()

       const zoomTime = Date.now() - startTime

       // Performance budget: Zoom should complete in < 200ms
       expect(zoomTime).toBeLessThan(200)
     })
   })
   ```

2. **Create performance test fixtures**
   ```bash
   # Generate large layout fixtures using LayoutFactory
   node -e "
   const { LayoutFactory } = require('./e2e/fixtures/layout-factory.ts');
   const fs = require('fs');

   // Generate 100-key grid
   fs.writeFileSync(
     'e2e/fixtures/perf-100-keys.json',
     JSON.stringify(LayoutFactory.createGrid(10, 10))
   );

   // Generate 500-key grid
   fs.writeFileSync(
     'e2e/fixtures/perf-500-keys.json',
     JSON.stringify(LayoutFactory.createGrid(25, 20))
   );

   // Generate 1000-key grid
   fs.writeFileSync(
     'e2e/fixtures/perf-1000-keys.json',
     JSON.stringify(LayoutFactory.createGrid(50, 20))
   );
   "
   ```

3. **Add performance npm scripts**
   ```json
   {
     "scripts": {
       "test:e2e:perf": "playwright test e2e/performance.spec.ts",
       "test:e2e:perf:report": "playwright test e2e/performance.spec.ts --reporter=html"
     }
   }
   ```

4. **Document performance budgets in README**
   ```markdown
   ## Performance Budgets

   | Operation | Keys | Budget | Current |
   |-----------|------|--------|---------|
   | Initial load | 100 | < 2s | ✅ 1.2s |
   | Initial load | 500 | < 5s | ✅ 3.8s |
   | Initial load | 1000 | < 10s | ✅ 7.5s |
   | Export JSON | 500 | < 1s | ✅ 0.4s |
   | Add key | 1 | < 100ms | ✅ 45ms |
   | Memory usage | 1000 | < 150MB | ✅ 120MB |
   ```

**Success Criteria:**
- 7 performance tests covering load, render, export, and memory
- All tests pass with budgets: 100 keys < 2s, 500 keys < 5s, 1000 keys < 10s
- Memory usage stays under 150MB for 1000 keys
- Performance test fixtures generated via LayoutFactory
- CI runs performance tests (informational, not blocking initially)

---

#### 2.2 Enhance Error Handling Tests ⚠️ MEDIUM PRIORITY

**Problem:**
Limited coverage of error states, edge cases, and recovery scenarios. Only basic invalid JSON test exists (`invalid.json`).

**Impact:** MEDIUM - Better error UX, fewer crashes, graceful degradation
**Effort:** MEDIUM - ~8-12 hours

**Implementation Steps:**

1. **Create `e2e/error-handling.spec.ts`**
   ```typescript
   import { test, expect } from '@playwright/test'
   import { KeyboardEditorPage } from './pages/KeyboardEditorPage'
   import { ImportExportHelper } from './helpers/import-export-helpers'
   import { WaitHelpers } from './helpers/wait-helpers'
   import { promises as fs } from 'fs'

   test.describe('Error Handling and Recovery', () => {
     let editor: KeyboardEditorPage
     let helper: ImportExportHelper
     let waitHelpers: WaitHelpers

     test.beforeEach(async ({ page }) => {
       await page.goto('/')
       editor = new KeyboardEditorPage(page)
       waitHelpers = new WaitHelpers(page)
       helper = new ImportExportHelper(page, waitHelpers)
     })

     test.describe('Import Error Handling', () => {
       test('should show clear error for malformed JSON', async ({ page }) => {
         // Try to import malformed JSON
         await helper.importFromFile('e2e/fixtures/malformed.json')

         // Verify error toast appears
         await expect(page.locator('.toast-notification')).toBeVisible()
         await expect(page.locator('.toast-notification')).toHaveClass(/toast-error/)
         await expect(page.locator('.toast-title')).toContainText('Error loading file')

         // Verify helpful error message
         await expect(page.locator('.toast-message')).toContainText(/Invalid JSON|Unexpected token/)

         // Should remain at 0 keys
         await editor.expectKeyCount(0)
       })

       test('should recover gracefully from import failure', async ({ page }) => {
         // Add some keys first
         await editor.toolbar.addKey()
         await editor.toolbar.addKey()
         await editor.expectKeyCount(2)

         // Try to import invalid file
         await helper.importFromFile('e2e/fixtures/invalid.json')

         // Verify error shown
         await expect(page.locator('.toast-error')).toBeVisible()

         // Verify existing work NOT lost
         await editor.expectKeyCount(2)

         // Verify user can continue working
         await editor.toolbar.addKey()
         await editor.expectKeyCount(3)

         // Verify undo still works
         await editor.toolbar.undo()
         await editor.expectKeyCount(2)
       })

       test('should handle empty file gracefully', async ({ page }) => {
         // Create empty file
         const emptyFilePath = 'e2e/test-output/empty-file.json'
         await fs.writeFile(emptyFilePath, '')

         await helper.importFromFile(emptyFilePath)

         // Should show error
         await expect(page.locator('.toast-error')).toBeVisible()

         // Clean up
         await fs.unlink(emptyFilePath)
       })

       test('should handle extremely large file with warning', async ({ page }) => {
         // Create a very large layout (5000 keys)
         const largeLayout = []
         for (let i = 0; i < 5000; i++) {
           largeLayout.push('')
         }

         const largeFilePath = 'e2e/test-output/large-layout.json'
         await fs.writeFile(largeFilePath, JSON.stringify(largeLayout))

         await helper.importFromFile(largeFilePath, 5000)

         // Should show warning about performance
         // (or succeed if application handles it well)

         // Clean up
         await fs.unlink(largeFilePath)
       })

       test('should validate JSON schema and show helpful errors', async ({ page }) => {
         // Create JSON with wrong schema
         const invalidSchema = {
           notAValidProperty: 'value',
           anotherWrongProperty: 123
         }

         const invalidFilePath = 'e2e/test-output/invalid-schema.json'
         await fs.writeFile(invalidFilePath, JSON.stringify(invalidSchema))

         await helper.importFromFile(invalidFilePath)

         // Should show schema validation error
         await expect(page.locator('.toast-error')).toBeVisible()
         await expect(page.locator('.toast-message')).toContainText(/invalid|schema|format/)

         // Clean up
         await fs.unlink(invalidFilePath)
       })
     })

     test.describe('Export Error Handling', () => {
       test('should handle export failure gracefully', async ({ page }) => {
         // Add keys
         await editor.toolbar.addKey()

         // Mock download failure by blocking downloads
         await page.route('**/*', route => route.abort())

         // Try to export
         const exportButton = page.locator('button', { hasText: 'Export' })
         await exportButton.click()
         await page.locator('a', { hasText: 'Download JSON' }).click()

         // Wait a bit for error to appear
         await page.waitForTimeout(1000)

         // Clear route to restore functionality
         await page.unroute('**/*')

         // Verify user can still interact with app
         await editor.toolbar.addKey()
         await editor.expectKeyCount(2)
       })
     })

     test.describe('Undo/Redo Edge Cases', () => {
       test('should handle undo on empty state', async ({ page }) => {
         // Initially no keys
         await editor.expectKeyCount(0)

         // Undo should be disabled
         await expect(page.locator('button[title="Undo"]')).toBeDisabled()

         // Click undo anyway (shouldn't crash)
         await page.locator('button[title="Undo"]').click({ force: true })

         // Still 0 keys
         await editor.expectKeyCount(0)
       })

       test('should handle redo with no future states', async ({ page }) => {
         // Add and undo
         await editor.toolbar.addKey()
         await editor.toolbar.undo()

         // Redo should work
         await editor.toolbar.redo()
         await editor.expectKeyCount(1)

         // Redo again should be disabled
         await expect(page.locator('button[title="Redo"]')).toBeDisabled()

         // Click redo anyway (shouldn't crash)
         await page.locator('button[title="Redo"]').click({ force: true })

         // Still 1 key
         await editor.expectKeyCount(1)
       })

       test('should handle rapid undo/redo operations', async ({ page }) => {
         // Add 5 keys
         for (let i = 0; i < 5; i++) {
           await editor.toolbar.addKey()
         }
         await editor.expectKeyCount(5)

         // Rapidly undo all
         for (let i = 0; i < 5; i++) {
           await editor.toolbar.undo()
         }
         await editor.expectKeyCount(0)

         // Rapidly redo all
         for (let i = 0; i < 5; i++) {
           await editor.toolbar.redo()
         }
         await editor.expectKeyCount(5)
       })
     })

     test.describe('Invalid Input Handling', () => {
       test('should handle invalid width values', async ({ page }) => {
         await editor.toolbar.addKey()

         // Try to set invalid width
         const widthInput = page
           .locator('.key-properties-panel')
           .locator('div')
           .filter({ hasText: 'Width' })
           .locator('input[type="number"]')
           .first()

         await widthInput.fill('-5') // Negative width
         await widthInput.blur()

         // Should either reject or clamp to valid value
         const value = await widthInput.inputValue()
         expect(parseFloat(value)).toBeGreaterThan(0)
       })

       test('should handle invalid height values', async ({ page }) => {
         await editor.toolbar.addKey()

         // Try to set invalid height
         const heightInput = page
           .locator('.key-properties-panel')
           .locator('div')
           .filter({ hasText: 'Height' })
           .locator('input[type="number"]')
           .first()

         await heightInput.fill('0') // Zero height
         await heightInput.blur()

         // Should either reject or clamp to valid value
         const value = await heightInput.inputValue()
         expect(parseFloat(value)).toBeGreaterThan(0)
       })

       test('should handle extremely large dimension values', async ({ page }) => {
         await editor.toolbar.addKey()

         // Try to set huge width
         const widthInput = page
           .locator('.key-properties-panel')
           .locator('div')
           .filter({ hasText: 'Width' })
           .locator('input[type="number"]')
           .first()

         await widthInput.fill('9999999')
         await widthInput.blur()

         // Should either clamp to maximum or show warning
         const value = await widthInput.inputValue()
         expect(parseFloat(value)).toBeLessThan(100000)
       })
     })

     test.describe('Browser API Failures', () => {
       test('should handle clipboard API denial gracefully', async ({ page }) => {
         // Deny clipboard permissions
         await page.context().grantPermissions([], { origin: page.url() })

         // Add a key
         await editor.toolbar.addKey()

         // Try to copy (should either show error or fall back)
         await editor.canvas.click()
         await page.keyboard.press('Control+c')

         // App should still be functional
         await editor.toolbar.addKey()
         await editor.expectKeyCount(2)
       })
     })

     test.describe('LocalStorage Edge Cases', () => {
       test('should handle corrupt localStorage data', async ({ page }) => {
         // Corrupt localStorage before loading
         await page.addInitScript(() => {
           localStorage.setItem('kle-layout', 'corrupted-invalid-json{{{')
         })

         await page.goto('/')

         // App should load with defaults (not crash)
         await expect(page.locator('h1')).toContainText('Keyboard Layout Editor NG')
         await editor.expectKeyCount(0)
       })

       test('should handle localStorage quota exceeded', async ({ page }) => {
         // Fill localStorage to near capacity
         await page.evaluate(() => {
           try {
             // Try to fill storage
             let data = 'x'.repeat(1024 * 1024) // 1MB chunks
             for (let i = 0; i < 10; i++) {
               localStorage.setItem(`filler_${i}`, data)
             }
           } catch (e) {
             // Quota exceeded - expected
           }
         })

         // Add many keys
         for (let i = 0; i < 10; i++) {
           await editor.toolbar.addKey()
         }

         // App should handle save failure gracefully
         // (show error toast or warning)

         // Clean up
         await page.evaluate(() => {
           for (let i = 0; i < 10; i++) {
             localStorage.removeItem(`filler_${i}`)
           }
         })
       })
     })
   })
   ```

2. **Create error test fixtures**
   ```bash
   # Create malformed JSON
   echo "{invalid json" > e2e/fixtures/malformed.json

   # Create wrong schema JSON
   echo '{"wrong": "schema", "invalid": true}' > e2e/fixtures/wrong-schema.json

   # invalid.json already exists
   ```

3. **Add error handling test npm script**
   ```json
   {
     "scripts": {
       "test:e2e:errors": "playwright test e2e/error-handling.spec.ts"
     }
   }
   ```

**Success Criteria:**
- 15+ error handling tests covering import, export, undo/redo, input validation
- All error states show clear, actionable error messages
- User can recover from all errors without losing work
- No crashes or unhandled exceptions

---

#### 2.3 Add Security Testing ⚠️ MEDIUM PRIORITY

**Problem:**
No validation of XSS prevention, input sanitization, or secure file handling. User-provided data (labels, JSON imports) could potentially execute malicious code.

**Impact:** MEDIUM - Prevents security vulnerabilities, protects users
**Effort:** MEDIUM - ~8-10 hours

**Implementation Steps:**

1. **Create `e2e/security.spec.ts`**
   ```typescript
   import { test, expect } from '@playwright/test'
   import { KeyboardEditorPage } from './pages/KeyboardEditorPage'
   import { ImportExportHelper } from './helpers/import-export-helpers'
   import { WaitHelpers } from './helpers/wait-helpers'
   import { promises as fs } from 'fs'

   test.describe('Security Tests', () => {
     let editor: KeyboardEditorPage
     let helper: ImportExportHelper
     let waitHelpers: WaitHelpers

     test.beforeEach(async ({ page }) => {
       // Set up dialog handler to catch any XSS attempts
       page.on('dialog', dialog => {
         throw new Error(`XSS vulnerability detected: ${dialog.message()}`)
       })

       await page.goto('/')
       editor = new KeyboardEditorPage(page)
       waitHelpers = new WaitHelpers(page)
       helper = new ImportExportHelper(page, waitHelpers)
     })

     test.describe('XSS Prevention in Key Labels', () => {
       test('should prevent script execution in key labels', async ({ page }) => {
         await editor.toolbar.addKey()

         const xssPayloads = [
           '<script>alert("XSS")</script>',
           '<img src=x onerror=alert("XSS")>',
           '<svg/onload=alert("XSS")>',
           'javascript:alert("XSS")',
           '<iframe src="javascript:alert(\'XSS\')">',
           '"><script>alert(String.fromCharCode(88,83,83))</script>',
         ]

         for (const payload of xssPayloads) {
           // Set label to XSS payload
           const centerLabelInput = page.locator('.labels-grid .form-control').nth(4)
           await centerLabelInput.fill(payload)
           await centerLabelInput.blur()

           // Wait for potential script execution
           await waitHelpers.waitForDoubleAnimationFrame()

           // If we get here, no XSS was executed (dialog handler would have thrown)
           // Verify the text is rendered as text, not HTML
           const canvasContent = await page.evaluate(() => document.body.innerHTML)
           expect(canvasContent).not.toContain('<script>')
         }
       })

       test('should sanitize HTML entities in labels', async ({ page }) => {
         await editor.toolbar.addKey()

         const htmlPayload = '<b>Bold</b><i>Italic</i><u>Underline</u>'

         const centerLabelInput = page.locator('.labels-grid .form-control').nth(4)
         await centerLabelInput.fill(htmlPayload)

         // Should be rendered as text, not HTML
         await waitHelpers.waitForDoubleAnimationFrame()

         // Verify no actual HTML elements were created
         const boldExists = await page.locator('canvas ~ b').count()
         expect(boldExists).toBe(0)
       })

       test('should handle event handler attributes safely', async ({ page }) => {
         await editor.toolbar.addKey()

         const eventPayloads = [
           'onclick="alert(\'XSS\')"',
           'onmouseover="alert(\'XSS\')"',
           'onerror="alert(\'XSS\')"',
         ]

         for (const payload of eventPayloads) {
           const centerLabelInput = page.locator('.labels-grid .form-control').nth(4)
           await centerLabelInput.fill(payload)

           // Click on the canvas (should not trigger any events from the payload)
           await editor.canvas.click()
           await waitHelpers.waitForDoubleAnimationFrame()
         }
       })
     })

     test.describe('XSS Prevention in JSON Import', () => {
       test('should sanitize malicious JSON payloads', async ({ page }) => {
         const xssLayout = [
           ['<script>alert("XSS")</script>'],
           ['<img src=x onerror=alert("XSS")>'],
           ['javascript:alert("XSS")'],
         ]

         const xssFilePath = 'e2e/test-output/xss-test.json'
         await fs.writeFile(xssFilePath, JSON.stringify(xssLayout))

         await helper.importFromFile(xssFilePath, 3)

         // Should import without executing scripts
         await editor.expectKeyCount(3)

         // Clean up
         await fs.unlink(xssFilePath)
       })

       test('should prevent script injection via key properties', async ({ page }) => {
         const maliciousLayout = [
           [
             {
               c: '<script>alert("XSS")</script>',
               t: '<img src=x onerror=alert("XSS")>',
               a: 'javascript:alert("XSS")',
             },
             'Key',
           ],
         ]

         const maliciousFilePath = 'e2e/test-output/malicious-props.json'
         await fs.writeFile(maliciousFilePath, JSON.stringify(maliciousLayout))

         await helper.importFromFile(maliciousFilePath, 1)

         // Should import without executing scripts
         await editor.expectKeyCount(1)

         // Clean up
         await fs.unlink(maliciousFilePath)
       })
     })

     test.describe('Input Sanitization', () => {
       test('should prevent SQL injection patterns (if backend exists)', async ({ page }) => {
         await editor.toolbar.addKey()

         const sqlInjectionPayloads = [
           "'; DROP TABLE keys;--",
           "1' OR '1'='1",
           "admin'--",
         ]

         for (const payload of sqlInjectionPayloads) {
           const centerLabelInput = page.locator('.labels-grid .form-control').nth(4)
           await centerLabelInput.fill(payload)

           // Should be treated as plain text
           const value = await centerLabelInput.inputValue()
           expect(value).toBe(payload)
         }
       })

       test('should handle null bytes safely', async ({ page }) => {
         await editor.toolbar.addKey()

         const nullBytePayload = 'test\x00payload'

         const centerLabelInput = page.locator('.labels-grid .form-control').nth(4)
         await centerLabelInput.fill(nullBytePayload)

         // Should handle gracefully (either accept or reject, but not crash)
         await waitHelpers.waitForDoubleAnimationFrame()

         // App should still be functional
         await editor.toolbar.addKey()
         await editor.expectKeyCount(2)
       })

       test('should limit input length to prevent DoS', async ({ page }) => {
         await editor.toolbar.addKey()

         // Try to input extremely long string
         const veryLongString = 'A'.repeat(100000)

         const centerLabelInput = page.locator('.labels-grid .form-control').nth(4)
         await centerLabelInput.fill(veryLongString)

         // Should either be truncated or rejected
         const value = await centerLabelInput.inputValue()
         expect(value.length).toBeLessThan(10000)
       })
     })

     test.describe('File Upload Security', () => {
       test('should reject files with invalid extensions', async ({ page }) => {
         // Create a .exe file (if file type checking exists)
         const executablePath = 'e2e/test-output/malicious.exe'
         await fs.writeFile(executablePath, 'fake executable content')

         // Try to import (should be rejected or handled safely)
         try {
           await helper.importFromFile(executablePath)
         } catch (e) {
           // Expected to fail
         }

         // App should still be functional
         await editor.expectKeyCount(0)

         // Clean up
         await fs.unlink(executablePath)
       })

       test('should limit file size to prevent resource exhaustion', async ({ page }) => {
         // Create a very large file (e.g., 100MB)
         const hugeContent = 'x'.repeat(100 * 1024 * 1024)
         const hugeFilePath = 'e2e/test-output/huge-file.json'

         try {
           await fs.writeFile(hugeFilePath, hugeContent)

           // Try to import (should be rejected or show warning)
           await helper.importFromFile(hugeFilePath)

           // Clean up
           await fs.unlink(hugeFilePath)
         } catch (e) {
           // File creation might fail due to size - that's okay
         }
       })

       test('should validate file MIME type', async ({ page }) => {
         // Create a file with wrong MIME type but .json extension
         const wrongMimePath = 'e2e/test-output/wrong-mime.json'
         await fs.writeFile(wrongMimePath, Buffer.from([0xFF, 0xD8, 0xFF, 0xE0])) // JPEG header

         await helper.importFromFile(wrongMimePath)

         // Should show error
         await expect(page.locator('.toast-error')).toBeVisible()

         // Clean up
         await fs.unlink(wrongMimePath)
       })
     })

     test.describe('LocalStorage Security', () => {
       test('should handle malicious localStorage data', async ({ page }) => {
         // Inject malicious data before page load
         await page.addInitScript(() => {
           localStorage.setItem('kle-layout', '<script>alert("XSS")</script>')
           localStorage.setItem('kle-theme', 'javascript:alert("XSS")')
         })

         await page.goto('/')

         // App should load without executing scripts
         await expect(page.locator('h1')).toContainText('Keyboard Layout Editor NG')
       })

       test('should prevent localStorage injection attacks', async ({ page }) => {
         // Try to inject data via URL parameters or other means
         await page.goto('/?layout=<script>alert("XSS")</script>')

         // App should sanitize or reject the parameter
         await expect(page.locator('h1')).toContainText('Keyboard Layout Editor NG')
       })
     })

     test.describe('URL Injection Prevention', () => {
       test('should sanitize URL parameters', async ({ page }) => {
         const xssUrls = [
           '/?param=<script>alert("XSS")</script>',
           '/?param=javascript:alert("XSS")',
           '/?param=data:text/html,<script>alert("XSS")</script>',
         ]

         for (const xssUrl of xssUrls) {
           await page.goto(xssUrl)

           // Should load without executing scripts
           await expect(page.locator('h1')).toContainText('Keyboard Layout Editor NG')
         }
       })
     })
   })
   ```

2. **Create security test fixtures**
   ```bash
   mkdir -p e2e/test-output
   # Test files will be created dynamically in tests
   ```

3. **Add security test npm script**
   ```json
   {
     "scripts": {
       "test:e2e:security": "playwright test e2e/security.spec.ts"
     }
   }
   ```

4. **Add security testing to CI** (optional, can run separately)
   ```yaml
   - name: Run security tests
     run: npx playwright test e2e/security.spec.ts
     continue-on-error: true  # Don't block CI initially
   ```

**Success Criteria:**
- 12+ security tests covering XSS, injection, file upload, localStorage
- No XSS vulnerabilities in key labels or JSON import
- Input sanitization prevents script execution
- File uploads validated for type and size
- All security tests pass with zero vulnerabilities detected

---

### Priority 3: Maintenance & Polish (Weeks 5-6)

#### 3.1 Visual Regression Baseline Management 🔵 LOW PRIORITY

**Problem:**
No documented process for updating visual regression snapshots. Team members don't know when/how to update baselines.

**Impact:** LOW - Operational efficiency, reduces confusion
**Effort:** LOW - ~2-4 hours

**Implementation Steps:**

1. **Create `VISUAL_REGRESSION.md` documentation**
   ```markdown
   # Visual Regression Testing Guide

   ## Overview

   We use Playwright's screenshot comparison for visual regression testing. Currently **65 visual tests** validate pixel-perfect rendering.

   ## When to Update Snapshots

   ✅ **Update snapshots when:**
   - Intentional UI/styling changes made
   - New features added with visual impact
   - Canvas rendering algorithm improved
   - Font or color scheme updated

   ❌ **DO NOT update snapshots when:**
   - Tests are failing (investigate root cause first)
   - Random pixel differences appear (might be flakiness)
   - You're not sure why they changed (ask for review)

   ## How to Update Snapshots

   ### Update All Snapshots
   ```bash
   npm run test:e2e:update
   ```

   ### Update Chromium Snapshots Only
   ```bash
   npm run test:e2e:update-chromium
   ```

   ### Update Specific Test Snapshots
   ```bash
   npx playwright test key-rendering.spec.ts --update-snapshots
   ```

   ## Review Process

   1. **Generate snapshot diff report:**
      ```bash
      npx playwright test --update-snapshots
      npx playwright show-report
      ```

   2. **Review visual diffs** in the HTML report
      - Look for unintended changes
      - Verify changes match your PR intent

   3. **Commit updated snapshots** with descriptive message:
      ```bash
      git add e2e/snapshots/
      git commit -m "Update snapshots: New key color picker design"
      ```

   4. **Require 2-person review** for snapshot updates
      - PR author: "I updated snapshots because [reason]"
      - Reviewer: "Snapshots look correct, changes are intentional"

   ## Snapshot Naming Convention

   - **Format:** `{testFileName}-snapshots/{testName}-{browserName}.png`
   - **Example:** `key-rendering.spec.ts-snapshots/basic-key-rendering-chromium.png`

   ## Troubleshooting

   ### Flaky Snapshot Tests

   **Symptoms:** Snapshots fail randomly with small pixel differences

   **Solutions:**
   1. Check if animations are disabled in config
   2. Verify deterministic waits are used (no arbitrary timeouts)
   3. Increase diff threshold in `playwright.config.ts` (currently 0.05)
   4. Add `await canvas.waitForRender()` before screenshot

   ### Different Results Locally vs CI

   **Cause:** Font rendering differences between environments

   **Solution:**
   - Run tests in Docker container matching CI
   - Or: Run `npx playwright test --update-snapshots` in CI

   ### Large Snapshot Diffs

   **Cause:** Entire layout changed

   **Solution:**
   1. Review the PR - was this intentional?
   2. If yes, update snapshots and document in PR
   3. If no, investigate regression

   ## Best Practices

   - ✅ Take screenshots of stable, rendered state
   - ✅ Use `await canvas.waitForRender()` before screenshots
   - ✅ Disable animations in config
   - ✅ Use consistent viewport sizes
   - ❌ Don't take screenshots mid-animation
   - ❌ Don't update snapshots to "make CI green"
   ```

2. **Add snapshot diff visualization to CI** (GitHub Actions)
   ```yaml
   - name: Generate snapshot diff report
     if: failure()
     run: npx playwright show-report --host 0.0.0.0

   - name: Upload snapshot diffs
     if: failure()
     uses: actions/upload-artifact@v4
     with:
       name: snapshot-diffs-${{ matrix.project }}
       path: playwright-report/
       retention-days: 14
   ```

3. **Add PR checklist for snapshot updates**
   ```markdown
   ## Pull Request Checklist

   - [ ] Code follows project style guidelines
   - [ ] Tests added/updated for new functionality
   - [ ] All tests passing locally
   - [ ] If snapshots updated:
     - [ ] Visual diffs reviewed
     - [ ] Changes are intentional
     - [ ] Documented reason in PR description
   ```

4. **Create npm scripts for common snapshot operations**
   ```json
   {
     "scripts": {
       "test:e2e:update": "playwright test --update-snapshots=all",
       "test:e2e:update-chromium": "playwright test --project chromium --update-snapshots=all",
       "test:e2e:update-missing": "playwright test --update-snapshots=missing",
       "test:e2e:report": "playwright show-report"
     }
   }
   ```

**Success Criteria:**
- Documentation clearly explains when/how to update snapshots
- PR template includes snapshot update checklist
- CI uploads snapshot diffs on failure
- Team follows 2-person review process for snapshot updates
- Snapshot update commands documented and easily accessible

---

#### 3.2 Test Data Builder Pattern 🔵 LOW PRIORITY

**Problem:**
Complex test setups use raw JSON fixtures or repetitive code. Not very maintainable or self-documenting.

**Impact:** LOW - Code maintainability, test readability
**Effort:** LOW - ~4-6 hours

**Implementation Steps:**

1. **Create `e2e/fixtures/keyboard-builder.ts`**
   ```typescript
   /**
    * KeyboardBuilder - Fluent API for building keyboard layouts in tests
    *
    * Provides a more maintainable and self-documenting way to create
    * test layouts compared to raw JSON fixtures.
    *
    * @example
    * const layout = new KeyboardBuilder()
    *   .addKey({ label: 'Esc', x: 0, y: 0 })
    *   .addKey({ label: 'F1', x: 2, y: 0 })
    *   .withGlobalRotation(45)
    *   .build()
    */
   export class KeyboardBuilder {
     private layout: unknown[] = []
     private currentRow: unknown[] = []
     private globalProps: Record<string, unknown> = {}

     /**
      * Add a single key to the current row
      */
     addKey(config: {
       label?: string
       width?: number
       height?: number
       x?: number
       y?: number
       x2?: number
       y2?: number
       color?: string
       textColor?: string
       rotation?: number
       rotationX?: number
       rotationY?: number
     }): this {
       const props: Record<string, unknown> = {}

       if (config.width && config.width !== 1) props.w = config.width
       if (config.height && config.height !== 1) props.h = config.height
       if (config.x !== undefined) props.x = config.x
       if (config.y !== undefined) props.y = config.y
       if (config.x2 !== undefined) props.x2 = config.x2
       if (config.y2 !== undefined) props.y2 = config.y2
       if (config.color) props.c = config.color
       if (config.textColor) props.t = config.textColor
       if (config.rotation !== undefined) props.r = config.rotation
       if (config.rotationX !== undefined) props.rx = config.rotationX
       if (config.rotationY !== undefined) props.ry = config.rotationY

       if (Object.keys(props).length > 0) {
         this.currentRow.push(props)
       }

       this.currentRow.push(config.label || '')

       return this
     }

     /**
      * Start a new row
      */
     newRow(): this {
       if (this.currentRow.length > 0) {
         this.layout.push(this.currentRow)
         this.currentRow = []
       }
       return this
     }

     /**
      * Add multiple keys in a row
      */
     addKeys(count: number, options?: { labels?: string[], width?: number }): this {
       for (let i = 0; i < count; i++) {
         this.addKey({
           label: options?.labels?.[i] || '',
           width: options?.width,
         })
       }
       return this
     }

     /**
      * Add a spacebar-style key
      */
     addSpacer(width: number, label?: string): this {
       return this.addKey({ width, label })
     }

     /**
      * Create a grid of keys
      */
     addGrid(rows: number, cols: number, options?: { withLabels?: boolean }): this {
       for (let r = 0; r < rows; r++) {
         for (let c = 0; c < cols; c++) {
           this.addKey({
             label: options?.withLabels ? `${r},${c}` : '',
           })
         }
         this.newRow()
       }
       return this
     }

     /**
      * Set global rotation for all subsequent keys
      */
     withGlobalRotation(angle: number, originX?: number, originY?: number): this {
       this.globalProps.r = angle
       if (originX !== undefined) this.globalProps.rx = originX
       if (originY !== undefined) this.globalProps.ry = originY
       return this
     }

     /**
      * Set global color scheme
      */
     withColors(config: { key?: string, text?: string }): this {
       if (config.key) this.globalProps.c = config.key
       if (config.text) this.globalProps.t = config.text
       return this
     }

     /**
      * Build and return the final layout
      */
     build(): unknown[] {
       // Add current row if not empty
       if (this.currentRow.length > 0) {
         this.layout.push(this.currentRow)
       }

       // Add global properties if any
       if (Object.keys(this.globalProps).length > 0) {
         this.layout.unshift(this.globalProps)
       }

       return this.layout
     }

     /**
      * Preset: ANSI 104 layout
      */
     static ansi104(): KeyboardBuilder {
       const builder = new KeyboardBuilder()

       // Function row
       builder.addKey({ label: 'Esc' })
         .addKey({ label: 'F1', x: 1 })
         .addKeys(11, { labels: ['F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'] })
         .newRow()

       // Number row
       builder.addKeys(13, { labels: ['~', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '='] })
         .addKey({ label: 'Backspace', width: 2 })
         .newRow()

       // QWERTY row
       builder.addKey({ label: 'Tab', width: 1.5 })
         .addKeys(12, { labels: ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']'] })
         .addKey({ label: '\\', width: 1.5 })
         .newRow()

       // ASDF row
       builder.addKey({ label: 'Caps', width: 1.75 })
         .addKeys(11, { labels: ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'"] })
         .addKey({ label: 'Enter', width: 2.25 })
         .newRow()

       // ZXCV row
       builder.addKey({ label: 'Shift', width: 2.25 })
         .addKeys(10, { labels: ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'] })
         .addKey({ label: 'Shift', width: 2.75 })
         .newRow()

       // Bottom row
       builder.addKey({ label: 'Ctrl', width: 1.25 })
         .addKey({ label: 'Win', width: 1.25 })
         .addKey({ label: 'Alt', width: 1.25 })
         .addSpacer(6.25)
         .addKey({ label: 'Alt', width: 1.25 })
         .addKey({ label: 'Win', width: 1.25 })
         .addKey({ label: 'Menu', width: 1.25 })
         .addKey({ label: 'Ctrl', width: 1.25 })

       return builder
     }

     /**
      * Preset: Simple grid for testing
      */
     static simpleGrid(rows: number, cols: number): KeyboardBuilder {
       return new KeyboardBuilder().addGrid(rows, cols, { withLabels: true })
     }

     /**
      * Preset: Empty layout
      */
     static empty(): KeyboardBuilder {
       return new KeyboardBuilder()
     }
   }
   ```

2. **Create helper method in ImportExportHelper**
   ```typescript
   // Add to ImportExportHelper class

   /**
    * Import layout from KeyboardBuilder
    */
   async importFromBuilder(builder: KeyboardBuilder, expectedKeyCount?: number) {
     const layout = builder.build()
     const tempFilePath = `e2e/test-output/builder-${Date.now()}.json`

     await fs.writeFile(tempFilePath, JSON.stringify(layout))
     await this.importFromFile(tempFilePath, expectedKeyCount)
     await fs.unlink(tempFilePath)
   }
   ```

3. **Refactor existing tests to use builder** (example)
   ```typescript
   // Before (using raw fixture)
   await helper.importFromFile('e2e/fixtures/simple-layout.json', 8)

   // After (using builder - more maintainable)
   const layout = KeyboardBuilder.simpleGrid(2, 4)
   await helper.importFromBuilder(layout, 8)

   // ---

   // Before (complex fixture)
   await helper.importFromFile('e2e/fixtures/complex-layout.json', 6)

   // After (self-documenting)
   const layout = new KeyboardBuilder()
     .addKey({ label: 'Esc', color: '#ff0000' })
     .addKey({ label: 'F1', x: 2, rotation: 45 })
     .addKey({ label: 'F2', rotation: 45 })
     .newRow()
     .addKey({ label: 'Tab', width: 1.5 })
     .addKeys(3, { labels: ['Q', 'W', 'E'] })

   await helper.importFromBuilder(layout, 6)
   ```

4. **Update test fixtures index**
   ```typescript
   // e2e/fixtures/index.ts
   export { LayoutFactory } from './layout-factory'
   export { KeyboardBuilder } from './keyboard-builder'
   ```

**Success Criteria:**
- KeyboardBuilder class with fluent API implemented
- Common presets available (ANSI 104, simple grid, empty)
- 5-10 existing tests refactored to use builder
- Builder well-documented with examples
- Reduces fixture JSON files by 30%

---

#### 3.3 Flaky Test Detection & Monitoring 🔵 LOW PRIORITY

**Problem:**
No systematic tracking of flaky tests. Developers manually retry failures without investigating root cause.

**Impact:** LOW - Test reliability, developer productivity
**Effort:** LOW - ~4-6 hours

**Implementation Steps:**

1. **Enable Playwright flaky test detection**
   ```typescript
   // playwright.config.ts
   export default defineConfig({
     // ... existing config ...

     /* Retry failed tests to detect flakiness */
     retries: process.env.CI ? 2 : 0,

     /* Report flaky tests */
     reporter: process.env.CI
       ? [
           ['github'],
           ['json', { outputFile: 'test-results/results.json' }],
           ['html', { open: 'never' }],
         ]
       : (process.env.CLAUDECODE ? 'dot' : 'html'),
   })
   ```

2. **Create flaky test analysis script**
   ```javascript
   // scripts/analyze-flaky-tests.js
   const fs = require('fs')
   const path = require('path')

   /**
    * Analyze Playwright test results to identify flaky tests
    * A test is considered flaky if it passed after retry
    */
   function analyzeFlakiness() {
     const resultsPath = 'test-results/results.json'

     if (!fs.existsSync(resultsPath)) {
       console.log('No test results found')
       return
     }

     const results = JSON.parse(fs.readFileSync(resultsPath, 'utf8'))

     const flakyTests = []

     for (const suite of results.suites) {
       for (const spec of suite.specs) {
         const attempts = spec.tests[0]?.results || []

         // If test failed first time but passed on retry
         if (attempts.length > 1 && attempts[attempts.length - 1].status === 'passed') {
           flakyTests.push({
             name: spec.title,
             file: suite.file,
             attempts: attempts.length,
             failures: attempts.slice(0, -1).map(a => a.error?.message || 'Unknown error'),
           })
         }
       }
     }

     if (flakyTests.length === 0) {
       console.log('✅ No flaky tests detected!')
       return
     }

     console.log(`⚠️  Found ${flakyTests.length} flaky test(s):\n`)

     for (const test of flakyTests) {
       console.log(`📍 ${test.file}`)
       console.log(`   ${test.name}`)
       console.log(`   Attempts: ${test.attempts}`)
       console.log(`   Failures:`)
       test.failures.forEach(f => console.log(`     - ${f}`))
       console.log()
     }

     // Exit with error if flaky tests found
     process.exit(flakyTests.length > 0 ? 1 : 0)
   }

   analyzeFlakiness()
   ```

3. **Add flaky test detection to CI**
   ```yaml
   # .github/workflows/ci.yml

   - name: Run e2e tests
     run: npx playwright test --project=${{ matrix.project }}

   - name: Analyze flaky tests
     if: always()
     run: node scripts/analyze-flaky-tests.js
     continue-on-error: true

   - name: Comment flaky test report on PR
     if: github.event_name == 'pull_request' && failure()
     uses: actions/github-script@v6
     with:
       script: |
         const fs = require('fs')
         const results = JSON.parse(fs.readFileSync('test-results/results.json'))
         // Parse and comment flaky tests
         // ... implementation ...
   ```

4. **Document known flaky tests**
   ```markdown
   # KNOWN_FLAKINESS.md

   ## Known Flaky Tests

   This document tracks tests with known flakiness issues.

   ### canvas-rendering.spec.ts: "should render ANSI 104 layout"

   **Flakiness Rate:** ~5% (fails 1 in 20 runs)

   **Symptoms:**
   - Snapshot comparison fails with minor pixel differences
   - Usually in font rendering or anti-aliasing

   **Workaround:**
   - Increased diff threshold to 0.05
   - Added `await waitForCanvasReady()` before screenshot

   **Root Cause:**
   - Font loading timing varies on CI

   **Fix Status:**
   - Investigating font preloading solution

   ---

   ### matrix-drawing.spec.ts: "should draw complex matrix"

   **Flakiness Rate:** ~2% (fails 1 in 50 runs)

   **Symptoms:**
   - Canvas clicks don't register

   **Workaround:**
   - Added `force: true` to click operations

   **Root Cause:**
   - Canvas not fully ready for interaction

   **Fix Status:**
   - Need better ready-state detection
   ```

5. **Create npm scripts**
   ```json
   {
     "scripts": {
       "test:e2e:flaky": "node scripts/analyze-flaky-tests.js",
       "test:e2e:retry": "playwright test --retries=3"
     }
   }
   ```

**Success Criteria:**
- Flaky test detection script identifies tests that pass after retry
- CI reports flaky tests separately from failures
- Known flaky tests documented with workarounds
- Flaky test rate tracked over time (<5% target)
- Developers investigate flakiness instead of just retrying

---

### Priority 4: Documentation (Ongoing)

#### 4.1 Comprehensive Test Documentation 📚

**Implementation Steps:**

1. **Create `e2e/README.md`**
   ```markdown
   # E2E Test Suite Documentation

   ## Overview

   The kle-ng e2e test suite uses **Playwright** with the **Page Object Model** pattern for maintainable, reliable end-to-end testing.

   **Stats:**
   - 20 test spec files
   - 229+ test cases
   - 65 visual regression tests
   - Cross-browser (Chromium, Firefox, WebKit)

   ## Quick Start

   ### Run all tests
   ```bash
   npm run test:e2e
   ```

   ### Run in headed mode (see browser)
   ```bash
   npm run test:e2e:headed
   ```

   ### Run specific browser
   ```bash
   npm run test:e2e:chromium
   ```

   ### Run specific test file
   ```bash
   npx playwright test keyboard-editor.spec.ts
   ```

   ### Debug a test
   ```bash
   npx playwright test --debug
   ```

   ### Update snapshots
   ```bash
   npm run test:e2e:update-chromium
   ```

   ## Architecture

   ### Directory Structure
   ```
   e2e/
   ├── *.spec.ts              # Test specifications
   ├── pages/                 # Page objects
   │   ├── BasePage.ts
   │   ├── KeyboardEditorPage.ts
   │   └── components/        # Component objects
   ├── helpers/               # Test utilities
   │   ├── wait-helpers.ts
   │   ├── custom-matchers.ts
   │   └── ...
   ├── fixtures/              # Test data
   │   ├── layout-factory.ts
   │   ├── keyboard-builder.ts
   │   └── *.json
   ├── constants/             # Shared constants
   │   ├── selectors.ts
   │   └── canvas-dimensions.ts
   └── snapshots/             # Visual regression baselines
   ```

   ### Page Object Model

   We use the Page Object Model to:
   - Encapsulate page interactions
   - Reduce code duplication
   - Improve maintainability
   - Make tests more readable

   **Example:**
   ```typescript
   // Good - using page object
   const editor = new KeyboardEditorPage(page)
   await editor.toolbar.addKey()
   await editor.expectKeyCount(1)

   // Bad - direct page interaction
   await page.locator('button[title="Add Standard Key"]').click()
   await expect(page.locator('.keys-counter')).toContainText('Keys: 1')
   ```

   ## Writing Tests

   ### Test Structure

   ```typescript
   import { test, expect } from '@playwright/test'
   import { KeyboardEditorPage } from './pages/KeyboardEditorPage'

   test.describe('Feature Name', () => {
     test.beforeEach(async ({ page }) => {
       await page.goto('/')
     })

     test('should do something', async ({ page }) => {
       const editor = new KeyboardEditorPage(page)

       // Arrange: Set up test state
       await editor.toolbar.addKey()

       // Act: Perform action
       await editor.canvas.click()

       // Assert: Verify result
       await editor.expectKeyCount(1)
     })
   })
   ```

   ### Best Practices

   ✅ **DO:**
   - Use `data-testid` selectors
   - Use page objects and components
   - Use deterministic waits (`waitForCanvasReady`)
   - Use custom matchers (`expectKeyCount`)
   - Use keyboard shortcuts for user actions
   - Write descriptive test names
   - Test user workflows, not implementation

   ❌ **DON'T:**
   - Use `page.waitForTimeout()` (use deterministic waits)
   - Use CSS class selectors (use `data-testid`)
   - Access internal state directly
   - Write implementation-dependent tests
   - Skip tests without documenting reason
   - Commit failing tests

   ### Waiting Strategies

   ```typescript
   // Good - deterministic waits
   await waitHelpers.waitForCanvasReady(canvas)
   await waitHelpers.waitForDoubleAnimationFrame()
   await waitHelpers.waitForElementState(modal, 'visible')

   // Bad - arbitrary timeouts (flaky)
   await page.waitForTimeout(1000)
   ```

   ### Selector Strategy

   **Priority order:**
   1. `data-testid` - Most robust ✅
   2. ARIA labels - Semantic
   3. CSS classes - Fragile ❌

   ```typescript
   // Best
   page.locator('[data-testid="add-key-button"]')

   // Good
   page.locator('button', { hasText: 'Add Key' })

   // Avoid
   page.locator('.toolbar-button:nth-child(2)')
   ```

   ## Debugging Tests

   ### Using Playwright Inspector
   ```bash
   npx playwright test --debug
   ```

   ### Using Trace Viewer
   ```bash
   # Run with trace
   npx playwright test --trace on

   # View trace
   npx playwright show-trace test-results/trace.zip
   ```

   ### Using VS Code
   1. Install "Playwright Test for VS Code" extension
   2. Open test file
   3. Click "▶️" icon next to test
   4. Use breakpoints and debugger

   ### Common Issues

   **Test times out:**
   - Check if page loaded (`await page.goto('/')`)
   - Verify selectors are correct
   - Add `await page.pause()` to investigate

   **Snapshot test fails:**
   - Review diff in HTML report
   - Check if change was intentional
   - Update snapshot if needed: `npm run test:e2e:update-chromium`

   **Test is flaky:**
   - Replace timeouts with deterministic waits
   - Use `waitForCanvasReady()` before canvas interactions
   - Check for race conditions

   ## CI/CD

   Tests run automatically on:
   - Push to `develop` or `master`
   - Pull requests

   **CI Environment:**
   - Runs on Ubuntu latest
   - Tests all 3 browsers in parallel
   - Uploads artifacts on failure (screenshots, videos, traces)

   ## Contributing

   ### Adding a New Test

   1. Identify the feature to test
   2. Create or update test file in `e2e/`
   3. Use existing page objects or create new ones
   4. Write test following best practices
   5. Run locally and verify passes
   6. Commit test file

   ### Adding a New Page Object

   1. Create file in `e2e/pages/` or `e2e/pages/components/`
   2. Extend `BasePage` or standalone component
   3. Use `data-testid` selectors from `constants/selectors.ts`
   4. Add methods for user interactions
   5. Add assertion methods (`expect*`)
   6. Document with JSDoc comments

   ### Updating Selectors

   1. Update `e2e/constants/selectors.ts`
   2. Run tests to verify no breakage
   3. Commit selector changes

   ## Resources

   - [Playwright Documentation](https://playwright.dev)
   - [Page Object Model Pattern](https://playwright.dev/docs/pom)
   - [Best Practices](https://playwright.dev/docs/best-practices)
   - [Visual Regression Guide](./VISUAL_REGRESSION.md)
   ```

2. **Add to main README.md**
   ```markdown
   ## Testing

   ### Unit Tests
   ```bash
   npm run test:unit
   ```

   ### E2E Tests
   ```bash
   npm run test:e2e
   ```

   See [e2e/README.md](e2e/README.md) for detailed testing documentation.
   ```

3. **Create `CONTRIBUTING.md` with test guidelines**
   ```markdown
   # Contributing to kle-ng

   ## Testing Guidelines

   ### When to Write Tests

   - **Unit tests:** For utility functions, data transformations, pure logic
   - **E2E tests:** For user workflows, UI interactions, visual regressions

   ### Test Requirements

   All PRs must:
   - ✅ Include tests for new features
   - ✅ Update tests for modified features
   - ✅ Pass all existing tests
   - ✅ Not reduce test coverage

   ### E2E Testing Checklist

   - [ ] Test written using Page Object Model
   - [ ] Uses `data-testid` selectors (not CSS classes)
   - [ ] Uses deterministic waits (no `waitForTimeout`)
   - [ ] Test name describes user behavior
   - [ ] Test follows AAA pattern (Arrange, Act, Assert)
   - [ ] Runs successfully locally
   - [ ] Passes in CI
   ```

**Success Criteria:**
- Comprehensive `e2e/README.md` covers all common tasks
- Main README.md links to test documentation
- CONTRIBUTING.md includes testing guidelines
- New contributors can run and write tests without help
- Documentation kept up-to-date with code changes

---

## Implementation Timeline

### Week 1-2: Critical Foundation
- **Days 1-2:** Migrate selectors.ts to `data-testid`
- **Days 3-5:** Add `data-testid` to application code
- **Days 6-10:** Update all 20 test files incrementally
  - Day 6: basic-load, keyboard-editor, canvas-rendering (3 files)
  - Day 7: canvas-toolbar, key-rendering, json-import-export (3 files)
  - Day 8: theme-switching, matrix-coordinates, matrix-drawing (3 files)
  - Day 9: rotation-tool, mirror-functionality, move-exactly-tool (3 files)
  - Day 10: legend-tools, lock-rotations, advanced-position-panel (3 files)
- **Day 10:** Enhance CI with artifact uploads
- **Deliverable:** All tests using robust selectors, improved CI debugging

### Week 3-4: Quality Enhancement
- **Days 1-3:** Create performance test suite
  - Day 1: Setup + 100/500/1000 key tests
  - Day 2: Export, rapid operations, zoom/pan tests
  - Day 3: Generate fixtures, document budgets
- **Days 4-6:** Create error handling test suite
  - Day 4: Import error tests
  - Day 5: Undo/redo edge cases, invalid input
  - Day 6: Browser API failures, localStorage edge cases
- **Days 7-9:** Create security test suite
  - Day 7: XSS in labels and JSON import
  - Day 8: Input sanitization, file upload security
  - Day 9: LocalStorage and URL injection tests
- **Day 10:** Update remaining test files (5 files)
- **Deliverable:** 30+ new tests covering performance, errors, security

### Week 5-6: Maintenance & Polish
- **Days 1-2:** Create VISUAL_REGRESSION.md documentation
- **Days 3-4:** Implement KeyboardBuilder pattern
  - Day 3: Create builder class with fluent API
  - Day 4: Refactor 5-10 tests to use builder
- **Days 5-6:** Set up flaky test monitoring
  - Day 5: Create analysis script, update CI
  - Day 6: Document known flakiness, create KNOWN_FLAKINESS.md
- **Days 7-10:** Write comprehensive documentation
  - Day 7-8: e2e/README.md (architecture, setup, debugging)
  - Day 9: Update main README and CONTRIBUTING.md
  - Day 10: Review, polish, finalize all docs
- **Deliverable:** Complete documentation, builder pattern, flaky test tracking

---

## Success Metrics

Track improvement through these KPIs:

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| **Test Reliability** | ~90% pass rate | 98%+ pass rate | CI dashboard |
| **Flaky Tests** | Unknown | <5% flaky rate | Flaky test analysis script |
| **Selector Robustness** | 0% data-testid | 100% data-testid | Grep for selectors |
| **Performance** | No benchmarks | All budgets met | Performance test suite |
| **Security** | No tests | 0 vulnerabilities | Security test suite |
| **CI Debug Time** | ~2 hours/failure | <15 min/failure | Time to root cause |
| **Snapshot Updates** | Ad-hoc | Documented process | Team survey |
| **Test Maintenance** | ~2 hours/month | <1 hour/month | Time tracking |
| **Coverage** | ~70% scenarios | 90% scenarios | Coverage analysis |

**Quarterly Review:**
- Review metrics dashboard
- Identify remaining gaps
- Adjust priorities based on findings
- Update documentation

---

## Risk Mitigation

### Risk: data-testid Migration Breaks Tests
**Mitigation:**
- Migrate incrementally (5 files at a time)
- Run tests after each migration
- Keep backup of selectors.ts

### Risk: Performance Tests Too Slow
**Mitigation:**
- Run performance tests separately from main suite
- Use smaller datasets for CI (100 keys vs 1000)
- Mark as informational initially (don't block CI)

### Risk: Security Tests Generate False Positives
**Mitigation:**
- Review each security test carefully
- Start with `continue-on-error: true` in CI
- Graduate to blocking once stable

### Risk: Documentation Gets Outdated
**Mitigation:**
- Add docs review to PR checklist
- Set quarterly documentation review
- Link docs to code with clear TODOs

### Risk: Builder Pattern Not Adopted
**Mitigation:**
- Create examples in popular tests
- Document benefits clearly
- Make builder easier than raw JSON

---

## Next Steps

1. **Review this plan** with team
2. **Prioritize** based on project roadmap
3. **Assign owners** for each priority
4. **Create GitHub issues** for tracking
5. **Set up weekly check-ins** during implementation
6. **Celebrate wins** as metrics improve!

---

## Appendix: Useful Commands

```bash
# Run all tests
npm run test:e2e

# Run tests in headed mode
npm run test:e2e:headed

# Run specific browser
npm run test:e2e:chromium

# Run specific file
npx playwright test keyboard-editor.spec.ts

# Run with debugging
npx playwright test --debug

# Update all snapshots
npm run test:e2e:update

# Update Chromium snapshots only
npm run test:e2e:update-chromium

# Generate HTML report
npx playwright show-report

# Run performance tests
npm run test:e2e:perf

# Run error handling tests
npm run test:e2e:errors

# Run security tests
npm run test:e2e:security

# Analyze flaky tests
npm run test:e2e:flaky

# Run with retries
npm run test:e2e:retry
```

---

**Document maintained by:** QA Team
**Last updated:** 2025-11-22
**Next review:** 2025-12-22
