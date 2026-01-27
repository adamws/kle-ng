import { test, expect } from '@playwright/test'
import { CanvasTestHelper } from './helpers/canvas-test-helpers'
import { WaitHelpers } from './helpers/wait-helpers'

test.describe('Key Rendering Tests', () => {
  // Canvas rendering tests only run on Chromium since we've verified
  // pixel-perfect identical rendering across all browsers
  test.skip(
    ({ browserName }) => browserName !== 'chromium',
    'Canvas rendering tests only run on Chromium (verified identical across browsers)',
  )

  let helper: CanvasTestHelper
  let waitHelpers: WaitHelpers

  test.beforeEach(async ({ page }) => {
    helper = new CanvasTestHelper(page)
    waitHelpers = new WaitHelpers(page)
    await page.goto('/')
    await helper.clearLayout()
  })

  test.describe('Basic Key Shapes and Sizes', () => {
    test('standard 1x1 key', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'A')
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('basic-1x1-key-A.png')
    })

    test('1.25u key (Tab)', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'Tab')
      await helper.setKeySize(1.25)
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('basic-1-25u-key-tab.png')
    })

    test('1.5u key (Backslash)', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', '\\')
      await helper.setKeySize(1.5)
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('basic-1-5u-key-backslash.png')
    })

    test('2u key (Backspace)', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'Backspace')
      await helper.setKeySize(2)
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('basic-2u-key-backspace.png')
    })

    test('2.25u key (Left Shift)', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'Shift')
      await helper.setKeySize(2.25)
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('basic-2-25u-key-shift.png')
    })

    test('6.25u spacebar', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'Space')
      await helper.setKeySize(6.25)
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('basic-6-25u-spacebar.png')
    })

    test('2u tall key (Enter)', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'Enter')
      await helper.setKeySize(1.25, 2)
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('basic-2u-tall-enter.png')
    })

    test('square 2x2 key', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', '+')
      await helper.setKeySize(2, 2)
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('basic-2x2-square-key.png')
    })
  })

  test.describe('Key Colors and Styling', () => {
    test('blue key with white text', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'Ctrl')
      await helper.setKeyColors('#0066cc', '#ffffff')
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('colors-blue-key-white-text.png')
    })

    test('red key with yellow text', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'Esc')
      await helper.setKeyColors('#cc0000', '#ffff00')
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('colors-red-key-yellow-text.png')
    })

    test('dark theme key', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'Alt')
      await helper.setKeyColors('#333333', '#cccccc')
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('colors-dark-theme-key.png')
    })
  })

  test.describe('Key Options', () => {
    test('ghost key', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'Ghost')
      await helper.setKeyOptions({ ghost: true })
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('options-ghost-key.png')
    })

    test('stepped key', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'Caps')
      await helper.setKeySize(1.75)
      await helper.setKeyOptions({ stepped: true })
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('options-stepped-caps.png')
    })

    test('home key with nub', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'F')
      await helper.setKeyOptions({ nub: true })
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('options-home-key-nub.png')
    })

    test('decal key', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'Logo')
      await helper.setKeyOptions({ decal: true })
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('options-decal-key.png')
    })

    test('rotary encoder', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'Volume')
      await helper.setKeyOptions({ rotaryEncoder: true })
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('options-rotary-encoder.png')
    })
  })

  test.describe('Key Rotations', () => {
    test('15 degree rotation', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'R15')
      await helper.setKeyRotation(15)
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('rotations-15-degree-rotation.png')
    })

    test('45 degree rotation', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'R45')
      await helper.setKeyRotation(45)
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('rotations-45-degree-rotation.png')
    })

    test('90 degree rotation', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'R90')
      await helper.setKeyRotation(90)
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('rotations-90-degree-rotation.png')
    })

    test('-45 degree rotation', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'R-45')
      await helper.setKeyRotation(-45)
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('rotations-minus-45-degree-rotation.png')
    })
  })

  test.describe('Complex Labels', () => {
    test('key with HTML bold tag', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', '<b>Bold</b>')
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('labels-html-bold.png')
    })

    test('key with HTML italic tag', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', '<i>Italic</i>')
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('labels-html-italic.png')
    })

    test('key with HTML bold and italic tags', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', '<b><i>Bold Italic</i></b>')
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('labels-html-bold-italic.png')
    })

    test('key with mixed HTML formatting', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', '<b>Bold</b> <i>Italic</i>')
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('labels-html-mixed.png')
    })

    test('key with HTML in multiple label positions', async () => {
      await helper.addKey()
      await helper.setKeyLabel('topCenter', '<b>Shift</b>')
      await helper.setKeyLabel('center', '<i>Home</i>')
      await helper.setKeyLabel('bottomCenter', '<b><i>F1</i></b>')
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('labels-html-multiple-positions.png')
    })

    test('key with image in center label', async () => {
      await helper.addKey()
      const testImage =
        'https://raw.githubusercontent.com/adamws/kle-ng/refs/heads/master/public/data/icons/test.png'
      await helper.setKeyLabel('center', `<img src="${testImage}">`)

      await helper.page.waitForLoadState('networkidle')
      await waitHelpers.waitForQuadAnimationFrame()

      await expect(helper.getCanvas()).toHaveScreenshot('labels-html-image-center.png')
    })

    test('key with image in top-left label', async () => {
      await helper.addKey()
      const testImage =
        'https://raw.githubusercontent.com/adamws/kle-ng/refs/heads/master/public/data/icons/test.png'
      await helper.setKeyLabel('topLeft', `<img src="${testImage}">`)

      await helper.page.waitForLoadState('networkidle')
      await waitHelpers.waitForQuadAnimationFrame()

      await expect(helper.getCanvas()).toHaveScreenshot('labels-html-image-top-left.png')
    })

    test('key with image in bottom-right label', async () => {
      await helper.addKey()
      const testImage =
        'https://raw.githubusercontent.com/adamws/kle-ng/refs/heads/master/public/data/icons/test.png'
      await helper.setKeyLabel('bottomRight', `<img src="${testImage}">`)

      await helper.page.waitForLoadState('networkidle')
      await waitHelpers.waitForQuadAnimationFrame()

      await expect(helper.getCanvas()).toHaveScreenshot('labels-html-image-bottom-right.png')
    })

    test('key with images in multiple positions', async () => {
      await helper.addKey()
      const testImage =
        'https://raw.githubusercontent.com/adamws/kle-ng/refs/heads/master/public/data/icons/test.png'
      await helper.setKeyLabel('topLeft', `<img src="${testImage}">`)
      await helper.setKeyLabel('center', `<img src="${testImage}">`)
      await helper.setKeyLabel('bottomRight', `<img src="${testImage}">`)

      await helper.page.waitForLoadState('networkidle')
      await waitHelpers.waitForQuadAnimationFrame()

      await expect(helper.getCanvas()).toHaveScreenshot('labels-html-image-multiple.png')
    })

    test('key with SVG image in center label', async () => {
      await helper.addKey()
      const testSvg = '/data/icons/test.svg'
      await helper.setKeyLabel('center', `<img src="${testSvg}">`)

      await helper.page.waitForLoadState('networkidle')
      await waitHelpers.waitForAnimationFrames(3)

      await expect(helper.getCanvas()).toHaveScreenshot('labels-html-svg-center.png')
    })

    test('key with SVG image in top-left label', async () => {
      await helper.addKey()
      const testSvg = '/data/icons/test.svg'
      await helper.setKeyLabel('topLeft', `<img src="${testSvg}">`)

      await helper.page.waitForLoadState('networkidle')
      await waitHelpers.waitForAnimationFrames(3)

      await expect(helper.getCanvas()).toHaveScreenshot('labels-html-svg-top-left.png')
    })

    test('key with SVG images in multiple positions', async () => {
      await helper.addKey()
      const testSvg = '/data/icons/test.svg'
      await helper.setKeyLabel('topLeft', `<img src="${testSvg}">`)
      await helper.setKeyLabel('center', `<img src="${testSvg}">`)
      await helper.setKeyLabel('bottomRight', `<img src="${testSvg}">`)

      await helper.page.waitForLoadState('networkidle')
      await waitHelpers.waitForAnimationFrames(3)

      await expect(helper.getCanvas()).toHaveScreenshot('labels-html-svg-multiple.png')
    })

    test('key with inline SVG in center label', async () => {
      await helper.addKey()
      const inlineSvg =
        '<svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><circle cx="16" cy="16" r="12" fill="#FF5722"/><path d="M12 16 L15 19 L20 13" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>'
      await helper.setKeyLabel('center', inlineSvg)

      await helper.waitForRender()
      await waitHelpers.waitForDoubleAnimationFrame()

      await expect(helper.getCanvas()).toHaveScreenshot('labels-html-inline-svg-center.png')
    })

    test('key with inline SVG in top-left label', async () => {
      await helper.addKey()
      const inlineSvg =
        '<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg"><rect width="24" height="24" fill="#2196F3"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="14" font-weight="bold">A</text></svg>'
      await helper.setKeyLabel('topLeft', inlineSvg)

      await helper.waitForRender()
      await waitHelpers.waitForDoubleAnimationFrame()

      await expect(helper.getCanvas()).toHaveScreenshot('labels-html-inline-svg-top-left.png')
    })

    test('key with multiple inline SVGs', async () => {
      await helper.addKey()
      const svgRed =
        '<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#F44336"/></svg>'
      const svgGreen =
        '<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#4CAF50"/></svg>'
      const svgBlue =
        '<svg width="24" height="24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="#2196F3"/></svg>'

      await helper.setKeyLabel('topLeft', svgRed)
      await helper.setKeyLabel('center', svgGreen)
      await helper.setKeyLabel('bottomRight', svgBlue)

      await helper.waitForRender()
      await waitHelpers.waitForDoubleAnimationFrame()

      await expect(helper.getCanvas()).toHaveScreenshot('labels-html-inline-svg-multiple.png')
    })

    test('key with all 9 labels', async () => {
      await helper.addKey()

      await helper.setKeyLabel('topLeft', '!')
      await helper.setKeyLabel('topCenter', '@')
      await helper.setKeyLabel('topRight', '#')
      await helper.setKeyLabel('centerLeft', '$')
      await helper.setKeyLabel('center', '5')
      await helper.setKeyLabel('centerRight', '%')
      await helper.setKeyLabel('bottomLeft', '^')
      await helper.setKeyLabel('bottomCenter', '&')
      await helper.setKeyLabel('bottomRight', '*')

      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('labels-all-9-labels.png')
    })

    test('rotary encoder with all 9 labels', async () => {
      await helper.addKey()

      await helper.setKeyLabel('topLeft', 'A')
      await helper.setKeyLabel('topCenter', 'B')
      await helper.setKeyLabel('topRight', 'C')
      await helper.setKeyLabel('centerLeft', 'D')
      await helper.setKeyLabel('center', 'E')
      await helper.setKeyLabel('centerRight', 'F')
      await helper.setKeyLabel('bottomLeft', 'G')
      await helper.setKeyLabel('bottomCenter', 'H')
      await helper.setKeyLabel('bottomRight', 'I')

      await helper.setKeyOptions({ rotaryEncoder: true })

      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('labels-rotary-encoder-all-9-labels.png')
    })

    test('function key with dual labels', async () => {
      await helper.addKey()
      await helper.setKeyLabel('topCenter', 'F1')
      await helper.setKeyLabel('center', '!')
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('labels-f1-dual-label.png')
    })

    test('modifier key', async () => {
      await helper.addKey()
      await helper.setKeyLabel('center', 'Ctrl')
      await helper.setKeySize(1.25)
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('labels-ctrl-modifier.png')
    })

    test('key with per-label text sizes and colors', async () => {
      await helper.addKey()

      await helper.setKeyLabel('topLeft', '!')
      await helper.setKeyLabel('topCenter', '@')
      await helper.setKeyLabel('centerLeft', '$')
      await helper.setKeyLabel('center', '5')
      await helper.setKeyLabel('centerRight', '%')
      await helper.setKeyLabel('bottomLeft', 'A')
      await helper.setKeyLabel('bottomRight', 'B')

      const frontLabelInputs = helper.page.locator('.labels-grid .form-control')
      const frontInputsCount = await frontLabelInputs.count()

      if (frontInputsCount >= 12) {
        await frontLabelInputs.nth(9).fill('F1')
        await frontLabelInputs.nth(10).fill('F2')
        await frontLabelInputs.nth(11).fill('F3')
      }

      await helper.setDefaultTextSize(3)
      await helper.setLabelTextSize('topLeft', 2)
      await helper.setLabelTextSize('topCenter', 5)
      await helper.setLabelTextSize('centerLeft', 4)
      await helper.setLabelTextSize('center', 6)
      await helper.setLabelTextSize('centerRight', 8)
      await helper.setLabelTextSize('bottomLeft', 3)
      await helper.setLabelTextSize('bottomRight', 9)

      await helper.setLabelColor('topLeft', '#ff0000')
      await helper.setLabelColor('topCenter', '#00ff00')
      await helper.setLabelColor('center', '#0000ff')
      await helper.setLabelColor('centerRight', '#ff8800')
      await helper.setLabelColor('bottomRight', '#8800ff')

      const frontColorPickers = helper.page.locator('.labels-grid .label-color-picker')
      const frontColorPickersCount = await frontColorPickers.count()

      if (frontColorPickersCount >= 12) {
        await frontColorPickers.nth(9).click()
        await helper.page.locator('.color-picker-popup').waitFor({ state: 'visible' })
        await helper.page
          .locator('.color-picker-popup input[placeholder="000000"]')
          .first()
          .fill('00ffff')
        await helper.page.locator('.color-picker-popup .btn-primary').click()
        await helper.page.locator('.color-picker-popup').waitFor({ state: 'hidden' })

        await frontColorPickers.nth(10).click()
        await helper.page.locator('.color-picker-popup').waitFor({ state: 'visible' })
        await helper.page
          .locator('.color-picker-popup input[placeholder="000000"]')
          .first()
          .fill('ff00ff')
        await helper.page.locator('.color-picker-popup .btn-primary').click()
        await helper.page.locator('.color-picker-popup').waitFor({ state: 'hidden' })
      }

      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot('labels-per-label-text-sizes-colors.png')
    })

    test('Delete label on 1x1 key without wrapping', async () => {
      await helper.addKey()
      await helper.setKeyLabel('topLeft', 'Delete')
      await waitHelpers.waitForDoubleAnimationFrame()

      await expect(helper.getCanvas()).toHaveScreenshot('labels-delete-label-1x1-key.png')
    })

    test('key with complex multiline label (bold, italic, and link)', async () => {
      await helper.addKey()
      await helper.setKeySize(2, 2)
      await helper.setKeyLabel(
        'center',
        'Bold: <b>Title</b><br>Italics: <i>Subtitle</i><br>Link: <a href="https://example.com">Link</a>',
      )
      await helper.waitForRender()

      await expect(helper.getCanvas()).toHaveScreenshot(
        'labels-complex-multiline-bold-italic-link.png',
      )
    })

    test.describe('Clickable Links', () => {
      // P0: Simple link in center label (visual test)
      test('simple link in center label', async () => {
        await helper.addKey()
        await helper.setKeyLabel('center', '<a href="https://example.com">Click</a>')
        await helper.waitForRender()
        await expect(helper.getCanvas()).toHaveScreenshot('labels-link-simple-center.png')
      })

      // P0: Clicking link opens in new tab
      test('clicking link opens in new tab', async () => {
        const windowOpenCalls: { url: string; target: string; features: string }[] = []
        await helper.page.exposeFunction(
          'mockWindowOpen',
          (url: string, target: string, features: string) => {
            windowOpenCalls.push({ url, target, features })
          },
        )
        await helper.page.evaluate(() => {
          window.open = (url?: string | URL, target?: string, features?: string) => {
            ;(window as unknown as { mockWindowOpen: typeof window.open }).mockWindowOpen(
              url as string,
              target as string,
              features as string,
            )
            return null
          }
        })

        await helper.addKey()
        await helper.setKeyLabel('center', '<a href="https://example.com">Click</a>')
        await helper.waitForRender()

        const canvas = helper.getCanvas()
        const box = await canvas.boundingBox()
        // Click center of canvas where link text is
        await canvas.click({ position: { x: box!.width / 2, y: box!.height / 2 } })

        await helper.page.waitForTimeout(100)
        // URL gets normalized with trailing slash
        expect(windowOpenCalls[0]?.url).toBe('https://example.com/')
        expect(windowOpenCalls[0]?.target).toBe('_blank')
        expect(windowOpenCalls[0]?.features).toBe('noopener,noreferrer')
      })

      // P0: JavaScript protocol is blocked
      test('javascript protocol is blocked for security', async () => {
        const windowOpenCalls: string[] = []
        const consoleWarnings: string[][] = []

        await helper.page.exposeFunction('mockWindowOpen', (url: string) => {
          windowOpenCalls.push(url)
        })
        await helper.page.exposeFunction('mockConsoleWarn', (...args: string[]) => {
          consoleWarnings.push(args)
        })

        await helper.page.evaluate(() => {
          window.open = (url?: string | URL) => {
            ;(window as unknown as { mockWindowOpen: (url: string) => void }).mockWindowOpen(
              url as string,
            )
            return null
          }
          const originalWarn = console.warn
          console.warn = (...args: unknown[]) => {
            ;(
              window as unknown as { mockConsoleWarn: (...args: string[]) => void }
            ).mockConsoleWarn(...(args as string[]))
            originalWarn(...args)
          }
        })

        await helper.addKey()
        await helper.setKeyLabel('center', '<a href="javascript:alert(\'xss\')">Bad</a>')
        await helper.waitForRender()

        const canvas = helper.getCanvas()
        const box = await canvas.boundingBox()
        // Click center of canvas where link text is
        await canvas.click({ position: { x: box!.width / 2, y: box!.height / 2 } })

        await helper.page.waitForTimeout(100)
        expect(windowOpenCalls).toHaveLength(0)
        expect(consoleWarnings.some((w) => w.some((s) => s.includes('Invalid URL protocol')))).toBe(
          true,
        )
      })

      // P1: Link in different label positions
      test('link in different label positions', async () => {
        await helper.addKey()
        await helper.setKeyLabel('topLeft', '<a href="https://example.com/1">AB</a>')
        await helper.setKeyLabel('center', '<a href="https://example.com/2">CD</a>')
        await helper.setKeyLabel('bottomRight', '<a href="https://example.com/3">EF</a>')
        await helper.waitForRender()
        await expect(helper.getCanvas()).toHaveScreenshot('labels-link-multiple-positions.png')
      })

      // P1: Bold link
      test('bold link', async () => {
        await helper.addKey()
        await helper.setKeyLabel('center', '<b><a href="https://example.com">Click</a></b>')
        await helper.waitForRender()
        await expect(helper.getCanvas()).toHaveScreenshot('labels-link-bold.png')
      })

      // P1: Italic link
      test('italic link', async () => {
        await helper.addKey()
        await helper.setKeyLabel('center', '<i><a href="https://example.com">Click</a></i>')
        await helper.waitForRender()
        await expect(helper.getCanvas()).toHaveScreenshot('labels-link-italic.png')
      })

      // P1: HTTP URL is allowed
      test('http URL is allowed', async () => {
        const windowOpenCalls: { url: string; target: string; features: string }[] = []
        await helper.page.exposeFunction(
          'mockWindowOpenHttp',
          (url: string, target: string, features: string) => {
            windowOpenCalls.push({ url, target, features })
          },
        )
        await helper.page.evaluate(() => {
          window.open = (url?: string | URL, target?: string, features?: string) => {
            ;(window as unknown as { mockWindowOpenHttp: typeof window.open }).mockWindowOpenHttp(
              url as string,
              target as string,
              features as string,
            )
            return null
          }
        })

        await helper.addKey()
        // Use short link text like the passing test
        await helper.setKeyLabel('center', '<a href="http://example.com">Click</a>')
        await helper.waitForRender()

        const canvas = helper.getCanvas()
        const box = await canvas.boundingBox()
        // Click center of canvas where link text is
        await canvas.click({ position: { x: box!.width / 2, y: box!.height / 2 } })

        await helper.page.waitForTimeout(100)
        // URL gets normalized with trailing slash
        expect(windowOpenCalls[0]?.url).toBe('http://example.com/')
      })

      // P1: HTTPS URL is allowed
      test('https URL is allowed', async () => {
        const windowOpenCalls: { url: string; target: string; features: string }[] = []
        await helper.page.exposeFunction(
          'mockWindowOpenHttps',
          (url: string, target: string, features: string) => {
            windowOpenCalls.push({ url, target, features })
          },
        )
        await helper.page.evaluate(() => {
          window.open = (url?: string | URL, target?: string, features?: string) => {
            ;(window as unknown as { mockWindowOpenHttps: typeof window.open }).mockWindowOpenHttps(
              url as string,
              target as string,
              features as string,
            )
            return null
          }
        })

        await helper.addKey()
        // Use exact same link text as the passing "clicking link opens" test
        await helper.setKeyLabel('center', '<a href="https://example.com">Click</a>')
        await helper.waitForRender()

        const canvas = helper.getCanvas()
        const box = await canvas.boundingBox()
        // Click center of canvas where link text is
        await canvas.click({ position: { x: box!.width / 2, y: box!.height / 2 } })

        await helper.page.waitForTimeout(100)
        // URL gets normalized with trailing slash
        expect(windowOpenCalls[0]?.url).toBe('https://example.com/')
      })
    })
  })

  test.describe('Non-Rectangular Keys', () => {
    test('should render big-ass-enter key correctly', async () => {
      await helper.loadBigAssEnterLayout()
      await helper.expectKeysCount(1)
      await expect(helper.getCanvas()).toHaveScreenshot('non-rectangular-big-ass-enter-key.png')
    })

    test('should render ISO enter key correctly', async () => {
      await helper.loadISOEnterLayout()
      await helper.expectKeysCount(1)
      await expect(helper.getCanvas()).toHaveScreenshot('non-rectangular-iso-enter-key.png')
    })

    test('should render custom non-rectangular key', async () => {
      await helper.loadCustomJLayout()
      await helper.expectKeysCount(1)
      await expect(helper.getCanvas()).toHaveScreenshot(
        'non-rectangular-custom-non-rectangular-key.png',
      )
    })

    test('should handle non-rectangular key selection properly', async () => {
      await helper.loadBigAssEnterLayout()
      await helper.expectKeysCount(1)

      await helper.selectBigAssEnterKey()
      await helper.expectPropertiesPanelVisible()

      await expect(helper.getCanvas()).toHaveScreenshot(
        'non-rectangular-big-ass-enter-selected.png',
      )
    })

    test('should render multiple non-rectangular keys in same layout', async () => {
      await helper.loadMixedNonRectangularLayout()
      await expect(helper.getCanvas()).toHaveScreenshot(
        'non-rectangular-mixed-non-rectangular-keys.png',
      )
    })

    test('should render non-rectangular keys with custom colors', async () => {
      await helper.loadColoredBigAssEnterLayout()
      await helper.expectKeysCount(1)
      await expect(helper.getCanvas()).toHaveScreenshot('non-rectangular-big-ass-enter-colored.png')
    })
  })

  test.describe('Lists', () => {
    test.describe('Basic Lists', () => {
      test('simple unordered list', async () => {
        await helper.addKey()
        await helper.setKeySize(2, 2)
        await helper.setKeyLabel(
          'topLeft',
          '<ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul>',
        )
        await helper.waitForRender()
        await expect(helper.getCanvas()).toHaveScreenshot('labels-list-unordered.png')
      })

      test('simple ordered list', async () => {
        await helper.addKey()
        await helper.setKeySize(2, 2)
        await helper.setKeyLabel('topLeft', '<ol><li>First</li><li>Second</li><li>Third</li></ol>')
        await helper.waitForRender()
        await expect(helper.getCanvas()).toHaveScreenshot('labels-list-ordered.png')
      })
    })

    test.describe('Lists with Formatting', () => {
      test('list with bold items', async () => {
        await helper.addKey()
        await helper.setKeySize(2, 2)
        await helper.setKeyLabel(
          'topLeft',
          '<ul><li><b>Bold Item</b></li><li>Normal Item</li></ul>',
        )
        await helper.waitForRender()
        await expect(helper.getCanvas()).toHaveScreenshot('labels-list-bold.png')
      })

      test('list with italic items', async () => {
        await helper.addKey()
        await helper.setKeySize(2, 2)
        await helper.setKeyLabel(
          'topLeft',
          '<ul><li><i>Italic Item</i></li><li>Normal Item</li></ul>',
        )
        await helper.waitForRender()
        await expect(helper.getCanvas()).toHaveScreenshot('labels-list-italic.png')
      })

      test('list with links', async () => {
        await helper.addKey()
        await helper.setKeySize(2, 2)
        await helper.setKeyLabel(
          'topLeft',
          '<ul><li><a href="https://example.com">Link Item</a></li></ul>',
        )
        await helper.waitForRender()
        await expect(helper.getCanvas()).toHaveScreenshot('labels-list-with-link.png')
      })
    })

    test.describe('Nested Lists', () => {
      test('two-level nested unordered list', async () => {
        await helper.addKey()
        await helper.setKeySize(3, 3)
        await helper.setKeyLabel(
          'topLeft',
          '<ul><li>Parent 1<ul><li>Child 1.1</li><li>Child 1.2</li></ul></li><li>Parent 2</li></ul>',
        )
        await helper.waitForRender()
        await expect(helper.getCanvas()).toHaveScreenshot('labels-list-nested-ul.png')
      })

      test('mixed nested list (ol containing ul)', async () => {
        await helper.addKey()
        await helper.setKeySize(3, 3)
        await helper.setKeyLabel(
          'topLeft',
          '<ol><li>First<ul><li>Bullet A</li><li>Bullet B</li></ul></li><li>Second</li></ol>',
        )
        await helper.waitForRender()
        await expect(helper.getCanvas()).toHaveScreenshot('labels-list-nested-mixed.png')
      })
    })

    test.describe('List Alignment', () => {
      test('list in left-aligned position', async () => {
        await helper.addKey()
        await helper.setKeySize(2, 2)
        await helper.setKeyLabel('topLeft', '<ul><li>Left</li><li>Aligned</li></ul>')
        await helper.waitForRender()
        await expect(helper.getCanvas()).toHaveScreenshot('labels-list-align-left.png')
      })

      test('list in center-aligned position', async () => {
        await helper.addKey()
        await helper.setKeySize(2, 2)
        await helper.setKeyLabel('topCenter', '<ul><li>Center</li><li>Aligned</li></ul>')
        await helper.waitForRender()
        await expect(helper.getCanvas()).toHaveScreenshot('labels-list-align-center.png')
      })

      test('list in right-aligned position', async () => {
        await helper.addKey()
        await helper.setKeySize(2, 2)
        await helper.setKeyLabel('topRight', '<ul><li>Right</li><li>Aligned</li></ul>')
        await helper.waitForRender()
        await expect(helper.getCanvas()).toHaveScreenshot('labels-list-align-right.png')
      })
    })

    test.describe('List Edge Cases', () => {
      test('list on rotated key', async () => {
        await helper.addKey()
        await helper.setKeySize(2, 2)
        await helper.setKeyRotation(45)
        await helper.setKeyLabel('topLeft', '<ul><li>Rotated</li><li>List</li></ul>')
        await helper.waitForRender()
        await expect(helper.getCanvas()).toHaveScreenshot('labels-list-rotated.png')
      })

      test('list on small key (overflow handling)', async () => {
        await helper.addKey()
        await helper.setKeyLabel('topLeft', '<ul><li>LongWord</li><li>AnotherLongWord</li></ul>')
        await helper.waitForRender()
        await expect(helper.getCanvas()).toHaveScreenshot('labels-list-small-key.png')
      })

      test('complex multiline with list', async () => {
        await helper.addKey()
        await helper.setKeySize(2, 2)
        await helper.setKeyLabel(
          'topLeft',
          'Introduction<br><ul><li>First point</li><li>Second point</li></ul>Conclusion text here.',
        )
        await helper.waitForRender()
        await expect(helper.getCanvas()).toHaveScreenshot('labels-list-complex-multiline.png')
      })
    })
  })
})
