// Mock matchMedia for tests; jsdom does not implement it, and useTheme() queries
// prefers-color-scheme as soon as any component using it mounts.
globalThis.matchMedia =
  globalThis.matchMedia ||
  ((query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList)

// Mock ResizeObserver for tests
globalThis.ResizeObserver = class ResizeObserver implements ResizeObserver {
  observe(): void {
    // Mock observe method
  }
  unobserve(): void {
    // Mock unobserve method
  }
  disconnect(): void {
    // Mock disconnect method
  }
}
