import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SegmentedField, SliderField, SwatchField } from '../components/controls'
import { DEFAULTS, EFFECTS, GLYPH_SETS, SLIDERS, paramsSchema, type Effect, type Params } from '../params'

// The settings live in the URL: validated on the way in, defaults stripped on the way out,
// so a tuned look can be bookmarked or shared as a link.
export const Route = createFileRoute('/')({
  validateSearch: paramsSchema,
  search: { middlewares: [stripSearchParams(DEFAULTS)] },
  component: Editor,
})

function Editor() {
  const params = Route.useSearch()
  const navigate = Route.useNavigate()
  const frame = useRef<HTMLIFrameElement>(null)

  // The shader is a standalone page; it takes setting updates by postMessage.
  const send = () => frame.current?.contentWindow?.postMessage(params, window.location.origin)
  useEffect(send)

  // It sends back a small still of each colour effect once it has loaded, for the swatches.
  const [thumbs, setThumbs] = useState<Partial<Record<Effect, string>>>({})
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.source === frame.current?.contentWindow && e.data?.type === 'thumbs')
        setThumbs(e.data.thumbs)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const set = (patch: Partial<Params>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true, resetScroll: false })
  const isDefault = (Object.keys(DEFAULTS) as Array<keyof Params>).every((k) => params[k] === DEFAULTS[k])

  return (
    // Full screen on the canvas colour: the animation takes all the room the settings rail leaves.
    <main className="grid min-h-dvh lg:h-dvh lg:grid-cols-[minmax(0,1fr)_16.5rem]">
      <div className="p-4 lg:min-h-0">
        <iframe
          ref={frame}
          src="/ascii-shedders/cloud-rain.html"
          title="Cloud rain ASCII animation"
          onLoad={send}
          className="block aspect-video w-full border-0 lg:aspect-auto lg:h-full"
        />
      </div>

      <aside className="flex flex-col border-t border-line lg:min-h-0 lg:border-t-0 lg:border-l">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
          <h1 className="text-body-small-medium text-text-primary">ASCII Shedders</h1>
          <span className="text-body-mini-regular text-text-tertiary">cloud-rain</span>
        </header>

        <div className="flex flex-col lg:min-h-0 lg:overflow-y-auto">
          <Section title="Color effect">
            <SwatchField
              label="Color effect"
              value={params.effect}
              options={EFFECTS}
              images={thumbs}
              onChange={(effect) => set({ effect })}
            />
          </Section>

          <Section title="Parameters">
            <SegmentedField label="Character set" value={params.glyphs} options={GLYPH_SETS} onChange={(glyphs) => set({ glyphs })} />
            <div className="flex flex-col gap-1.5">
              {SLIDERS.map((s) => (
                <SliderField
                  key={s.key}
                  label={s.label}
                  value={params[s.key]}
                  display={s.format(params[s.key])}
                  min={s.min}
                  max={s.max}
                  step={s.step}
                  defaultValue={s.fallback}
                  onChange={(v) => set({ [s.key]: v })}
                />
              ))}
            </div>
          </Section>
        </div>

        <footer className="mt-auto flex h-12 shrink-0 items-center justify-between border-t border-line px-4">
          <span className="text-body-micro-regular text-text-tertiary">Double-click a slider to reset it</span>
          <button
            type="button"
            disabled={isDefault}
            onClick={() => set(DEFAULTS)}
            className="h-6 rounded-md bg-control-bg px-2 text-body-mini-medium text-text-primary shadow-low outline-none transition-shadow hover:shadow-low-hover focus-visible:shadow-focus disabled:text-text-tertiary disabled:hover:shadow-low"
          >
            Reset all
          </button>
        </footer>
      </aside>
    </main>
  )
}

function Section(props: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-b border-line px-4 pt-3 pb-4">
      <h2 className="text-body-mini-medium text-text-primary">{props.title}</h2>
      {props.children}
    </section>
  )
}
