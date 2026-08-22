declare module 'bootstrap/js/dist/tooltip' {
  class Tooltip {
    constructor(
      element: Element,
      options?: {
        // Bootstrap resolves a function at show time, which keeps a live title
        // reactive without re-creating the instance.
        title?: string | (() => string)
        placement?: 'auto' | 'top' | 'bottom' | 'left' | 'right'
        trigger?: string
        container?: string | Element | false
        customClass?: string
        html?: boolean
      },
    )
    show(): void
    hide(): void
    dispose(): void
    setContent(content: Record<string, string | Element | null>): void
    static getInstance(element: Element): Tooltip | null
  }
  export default Tooltip
}

declare module 'bootstrap/js/dist/toast' {
  class Toast {
    constructor(
      element: Element,
      options?: {
        animation?: boolean
        autohide?: boolean
        delay?: number
      },
    )
    show(): void
    hide(): void
    dispose(): void
    static getInstance(element: Element): Toast | null
  }
  export default Toast
}
