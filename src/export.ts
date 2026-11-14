import { SHADER_DEFAULTS, type Params } from './params'

// Every export is generated from the one renderer module, so they cannot drift apart.
export const MODULE_URL = '/ascii-shedders/cloud-rain.js'
const PAGE_URL = '/ascii-shedders/cloud-rain.html'

// The public address exported links point at: the production domain when built on Vercel,
// otherwise wherever the app is running.
export const SITE = import.meta.env.VITE_SITE_URL || window.location.origin
const isPublic = (origin: string) => !/^https?:\/\/(localhost|127\.|\[::1\])/.test(origin)

// Only the settings that differ from the shader's defaults, to keep exported code short.
function changed(p: Params): Array<[string, string | number]> {
  return (Object.keys(SHADER_DEFAULTS) as Array<keyof Params>).filter((k) => p[k] !== SHADER_DEFAULTS[k]).map((k) => [k, p[k]])
}

const literal = (v: string | number) => (typeof v === 'string' ? `'${v}'` : String(v))

export function embedCode(p: Params, origin: string) {
  const query = new URLSearchParams(changed(p).map(([k, v]) => [k, String(v)])).toString()
  const src = origin + PAGE_URL + (query ? `?${query}` : '')
  return `<iframe
  src="${src.replaceAll('&', '&amp;')}"
  title="Cloud rain"
  loading="lazy"
  style="width: 100%; aspect-ratio: 16 / 9; border: 0"
></iframe>`
}

// Plain browser module. Once deployed it imports straight from the site (served with CORS),
// so there is nothing to download; locally it expects cloud-rain.js next to the code.
export function jsCode(p: Params, origin: string) {
  const options = changed(p)
  const args = options.length ? `, {\n${options.map(([k, v]) => `  ${k}: ${literal(v)},`).join('\n')}\n}` : ''
  const from = isPublic(origin) ? origin + MODULE_URL : './cloud-rain.js'
  return `// In a <script type="module">, or any bundler
import { mount } from '${from}'

// Size the canvas with CSS; the shader fills it.
const shader = mount(document.querySelector('canvas')${args})

// shader.update({ speed: 12 })  change settings live
// shader.destroy()              stop and clean up`
}

export function reactCode(p: Params) {
  const props = changed(p)
    .map(([k, v]) => (typeof v === 'string' ? ` ${k}="${v}"` : ` ${k}={${v}}`))
    .join('')
  return `import { useEffect, useRef } from 'react'
import { mount } from './cloud-rain.js'

// Usage: <CloudRain${props} />
// It fills its parent, so give the parent a size.
// TypeScript: set "allowJs": true so the .js import resolves.
export function CloudRain(props) {
  const canvas = useRef(null)
  const shader = useRef(null)

  useEffect(() => {
    shader.current = mount(canvas.current, props)
    return () => shader.current.destroy()
  }, [])
  useEffect(() => shader.current.update(props))

  return <canvas ref={canvas} style={{ display: 'block', width: '100%', height: '100%' }} />
}`
}

// One self-contained page: the renderer module inlined, with the current settings baked in.
export async function htmlFile(p: Params) {
  const res = await fetch(MODULE_URL)
  if (!res.ok) throw new Error(`Could not load the shader (${res.status})`)
  const renderer = (await res.text()).replace(/^export /gm, '')
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cloud Rain</title>
<style>
  html, body { margin: 0; background: #04083a; overflow: hidden; }
  canvas { position: fixed; inset: 0; width: 100%; height: 100%; display: block; }
</style>
<canvas id="c" role="img" aria-label="A cloudscape drawn with characters, with characters falling over it like rain"></canvas>
<script type="module">
${renderer}
mount(document.getElementById('c'), ${JSON.stringify(Object.fromEntries(changed(p)))});
</script>
</html>
`
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// Record the live canvas with the browser's own encoder. WebM first: Chromium also claims MP4
// but can hand back an empty file; MP4 is the fallback for Safari, which has no WebM.
export const videoMime =
  typeof MediaRecorder !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype
    ? ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'].find((t) => MediaRecorder.isTypeSupported(t))
    : undefined
export async function recordVideo(canvas: HTMLCanvasElement, seconds: number) {
  const mime = videoMime
  if (!mime) throw new Error('This browser cannot record video')
  const stream = canvas.captureStream(30)
  const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 8_000_000 })
  const chunks: Blob[] = []
  recorder.ondataavailable = (e) => chunks.push(e.data)
  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve()
    recorder.onerror = () => reject(new Error('Recording failed'))
  })
  recorder.start()
  await sleep(seconds * 1000)
  recorder.stop()
  await stopped
  stream.getTracks().forEach((t) => t.stop())
  const type = mime.split(';')[0]
  const blob = new Blob(chunks, { type })
  if (!blob.size) throw new Error('Recording came back empty')
  return { blob, ext: type === 'video/mp4' ? 'mp4' : 'webm' }
}

// Sample the live canvas into an animated GIF. Scaled down and at a low frame rate, because
// GIF files get large fast. The encoder is only downloaded when a GIF is actually made.
// ponytail: one palette taken from the first frame; quantize per frame if colours ever shift mid-recording.
export async function recordGif(canvas: HTMLCanvasElement, seconds: number, fps = 10, maxWidth = 360) {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc')
  const scale = Math.min(1, maxWidth / canvas.width)
  const w = Math.round(canvas.width * scale)
  const h = Math.round(canvas.height * scale)
  const small = Object.assign(document.createElement('canvas'), { width: w, height: h })
  const ctx = small.getContext('2d', { willReadFrequently: true })!
  const frames: Uint8ClampedArray[] = []
  for (let i = 0; i < seconds * fps; i++) {
    ctx.drawImage(canvas, 0, 0, w, h)
    frames.push(ctx.getImageData(0, 0, w, h).data)
    await sleep(1000 / fps)
  }
  const gif = GIFEncoder()
  const palette = quantize(frames[0], 256)
  frames.forEach((f, i) => gif.writeFrame(applyPalette(f, palette), w, h, { palette: i ? undefined : palette, delay: 1000 / fps }))
  gif.finish()
  return new Blob([gif.bytes()], { type: 'image/gif' })
}

export function download(name: string, data: string | Blob, type = 'text/plain') {
  const url = URL.createObjectURL(typeof data === 'string' ? new Blob([data], { type }) : data)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000) // after the browser has started the download
}
