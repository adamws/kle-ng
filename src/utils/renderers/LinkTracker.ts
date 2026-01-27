/**
 * LinkTracker - Tracks clickable link bounding boxes during label rendering
 *
 * Since canvas has no native link support, we need to:
 * 1. Register link bounding boxes during rendering
 * 2. Provide hit testing with rotation support for click detection
 *
 * The tracker stores link positions in the key's local coordinate space,
 * along with rotation information to properly transform hit test coordinates.
 */

export interface LinkBoundingBox {
  /** Unique identifier for this link */
  id: string
  /** URL to open when clicked */
  href: string
  /** Link text (for debugging) */
  displayText: string
  /** X position in key's coordinate space */
  localX: number
  /** Y position in key's coordinate space (top of bounding box) */
  localY: number
  /** Width of bounding box */
  localWidth: number
  /** Height of bounding box */
  localHeight: number
  /** Key's rotation angle in degrees */
  rotationAngle: number
  /** Rotation origin X in canvas coordinates */
  rotationOriginX: number
  /** Rotation origin Y in canvas coordinates */
  rotationOriginY: number
}

export class LinkTracker {
  private links: LinkBoundingBox[] = []
  private nextId = 0

  /**
   * Clear all tracked links. Call at the start of each render.
   */
  public clear(): void {
    this.links = []
    this.nextId = 0
  }

  /**
   * Register a link during rendering
   *
   * @param href - URL to open when clicked
   * @param displayText - The visible link text
   * @param localX - X position in key's local coordinate space
   * @param localY - Y position (top of bounding box) in key's local coordinate space
   * @param localWidth - Width of the bounding box
   * @param localHeight - Height of the bounding box (typically font size)
   * @param rotationAngle - Key's rotation angle in degrees
   * @param rotationOriginX - Rotation origin X in canvas coordinates
   * @param rotationOriginY - Rotation origin Y in canvas coordinates
   */
  public registerLink(
    href: string,
    displayText: string,
    localX: number,
    localY: number,
    localWidth: number,
    localHeight: number,
    rotationAngle: number,
    rotationOriginX: number,
    rotationOriginY: number,
  ): void {
    this.links.push({
      id: `link-${this.nextId++}`,
      href,
      displayText,
      localX,
      localY,
      localWidth,
      localHeight,
      rotationAngle,
      rotationOriginX,
      rotationOriginY,
    })
  }

  /**
   * Get the link at a canvas position, handling rotation transformation
   *
   * For rotated keys, applies inverse rotation to the test point
   * (same pattern as HitTester.ts).
   *
   * @param canvasX - X coordinate in canvas pixels
   * @param canvasY - Y coordinate in canvas pixels
   * @returns The link at this position, or null if none
   */
  public getLinkAtPosition(canvasX: number, canvasY: number): LinkBoundingBox | null {
    // Check links in reverse order (last registered is on top)
    for (let i = this.links.length - 1; i >= 0; i--) {
      const link = this.links[i]
      if (!link) continue

      let testX = canvasX
      let testY = canvasY

      // If the link's key is rotated, apply inverse rotation to test coordinates
      if (link.rotationAngle) {
        const angle = (-link.rotationAngle * Math.PI) / 180 // Inverse rotation
        const originX = link.rotationOriginX
        const originY = link.rotationOriginY

        // Translate to origin
        const translatedX = canvasX - originX
        const translatedY = canvasY - originY

        // Apply inverse rotation
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        testX = translatedX * cos - translatedY * sin + originX
        testY = translatedX * sin + translatedY * cos + originY
      }

      // Test if point is inside link bounding box
      if (
        testX >= link.localX &&
        testX <= link.localX + link.localWidth &&
        testY >= link.localY &&
        testY <= link.localY + link.localHeight
      ) {
        return link
      }
    }

    return null
  }

  /**
   * Get all registered links (for debugging)
   */
  public getLinks(): readonly LinkBoundingBox[] {
    return this.links
  }

  /**
   * Get the number of registered links
   */
  public get count(): number {
    return this.links.length
  }
}

/**
 * Singleton instance for global use
 */
export const linkTracker = new LinkTracker()
