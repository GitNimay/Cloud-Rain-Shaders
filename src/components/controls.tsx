import { Slider, ToggleGroup } from 'radix-ui'
import { useId, useLayoutEffect, useRef, type CSSProperties } from 'react'

// A design-tool style scrubber (the pattern used by Figma, Framer and SmoothUI's Scrubber):
// the whole field is the slider, with the label and value inside it, a tick ruler along the
// bottom and a needle for the thumb. Built on the Radix slider, so pointer, touch and keyboard
// (arrows, Page Up/Down, Home/End) all work. Double-click returns to the default.
export function SliderField(props: {
  label: string
  value: number
  display: string
  min: number
  max: number
  step: number
  defaultValue: number
  onChange: (value: number) => void
}) {
  const id = useId()
  const pct = (v: number) => `${((v - props.min) / (props.max - props.min)) * 100}%`
  return (
    <Slider.Root
      className="group/s relative flex h-8 cursor-ew-resize touch-none items-center rounded-md bg-control-bg shadow-low transition-shadow select-none hover:shadow-low-hover has-[:focus-visible]:shadow-focus"
      value={[props.value]}
      min={props.min}
      max={props.max}
      step={props.step}
      onValueChange={([v]) => props.onChange(v)}
      onDoubleClick={() => props.onChange(props.defaultValue)}
    >
      <Slider.Track className="absolute inset-0 overflow-hidden rounded-md">
        <span aria-hidden className="ticks absolute inset-x-0 bottom-0 h-[7px] text-fill-tertiary" />
        {/* default position, so a nudged value can be found again */}
        <span aria-hidden className="absolute bottom-0 h-[9px] w-px bg-fill-blue" style={{ left: pct(props.defaultValue) }} />
        <Slider.Range className="absolute inset-y-0 bg-fill-primary/[0.03]">
          <span aria-hidden className="ticks absolute inset-x-0 bottom-0 h-[7px] text-fill-primary" />
        </Slider.Range>
      </Slider.Track>

      <span id={id} className="pointer-events-none absolute top-1 left-2.5 text-body-mini-regular text-text-secondary">
        {props.label}
      </span>
      <output className="pointer-events-none absolute top-1 right-2.5 text-body-mini-medium text-text-primary tabular-nums">
        {props.display}
      </output>

      <Slider.Thumb
        aria-labelledby={id}
        aria-valuetext={props.display}
        // Full-height hit area; the visible needle is only the ruler band, so it never cuts through the text.
        className="relative block h-8 w-px outline-none transition-[width] group-active/s:w-0.5 after:absolute after:inset-x-0 after:bottom-0 after:h-3 after:bg-fill-primary before:absolute before:bottom-[7px] before:left-1/2 before:size-[5px] before:-translate-x-1/2 before:bg-fill-primary"
      />
    </Slider.Root>
  )
}

// A segmented control with a Liquid Glass pill (styles in styles.css: .glass-seg, .glass-pill,
// .glass-lens). The pill's left and right edges are two animatable numbers, --a and --b, in
// units of one segment; one animation of them moves the pill and its lens together. When it
// moves, the leading edge races ahead and the trailing edge catches up with a springy overshoot.
export function SegmentedField<T extends string>(props: {
  label: string
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  const id = useId()
  const track = useRef<HTMLDivElement>(null)
  const index = Math.max(0, props.options.findIndex((o) => o.value === props.value))
  const prev = useRef(index)

  useLayoutEffect(() => {
    const el = track.current
    const from = prev.current
    prev.current = index
    if (!el || from === index || matchMedia('(prefers-reduced-motion: reduce)').matches) return
    // Start from wherever the pill is now, so a change mid-slide carries on fluidly.
    const running = el.getAnimations()
    const cs = getComputedStyle(el)
    const a0 = running.length ? parseFloat(cs.getPropertyValue('--a')) : from
    const b0 = running.length ? parseFloat(cs.getPropertyValue('--b')) : from + 1
    running.forEach((a) => a.cancel())
    const lead = 0.8, lag = 0.2, right = index > a0
    el.animate(
      [
        { '--a': `${a0}`, '--b': `${b0}`, easing: 'cubic-bezier(.45,0,.55,1)' },
        {
          '--a': `${a0 + (index - a0) * (right ? lag : lead)}`,
          '--b': `${b0 + (index + 1 - b0) * (right ? lead : lag)}`,
          offset: 0.4,
          easing: 'cubic-bezier(.25,1.45,.45,1)',
        },
        { '--a': `${index}`, '--b': `${index + 1}` },
      ],
      { duration: 380 + 90 * Math.min(3, Math.abs(index - a0)) },
    )
  }, [index])

  return (
    <div className="flex flex-col gap-1.5">
      <span id={id} className="text-body-mini-regular text-text-secondary">
        {props.label}
      </span>
      <div
        ref={track}
        className="glass-seg"
        style={{ '--n': props.options.length, '--a': index, '--b': index + 1 } as CSSProperties}
      >
        <ToggleGroup.Root
          type="single"
          aria-labelledby={id}
          value={props.value}
          // Radix sends '' when the active item is pressed again; one option must stay selected.
          onValueChange={(v) => v && props.onChange(v as T)}
          className="glass-row"
        >
          {props.options.map((o) => (
            <ToggleGroup.Item
              key={o.value}
              value={o.value}
              className="h-6 rounded-[5px] text-body-mini-medium text-text-secondary outline-none transition-colors hover:text-text-primary focus-visible:shadow-focus"
            >
              {o.label}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup.Root>
        <span aria-hidden className="glass-pill" />
        {/* The same labels again, darker and magnified, visible only through the pill: the lens. */}
        <span aria-hidden className="glass-row glass-lens">
          {props.options.map((o) => (
            <span key={o.value}>{o.label}</span>
          ))}
        </span>
      </div>
    </div>
  )
}

// A row of fixed presets, each shown as a preview with its name underneath. The preview is a
// still of the real look when one is supplied, otherwise a gradient of the preset's colours.
export function SwatchField<T extends string>(props: {
  label: string
  value: T
  options: ReadonlyArray<{ value: T; label: string; swatch: readonly [string, string, string] }>
  images?: Partial<Record<T, string>>
  onChange: (value: T) => void
}) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={props.label}
      value={props.value}
      onValueChange={(v) => v && props.onChange(v as T)}
      className="grid grid-cols-5 gap-1.5"
    >
      {props.options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className="group flex flex-col items-center gap-1 text-body-micro-medium text-text-tertiary outline-none hover:text-text-secondary data-[state=on]:text-text-primary"
        >
          <span
            aria-hidden
            className="block h-8 w-full rounded-[4px] shadow-[inset_0_0_0_1px_rgba(0,0,0,.06)] transition-shadow [image-rendering:pixelated] group-focus-visible:shadow-focus group-data-[state=on]:shadow-selected"
            style={{
              background: props.images?.[o.value]
                ? `center / cover url(${props.images[o.value]})`
                : `linear-gradient(165deg, ${o.swatch[0]}, ${o.swatch[1]} 60%, ${o.swatch[2]})`,
            }}
          />
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
