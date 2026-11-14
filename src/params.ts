import { z } from 'zod'

// The six parameters. Ranges must stay inside the limits the shader itself enforces
// (LIMITS in public/ascii-shedders/cloud-rain.html); it clamps anything outside them.
export const SLIDERS = [
  { key: 'cell', label: 'Cell size', min: 4, max: 16, step: 1, fallback: 6, format: (v: number) => `${v} px` },
  { key: 'speed', label: 'Rain speed', min: 1, max: 30, step: 1, fallback: 6, format: (v: number) => `${v} cells/s` },
  { key: 'density', label: 'Rain density', min: 0, max: 1, step: 0.05, fallback: 0.8, format: (v: number) => `${Math.round(v * 100)}%` },
  { key: 'trail', label: 'Trail length', min: 2, max: 40, step: 1, fallback: 18, format: (v: number) => `${v} cells` },
  { key: 'contrast', label: 'Contrast', min: 0.6, max: 1.8, step: 0.02, fallback: 1.14, format: (v: number) => v.toFixed(2) },
] as const

export const GLYPH_SETS = [
  { value: 'digits', label: 'Digits' },
  { value: 'binary', label: 'Binary' },
  { value: 'hex', label: 'Hex' },
  { value: 'symbols', label: 'Symbols' },
] as const

const glyphValues = GLYPH_SETS.map((g) => g.value) as [GlyphSet, ...GlyphSet[]]
export type GlyphSet = (typeof GLYPH_SETS)[number]['value']
export type SliderKey = (typeof SLIDERS)[number]['key']
export type Params = Record<SliderKey, number> & { glyphs: GlyphSet }

export const DEFAULTS: Params = {
  ...(Object.fromEntries(SLIDERS.map((s) => [s.key, s.fallback])) as Record<SliderKey, number>),
  glyphs: 'digits',
}

// A hand-edited or stale URL falls back to the default for that field instead of erroring.
const slider = (key: SliderKey) => {
  const s = SLIDERS.find((x) => x.key === key)!
  return z.number().min(s.min).max(s.max).default(s.fallback).catch(s.fallback)
}

export const paramsSchema = z.object({
  cell: slider('cell'),
  speed: slider('speed'),
  density: slider('density'),
  trail: slider('trail'),
  contrast: slider('contrast'),
  glyphs: z.enum(glyphValues).default('digits').catch('digits'),
})
