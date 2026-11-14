import { z } from 'zod'

// The six parameters. Ranges must stay inside the limits the shader itself enforces
// (LIMITS in public/ascii-shedders/cloud-rain.js); it clamps anything outside them.
export const SLIDERS = [
  { key: 'cell', label: 'Cell size', min: 4, max: 16, step: 1, fallback: 4, format: (v: number) => `${v} px` },
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

// Colour effects are fixed presets defined by the shader (EFFECTS in cloud-rain.html); the app
// only picks one. `swatch` is a preview of the look: sky top, sky horizon, cloud highlight.
export const EFFECTS = [
  { value: 'original', label: 'Original', swatch: ['#0c24f1', '#3353e8', '#ffffff'] },
  { value: 'evening', label: 'Evening', swatch: ['#2c1a68', '#ff7846', '#ffd498'] },
  { value: 'autumn', label: 'Autumn', swatch: ['#14465a', '#d67c36', '#ffeecc'] },
  { value: 'candy', label: 'Candy', swatch: ['#ff74be', '#74bcff', '#ffffff'] },
  { value: 'midnight', label: 'Midnight', swatch: ['#040828', '#1e2e70', '#ced8ff'] },
] as const

const glyphValues = GLYPH_SETS.map((g) => g.value) as [GlyphSet, ...GlyphSet[]]
const effectValues = EFFECTS.map((e) => e.value) as [Effect, ...Effect[]]
export type GlyphSet = (typeof GLYPH_SETS)[number]['value']
export type Effect = (typeof EFFECTS)[number]['value']
export type SliderKey = (typeof SLIDERS)[number]['key']
export type Params = Record<SliderKey, number> & { glyphs: GlyphSet; effect: Effect }

// The defaults: what Reset returns to, and what the URL leaves out.
export const DEFAULTS: Params = {
  ...(Object.fromEntries(SLIDERS.map((s) => [s.key, s.fallback])) as Record<SliderKey, number>),
  glyphs: 'digits',
  effect: 'original',
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
  effect: z.enum(effectValues).default('original').catch('original'),
})
