const RECENTLY_USED_COLORS_KEY = 'kle-ng-recently-used-colors'
const MAX_RECENTLY_USED_COLORS = 12

export interface RecentlyUsedColorsManager {
  getRecentlyUsedColors(): string[]
  addColor(color: string): void
  clear(): void
}

class RecentlyUsedColorsManagerImpl implements RecentlyUsedColorsManager {
  getRecentlyUsedColors(): string[] {
    try {
      const stored = localStorage.getItem(RECENTLY_USED_COLORS_KEY)
      if (stored) {
        const colors = JSON.parse(stored)
        return Array.isArray(colors) ? colors.slice(0, MAX_RECENTLY_USED_COLORS) : []
      }
    } catch (error) {
      console.warn('Failed to load recently used colors from localStorage:', error)
    }
    return []
  }

  addColor(color: string): void {
    if (!color || !color.startsWith('#')) {
      return
    }

    const normalizedColor = color.toLowerCase()
    const colors = this.getRecentlyUsedColors()

    // Remove color if it already exists
    const filteredColors = colors.filter((c) => c.toLowerCase() !== normalizedColor)

    // Add to beginning and limit to MAX_RECENTLY_USED_COLORS
    const updatedColors = [normalizedColor, ...filteredColors].slice(0, MAX_RECENTLY_USED_COLORS)

    try {
      localStorage.setItem(RECENTLY_USED_COLORS_KEY, JSON.stringify(updatedColors))
    } catch (error) {
      console.warn('Failed to save recently used colors to localStorage:', error)
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(RECENTLY_USED_COLORS_KEY)
    } catch (error) {
      console.warn('Failed to clear recently used colors from localStorage:', error)
    }
  }
}

// Create singleton instance
export const recentlyUsedColorsManager: RecentlyUsedColorsManager =
  new RecentlyUsedColorsManagerImpl()
