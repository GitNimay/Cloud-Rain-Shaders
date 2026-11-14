import { useEffect, useRef, useState, type ReactNode } from 'react'
import { highlight } from 'sugar-high'
import { MODULE_URL, SITE, download, embedCode, htmlFile, jsCode, reactCode, recordGif, recordVideo, videoMime } from '../export'
import type { Params } from '../params'
import { SegmentedField } from './controls'
import { SheenPillButton } from './sheen-pill-button'

const FORMATS = [
  { value: 'embed', label: 'Embed' },
  { value: 'html', label: 'HTML' },
  { value: 'react', label: 'React' },
  { value: 'js', label: 'JS' },
] as const
type Format = (typeof FORMATS)[number]['value']
type Media = 'video' | 'gif'

const MEDIA = {
  video: { label: 'Video', seconds: 6, meta: videoMime?.startsWith('video/mp4') ? 'MP4' : 'WebM' },
  gif: { label: 'GIF', seconds: 4, meta: '360px' },
} as const

// Ways to take the current look into another project. All of them carry the current settings.
export function ExportPanel({ params, getCanvas }: { params: Params; getCanvas: () => HTMLCanvasElement | null }) {
  const [format, setFormat] = useState<Format>('embed')
  const [rec, setRec] = useState<{ kind: Media; start: number } | null>(null)
  const [now, setNow] = useState(0)
  // Feedback for the last action, e.g. "copy:done" or "gif:failed"; cleared shortly after.
  const [status, setStatus] = useState('')
  const [moduleKB, setModuleKB] = useState<number | null>(null)

  useEffect(() => {
    fetch(MODULE_URL)
      .then((r) => r.blob())
      .then((b) => setModuleKB(Math.round(b.size / 1024)))
      .catch(() => {})
  }, [])
  useEffect(() => {
    if (!status) return
    const t = setTimeout(() => setStatus(''), 1800)
    return () => clearTimeout(t)
  }, [status])
  useEffect(() => {
    if (!rec) return
    const t = setInterval(() => setNow(performance.now()), 200)
    return () => clearInterval(t)
  }, [rec])

  const record = async (kind: Media) => {
    const canvas = getCanvas()
    if (!canvas || rec) return
    const start = performance.now()
    setNow(start)
    setRec({ kind, start })
    try {
      if (kind === 'video') {
        const { blob, ext } = await recordVideo(canvas, MEDIA.video.seconds)
        download(`cloud-rain.${ext}`, blob)
      } else download('cloud-rain.gif', await recordGif(canvas, MEDIA.gif.seconds))
      setStatus(`${kind}:done`)
    } catch {
      setStatus(`${kind}:failed`)
    } finally {
      setRec(null)
    }
  }
  const saveHtml = async () => {
    try {
      download('cloud-rain.html', await htmlFile(params), 'text/html')
      setStatus('html:done')
    } catch {
      setStatus('html:failed')
    }
  }

  const code =
    format === 'embed'
      ? { file: 'index.html', lang: 'html', text: embedCode(params, SITE) }
      : format === 'react'
        ? { file: 'CloudRain.jsx', lang: 'jsx', text: reactCode(params) }
        : format === 'js'
          ? { file: 'main.js', lang: 'js', text: jsCode(params, SITE) }
          : null

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="text-body-mini-regular text-text-secondary">Media</span>
        <div className="grid grid-cols-2 gap-1.5">
          {(Object.keys(MEDIA) as Media[])
            .filter((k) => k !== 'video' || videoMime)
            .map((kind) => (
              <MediaTile
                key={kind}
                {...MEDIA[kind]}
                state={
                  rec?.kind === kind
                    ? (now - rec.start) / 1000 < MEDIA[kind].seconds
                      ? 'recording'
                      : 'encoding'
                    : status === `${kind}:done`
                      ? 'done'
                      : status === `${kind}:failed`
                        ? 'failed'
                        : 'idle'
                }
                left={rec?.kind === kind ? Math.max(1, Math.ceil(MEDIA[kind].seconds - (now - rec.start) / 1000)) : 0}
                disabled={rec !== null && rec.kind !== kind}
                onClick={() => record(kind)}
              />
            ))}
        </div>
      </div>

      <SegmentedField label="Code" value={format} options={FORMATS} onChange={setFormat} />

      {code ? (
        <CodeView {...code} onCopied={(ok) => setStatus(ok ? 'copy:done' : 'copy:failed')} copied={status === 'copy:done'} />
      ) : (
        <FileRow name="cloud-rain.html" kb={moduleKB} done={status === 'html:done'} onDownload={saveHtml} />
      )}
      {(format === 'react' || format === 'js') && <FileRow name="cloud-rain.js" kb={moduleKB} href={MODULE_URL} />}

      <span role="status" className="sr-only">
        {rec ? 'Recording' : status.endsWith(':done') ? 'Done' : status.endsWith(':failed') ? 'Failed' : ''}
      </span>
    </>
  )
}

// A plain record button: a text label, swapping to a pulsing REC dot and countdown while
// capturing, then "Saved" once the file is downloaded.
function MediaTile(props: {
  label: string
  seconds: number
  meta: string
  state: 'idle' | 'recording' | 'encoding' | 'done' | 'failed'
  left: number
  disabled: boolean
  onClick: () => void
}) {
  const busy = props.state === 'recording' || props.state === 'encoding'
  return (
    <SheenPillButton
      onClick={props.onClick}
      disabled={props.disabled || busy}
      aria-busy={busy || undefined}
      aria-label={`Record ${props.seconds} second ${props.label} (${props.meta})`}
      title={`${props.seconds}s · ${props.meta}`}
      className="w-full pointer-coarse:!h-10"
    >
      {props.state === 'recording' ? (
        <>
          <span className="size-1.5 animate-pulse rounded-full bg-[#cf222e]" />
          <span className="tabular-nums">Rec {props.left}s</span>
        </>
      ) : props.state === 'encoding' ? (
        'Encoding…'
      ) : props.state === 'done' ? (
        'Saved'
      ) : props.state === 'failed' ? (
        'Retry'
      ) : (
        props.label
      )}
    </SheenPillButton>
  )
}

// Code in a GitHub-style file view: header with the file name and a copy button, highlighted body.
function CodeView(props: { file: string; lang: string; text: string; copied: boolean; onCopied: (ok: boolean) => void }) {
  const body = useRef<HTMLPreElement>(null)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.text)
      props.onCopied(true)
    } catch {
      // Clipboard blocked (permissions, insecure origin): select the code so Ctrl+C works.
      if (body.current) window.getSelection()?.selectAllChildren(body.current)
      props.onCopied(false)
    }
  }
  return (
    <div className="gh-code overflow-hidden rounded-md" data-lang={props.lang}>
      <div className="flex h-7 items-center justify-between pointer-coarse:h-9 border-b border-[var(--gh-border)] bg-[var(--gh-canvas-subtle)] pr-1 pl-2.5">
        <span className="font-mono text-[10px] text-[var(--gh-fg-muted)]">{props.file}</span>
        <button
          type="button"
          onClick={copy}
          aria-label={props.copied ? 'Copied' : 'Copy code'}
          title={props.copied ? 'Copied' : 'Copy'}
          className="grid size-5 place-items-center rounded-[4px] pointer-coarse:size-8 text-[var(--gh-fg-muted)] outline-none transition-colors hover:bg-[var(--gh-hover)] hover:text-[var(--gh-fg)] focus-visible:shadow-focus"
        >
          <Icon name={props.copied ? 'check' : 'copy'} className={props.copied ? 'size-3 text-text-green' : 'size-3'} />
        </button>
      </div>
      <pre
        ref={body}
        tabIndex={0}
        aria-label={`${props.file} code`}
        className="max-h-40 overflow-auto bg-[var(--gh-canvas)] px-2.5 py-2 font-mono text-[10px] leading-[15px] text-[var(--gh-fg)] outline-none [scrollbar-width:thin] focus-visible:shadow-focus"
        // The code is generated from validated settings, and sugar-high escapes it.
        dangerouslySetInnerHTML={{ __html: highlight(props.text) }}
      />
    </div>
  )
}

// A downloadable file, shown like a GitHub release asset.
function FileRow(props: { name: string; kb: number | null; href?: string; done?: boolean; onDownload?: () => void }) {
  const control =
    'grid size-5 place-items-center rounded-[4px] pointer-coarse:size-8 text-text-secondary outline-none transition-colors hover:bg-fill-tertiary/40 hover:text-text-primary focus-visible:shadow-focus'
  const icon = <Icon name={props.done ? 'check' : 'download'} className={props.done ? 'size-3 text-text-green' : 'size-3'} />
  return (
    <div className="flex h-8 items-center gap-2 rounded-md pointer-coarse:h-10 bg-control-bg pr-1.5 pl-2.5 shadow-low">
      <Icon name="file" className="size-3.5 shrink-0 text-text-tertiary" />
      <span className="truncate font-mono text-[10px] text-text-primary">{props.name}</span>
      <span className="ml-auto text-body-micro-regular text-text-tertiary tabular-nums">{props.kb ? `${props.kb} KB` : ''}</span>
      {props.href ? (
        <a href={props.href} download={props.name} aria-label={`Download ${props.name}`} className={control}>
          {icon}
        </a>
      ) : (
        <button type="button" onClick={props.onDownload} aria-label={`Download ${props.name}`} className={control}>
          {icon}
        </button>
      )}
    </div>
  )
}

// A few Lucide icons (ISC license), inlined rather than adding a package for four glyphs.
const ICONS = {
  copy: (
    <>
      <rect width="14" height="14" x="8" y="8" rx="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  download: (
    <>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
      <path d="M12 15V3" />
    </>
  ),
  file: (
    <>
      <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
      <path d="M14 2v4a2 2 0 0 0 2 2h4" />
      <path d="m10 13-2 2 2 2" />
      <path d="m14 17 2-2-2-2" />
    </>
  ),
} satisfies Record<string, ReactNode>
type IconName = keyof typeof ICONS

function Icon({ name, className = 'size-3.5' }: { name: IconName; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      {ICONS[name]}
    </svg>
  )
}
