// gifenc ships no types; these cover the parts used in export.ts.
declare module 'gifenc' {
  type Palette = number[][]
  export function GIFEncoder(): {
    writeFrame(
      index: Uint8Array,
      width: number,
      height: number,
      opts?: { palette?: Palette; delay?: number; transparent?: boolean; transparentIndex?: number; dispose?: number },
    ): void
    finish(): void
    bytes(): Uint8Array<ArrayBuffer>
  }
  export function quantize(rgba: Uint8ClampedArray, maxColors: number): Palette
  export function applyPalette(rgba: Uint8ClampedArray, palette: Palette): Uint8Array
}
