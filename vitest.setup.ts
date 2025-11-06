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
