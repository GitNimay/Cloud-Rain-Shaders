import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SegmentedField, SliderField, SwatchField } from '../components/controls'
import { ExportPanel } from '../components/export-panel'
import { SheenPillButton } from '../components/sheen-pill-button'
import { ThemeToggle } from '../components/theme-toggle'
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
    // Full screen on the canvas colour. From tablet width up, the animation takes all the room the
    // settings rail leaves. On phones they stack, and the animation stays pinned at the top while
    // the settings scroll under it, so every change can be seen as it is made.
    <main className="grid min-h-dvh grid-cols-[minmax(0,1fr)] md:h-dvh md:grid-cols-[minmax(0,1fr)_16.5rem]">
      <div className="sticky top-0 z-10 bg-bg-canvas px-3 pt-[max(12px,env(safe-area-inset-top))] pb-3 md:static md:min-h-0 md:p-4">
        <iframe
          ref={frame}
          src="/ascii-shedders/cloud-rain.html"
          title="Cloud rain ASCII animation"
          onLoad={send}
          className="block aspect-video w-full border-0 md:aspect-auto md:h-full"
        />
      </div>

      <aside className="flex min-w-0 flex-col border-t border-line md:min-h-0 md:border-t-0 md:border-l">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-line px-4">
          <h1 className="text-body-small-medium text-text-primary">ASCII Cloud Rain</h1>
          <ThemeToggle />
        </header>

        {/* relative: keeps absolutely positioned bits (the export status for screen readers) inside the scroller */}
        <div className="relative flex flex-col md:min-h-0 md:overflow-y-auto">
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

          <Section title="Export">
            <ExportPanel params={params} getCanvas={() => frame.current?.contentDocument?.querySelector('canvas') ?? null} />
          </Section>
        </div>

        <footer className="mt-auto flex min-h-12 shrink-0 items-center justify-between gap-3 border-t border-line px-4 pt-2 pb-[max(8px,env(safe-area-inset-bottom))]">
          {/* Double-click is a mouse gesture, so the hint is only shown where there is one. */}
          <span className="text-body-micro-regular text-text-tertiary pointer-coarse:invisible">Double-click a slider to reset it</span>
          <SheenPillButton disabled={isDefault} onClick={() => set(DEFAULTS)} height={26} className="pointer-coarse:!h-10">
            Reset all
          </SheenPillButton>
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
