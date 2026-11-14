import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { useEffect, useRef } from 'react'
import { SegmentedField, SliderField } from '../components/controls'
import { DEFAULTS, GLYPH_SETS, SLIDERS, paramsSchema, type Params } from '../params'

// The parameters live in the URL: validated on the way in, defaults stripped on the way out,
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

  // The shader is a standalone page; it takes parameter updates by postMessage.
  const send = () => frame.current?.contentWindow?.postMessage(params, window.location.origin)
  useEffect(send)

  const set = (patch: Partial<Params>) =>
    navigate({ search: (prev) => ({ ...prev, ...patch }), replace: true, resetScroll: false })
  const isDefault = (Object.keys(DEFAULTS) as Array<keyof Params>).every((k) => params[k] === DEFAULTS[k])

  return (
    <main className="flex min-h-dvh items-center justify-center p-4 sm:p-8">
      <div className="grid w-full max-w-6xl rounded-2xl bg-bg-primary shadow-low lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="p-6">
          <iframe
            ref={frame}
            src="/ascii-shedders/cloud-rain.html"
            title="Cloud rain ASCII animation"
            onLoad={send}
            className="block aspect-video w-full rounded-lg border-0 lg:aspect-auto lg:h-full lg:min-h-[32rem]"
          />
        </div>

        <aside className="flex flex-col gap-6 border-t border-dotted border-fill-tertiary p-6 lg:border-t-0 lg:border-l">
          <header className="flex flex-col gap-1">
            <h1 className="text-title-mini-medium text-text-primary">Parameters</h1>
            <p className="text-body-small-regular text-text-secondary">Cloud rain</p>
          </header>

          <div className="flex flex-col gap-5">
            <SegmentedField
              label="Character set"
              value={params.glyphs}
              options={GLYPH_SETS}
              onChange={(glyphs) => set({ glyphs })}
            />
            {SLIDERS.map((s) => (
              <SliderField
                key={s.key}
                label={s.label}
                value={params[s.key]}
                display={s.format(params[s.key])}
                min={s.min}
                max={s.max}
                step={s.step}
                onChange={(v) => set({ [s.key]: v })}
              />
            ))}
          </div>

          <button
            type="button"
            disabled={isDefault}
            onClick={() => set(DEFAULTS)}
            className="mt-auto h-8 self-start rounded-lg bg-control-bg px-3 text-body-small-medium text-text-primary shadow-low outline-none transition-shadow hover:shadow-low-hover focus-visible:shadow-focus disabled:text-text-tertiary disabled:hover:shadow-low"
          >
            Reset
          </button>
        </aside>
      </div>
    </main>
  )
}
