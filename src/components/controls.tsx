import { Slider, ToggleGroup } from 'radix-ui'
import { useId } from 'react'

// Palermo has no slider, so this one is built the way Palermo builds its controls:
// a Radix primitive styled with the design tokens.
export function SliderField(props: {
  label: string
  value: number
  display: string
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-4">
        <span id={id} className="text-body-small-medium text-text-primary">
          {props.label}
        </span>
        <output className="text-body-small-regular text-text-secondary tabular-nums">{props.display}</output>
      </div>
      <Slider.Root
        className="relative flex h-5 touch-none items-center select-none"
        value={[props.value]}
        min={props.min}
        max={props.max}
        step={props.step}
        onValueChange={([v]) => props.onChange(v)}
      >
        <Slider.Track className="relative h-1 grow rounded-full bg-fill-tertiary">
          <Slider.Range className="absolute h-full rounded-full bg-fill-primary" />
        </Slider.Track>
        <Slider.Thumb
          aria-labelledby={id}
          aria-valuetext={props.display}
          className="block size-4 rounded-full bg-fill-inverse shadow-medium outline-none transition-shadow hover:shadow-low-hover focus-visible:shadow-focus"
        />
      </Slider.Root>
    </div>
  )
}

// A row of fixed presets, each shown as a colour swatch with its name underneath.
export function SwatchField<T extends string>(props: {
  label: string
  value: T
  options: ReadonlyArray<{ value: T; label: string; swatch: readonly [string, string, string] }>
  onChange: (value: T) => void
}) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={props.label}
      value={props.value}
      onValueChange={(v) => v && props.onChange(v as T)}
      className="grid auto-cols-fr grid-flow-col gap-2"
    >
      {props.options.map((o) => (
        <ToggleGroup.Item
          key={o.value}
          value={o.value}
          className="group flex flex-col items-center gap-2 rounded-lg text-body-mini-regular text-text-secondary outline-none hover:text-text-primary data-[state=on]:text-text-primary"
        >
          <span
            aria-hidden
            className="block h-10 w-full rounded-lg transition-shadow group-focus-visible:shadow-focus group-data-[state=on]:shadow-selected"
            style={{ background: `linear-gradient(165deg, ${o.swatch[0]}, ${o.swatch[1]} 60%, ${o.swatch[2]})` }}
          />
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}

export function SegmentedField<T extends string>(props: {
  label: string
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <span id={id} className="text-body-small-medium text-text-primary">
        {props.label}
      </span>
      <ToggleGroup.Root
        type="single"
        aria-labelledby={id}
        value={props.value}
        // Radix sends '' when the active item is pressed again; one option must stay selected.
        onValueChange={(v) => v && props.onChange(v as T)}
        className="grid auto-cols-fr grid-flow-col gap-0.5 rounded-lg bg-fill-tertiary/50 p-0.5"
      >
        {props.options.map((o) => (
          <ToggleGroup.Item
            key={o.value}
            value={o.value}
            className="h-7 rounded-md text-body-small-medium text-text-secondary outline-none transition-colors hover:text-text-primary focus-visible:shadow-focus data-[state=on]:bg-control-bg data-[state=on]:text-text-primary data-[state=on]:shadow-low"
          >
            {o.label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
    </div>
  )
}
