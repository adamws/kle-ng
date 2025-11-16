declare module 'ergogen' {
  export interface ErgogenProcessResults {
    points?: Record<
      string,
      {
        x: number
        y: number
        r?: number
        meta?: {
          width?: number
          height?: number
          padding?: number
          label?: string
          name?: string
          origin?: [number, number]
        }
      }
    >
    // Add other possible result properties as needed
    [key: string]: unknown
  }

  export function process(config: unknown): ErgogenProcessResults

  export default { process }
}
