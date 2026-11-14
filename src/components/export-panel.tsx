import { useEffect, useRef, useState, type ReactNode } from 'react'
import { highlight } from 'sugar-high'
import {
  GIF_FPS,
  GIF_SIZE,
  MODULE_URL,
  SITE,
  VIDEO_FPS,
  VIDEO_SIZES,
  canRecordVideo,
  download,
  embedCode,
  htmlFile,
  jsCode,
  reactCode,
  renderGif,
  renderVideo,
  type VideoSize,
} from '../export'
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
const SIZES = [...VIDEO_SIZES].reverse() // smallest first, like a quality menu
const LENGTHS = [
  { value: '5', label: '5 s' },
  { value: '10', label: '10 s' },
  { value: '20', label: '20 s' },
] as const
type Length = (typeof LENGTHS)[number]['value']

// Ways to take the current look into another project. All of them carry the current settings.
export function ExportPanel({ params, getCanvas }: { params: Params; getCanvas: () => HTMLCanvasElement | null }) {
  const [format, setFormat] = useState<Format>('embed')
  const [size, setSize] = useState<VideoSize>('4k')
  const [length, setLength] = useState<Length>('5')
  // The render in progress: which kind, how far along (0 to 1), and how to cancel it.
  const [rec, setRec] = useState<{ kind: Media; done: number; abort: AbortController } | null>(null)
  // What the last finished render produced, shown on its button for a moment, e.g. "1440p".
  const [made, setMade] = useState('')
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
  // Leaving the page mid-render stops it.
  const running = useRef<AbortController | null>(null)
  useEffect(() => () => running.current?.abort(), [])

  // Renders the settings as they are when the button is pressed, in a separate off-screen
  // shader, so the preview keeps running and can be adjusted meanwhile without affecting the file.
  const record = async (kind: Media) => {
    if (rec) return void (rec.kind === kind && rec.abort.abort()) // pressing a busy button cancels it
    const abort = new AbortController()
    running.current = abort
    setRec({ kind, done: 0, abort })
    const job = {
      seconds: Number(length),
      // The preview's width in CSS px, so the file has the same number of cells across as the screen.
      previewWidth: getCanvas()?.clientWidth || 1280,
      signal: abort.signal,
      onProgress: (done: number) => setRec((r) => r && { ...r, done }),
    }
    try {
      if (kind === 'video') {
        const { width, height } = VIDEO_SIZES.find((s) => s.value === size)!
        const video = await renderVideo(params, { ...job, width, height })
        download(`cloud-rain-${video.size.value}.${video.ext}`, video.blob)
        setMade(video.size.label)
      } else {
        download('cloud-rain.gif', await renderGif(params, { ...job, ...GIF_SIZE }))
        setMade('')
      }
      setStatus(`${kind}:done`)
    } catch {
      setStatus(abort.signal.aborted ? '' : `${kind}:failed`)
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
      {canRecordVideo && <SegmentedField label="Video size" value={size} options={SIZES} onChange={setSize} />}
      <SegmentedField label="Length" value={length} options={LENGTHS} onChange={setLength} />
      <div className="grid grid-cols-2 gap-1.5">
        {canRecordVideo && (
          <MediaTile
            label="Video"
            detail={`${length} s · ${SIZES.find((s) => s.value === size)!.label} · ${VIDEO_FPS} fps`}
            done={rec?.kind === 'video' ? rec.done : null}
            result={status === 'video:done' ? `Saved ${made}` : status === 'video:failed' ? 'Retry' : ''}
            disabled={rec?.kind === 'gif'}
            onClick={() => record('video')}
          />
        )}
        <MediaTile
          label="GIF"
          detail={`${length} s · ${GIF_SIZE.width} × ${GIF_SIZE.height} · ${GIF_FPS} fps`}
          done={rec?.kind === 'gif' ? rec.done : null}
          result={status === 'gif:done' ? 'Saved' : status === 'gif:failed' ? 'Retry' : ''}
          disabled={rec?.kind === 'video'}
          onClick={() => record('gif')}
        />
      </div>

      <SegmentedField label="Code" value={format} options={FORMATS} onChange={setFormat} />

      {code ? (
        <CodeView {...code} onCopied={(ok) => setStatus(ok ? 'copy:done' : 'copy:failed')} copied={status === 'copy:done'} />
      ) : (
        <FileRow name="cloud-rain.html" kb={moduleKB} done={status === 'html:done'} onDownload={saveHtml} />
      )}
      {(format === 'react' || format === 'js') && <FileRow name="cloud-rain.js" kb={moduleKB} href={MODULE_URL} />}

      <span role="status" className="sr-only">
        {rec ? 'Rendering' : status.endsWith(':done') ? 'Done' : status.endsWith(':failed') ? 'Failed' : ''}
      </span>
    </>
  )
}

// A plain render button: a text label, swapping to the progress while the file is being made
// (pressing it then cancels), then "Saved" once the file is downloaded.
function MediaTile(props: {
  label: string
  detail: string
  done: number | null // progress 0 to 1 while rendering, otherwise null
  result: string
  disabled: boolean
  onClick: () => void
}) {
  const busy = props.done !== null
  return (
    <SheenPillButton
      onClick={props.onClick}
      disabled={props.disabled}
      aria-busy={busy || undefined}
      aria-label={busy ? `Cancel ${props.label}` : `Render ${props.label} (${props.detail})`}
      title={busy ? 'Cancel' : props.detail}
      className="w-full pointer-coarse:!h-10"
    >
      {busy ? (
        <>
          <span className="size-1.5 animate-pulse rounded-full bg-[#cf222e]" />
          {/* 100% is reached before the file is finished being written */}
          <span className="tabular-nums">{props.done! < 1 ? `${Math.floor(props.done! * 100)}% · Cancel` : 'Saving…'}</span>
        </>
      ) : (
        props.result || props.label
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
