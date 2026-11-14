import { EFFECTS, SLIDERS, type Params } from './params'

// Every export is generated from the one renderer module, so they cannot drift apart.
export const MODULE_URL = '/ascii-shedders/cloud-rain.js'
const PAGE_URL = '/ascii-shedders/cloud-rain.html'

// The public address exported links point at: the production domain when built on Vercel,
// otherwise wherever the app is running.
export const SITE = import.meta.env.VITE_SITE_URL || window.location.origin
const isPublic = (origin: string) => !/^https?:\/\/(localhost|127\.|\[::1\])/.test(origin)

// Every export states all seven settings, defaults included. An export is then a complete record
// of the look: it cannot change if the shader's defaults ever do, and it reads the same wherever
// it is pasted. Slider values are rounded to their step, so 1.1400000000000001 exports as 1.14.
const ORDER = ['effect', 'glyphs', 'cell', 'speed', 'density', 'trail', 'contrast'] as const
export function settings(p: Params): Array<[keyof Params, string | number]> {
  return ORDER.map((k) => {
    const v = p[k]
    if (typeof v !== 'number') return [k, v]
    const step = SLIDERS.find((s) => s.key === k)!.step
    return [k, Number(v.toFixed(String(step).split('.')[1]?.length ?? 0))]
  })
}

const literal = (v: string | number) => (typeof v === 'string' ? `'${v}'` : String(v))
const objectLiteral = (p: Params) => `{\n${settings(p).map(([k, v]) => `  ${k}: ${literal(v)},`).join('\n')}\n}`

export function embedCode(p: Params, origin: string) {
  const query = new URLSearchParams(settings(p).map(([k, v]) => [k, String(v)])).toString()
  return `<iframe
  src="${(origin + PAGE_URL + '?' + query).replaceAll('&', '&amp;')}"
  title="Cloud rain"
  loading="lazy"
  style="width: 100%; aspect-ratio: 16 / 9; border: 0"
></iframe>`
}

// Plain browser module. Once deployed it imports straight from the site (served with CORS),
// so there is nothing to download; locally it expects cloud-rain.js next to the code.
export function jsCode(p: Params, origin: string) {
  const from = isPublic(origin) ? origin + MODULE_URL : './cloud-rain.js'
  return `// In a <script type="module">, or any bundler
import { mount } from '${from}'

// Size the canvas with CSS; the shader fills it.
const shader = mount(document.querySelector('canvas'), ${objectLiteral(p)})

// shader.update({ speed: 12 })  change settings live
// shader.destroy()              stop and clean up`
}

// The settings are part of the component, so <CloudRain /> alone gives the tuned look.
export function reactCode(p: Params) {
  return `import { useEffect, useRef } from 'react'
import { mount } from './cloud-rain.js'

// The look tuned in the editor. Props override it: <CloudRain speed={12} />
const SETTINGS = ${objectLiteral(p)}

// It fills its parent, so give the parent a size.
// TypeScript: set "allowJs": true so the .js import resolves.
export function CloudRain(props) {
  const canvas = useRef(null)
  const shader = useRef(null)

  useEffect(() => {
    shader.current = mount(canvas.current, { ...SETTINGS, ...props })
    return () => shader.current.destroy()
  }, [])
  useEffect(() => shader.current.update({ ...SETTINGS, ...props }))

  return <canvas ref={canvas} style={{ display: 'block', width: '100%', height: '100%' }} />
}`
}

// One self-contained page: the renderer module inlined, with the current settings baked in.
export async function htmlFile(p: Params) {
  const sky = EFFECTS.find((e) => e.value === p.effect)!.swatch[0] // shown until the first frame is drawn
  const res = await fetch(MODULE_URL)
  if (!res.ok) throw new Error(`Could not load the shader (${res.status})`)
  const renderer = (await res.text()).replace(/^export /gm, '')
  return `<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cloud Rain</title>
<style>
  html, body { margin: 0; background: ${sky}; overflow: hidden; }
  canvas { position: fixed; inset: 0; width: 100%; height: 100%; display: block; }
</style>
<canvas id="c" role="img" aria-label="A cloudscape drawn with characters, with characters falling over it like rain"></canvas>
<script type="module">
${renderer}
mount(document.getElementById('c'), ${JSON.stringify(Object.fromEntries(settings(p)))});
</script>
</html>
`
}

// ---- Video and GIF ----
//
// Neither records the preview. Each mounts a second, off-screen copy of the shader with the
// current settings at the output's own pixel size and steps it one frame at a time, so the
// file has every frame at full sharpness however slow the device is, and is not limited to
// the size of the preview. `previewWidth` (CSS px) keeps the picture the same as on screen:
// the frame is as many cells wide as the preview, each cell drawn with more pixels.

type Shader = { ready: Promise<void>; render(dt?: number): void; destroy(): void }
type Renderer = { mount(canvas: HTMLCanvasElement, options: Record<string, unknown>): Shader }
const loadRenderer = () => import(/* @vite-ignore */ new URL(MODULE_URL, window.location.origin).href) as Promise<Renderer>

export type RenderJob = {
  width: number
  height: number
  seconds: number
  previewWidth: number
  onProgress?: (done: number) => void // 0 to 1
  signal?: AbortSignal
}

async function offscreen(p: Params, width: number, height: number, pixelRatio: number) {
  const { mount } = await loadRenderer()
  const canvas = Object.assign(document.createElement('canvas'), { width, height })
  const shader = mount(canvas, { ...Object.fromEntries(settings(p)), width, height, pixelRatio, autoplay: false })
  await shader.ready
  return { canvas, shader }
}

// Let the page breathe (progress, the Cancel button) between frames. A message channel rather
// than a timer, because timers are slowed to one per second in a background tab.
const breathe = () =>
  new Promise<void>((resolve) => {
    const { port1, port2 } = new MessageChannel()
    port1.onmessage = () => resolve()
    port2.postMessage(0)
  })
function pacer(job: RenderJob) {
  let last = performance.now()
  return async (done: number) => {
    job.signal?.throwIfAborted()
    if (performance.now() - last < 30) return
    job.onProgress?.(done)
    await breathe()
    last = performance.now()
  }
}

export const VIDEO_FPS = 60
// Output heights offered, largest first; all 16:9 with even sides, as H.264 needs.
export const VIDEO_SIZES = [
  { value: '4k', label: '4K', width: 3840, height: 2160 },
  { value: '1440p', label: '1440p', width: 2560, height: 1440 },
  { value: '1080p', label: '1080p', width: 1920, height: 1080 },
  { value: '720p', label: '720p', width: 1280, height: 720 },
] as const
export type VideoSize = (typeof VIDEO_SIZES)[number]['value']

// The picture is fine dither and one-pixel glyph strokes, the hardest thing for a video codec,
// so the bitrate budget is generous: 0.14 bits per pixel per frame (17 Mbps at 1080p60, 70 at
// 4K60), above what streaming sites ask for uploads. It is a ceiling: still areas cost less.
const videoBitrate = (width: number, height: number) => Math.round(width * height * VIDEO_FPS * 0.14)

// Whether this device has a hardware H.264 encoder for the size, asked of WebCodecs directly.
// The codec string is High profile at the level 60 fps needs: 4.0, 4.2, 5.1 or 5.2.
async function hasHardwareH264(width: number, height: number, bitrate: number) {
  const level = height <= 720 ? '28' : height <= 1080 ? '2A' : height <= 1440 ? '33' : '34'
  try {
    const config = { codec: `avc1.6400${level}`, width, height, bitrate, framerate: VIDEO_FPS, hardwareAcceleration: 'prefer-hardware' as const }
    return (await VideoEncoder.isConfigSupported(config)).supported === true
  } catch {
    return false
  }
}

const mediaRecorderMime =
  typeof MediaRecorder !== 'undefined' && 'captureStream' in HTMLCanvasElement.prototype
    ? ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm', 'video/mp4'].find((t) => MediaRecorder.isTypeSupported(t))
    : undefined
export const canRecordVideo = typeof VideoEncoder !== 'undefined' || mediaRecorderMime !== undefined

// Encode with WebCodecs, frame by frame. Which encoder is the best one differs by device, so
// they are tried in order of the quality they give:
//  1. H.264 in MP4 on the device's hardware encoder. Plays everywhere (phones, editors, social
//     uploads) and hardware encoders spend the bitrate they are given.
//  2. VP9 or AV1 in WebM at constant quality: every frame is held to the same near-lossless
//     level and the size follows. Used where H.264 would be the browser's built-in software
//     encoder, which stays soft however many bits it is offered (measured: the same 3 MB file
//     at 17 and at 70 Mbps, with visibly blurred glyphs).
//  3. Software H.264, then VP8, as last resorts.
// If the device cannot encode the size asked for, the next size down is used; the result says which.
export async function renderVideo(p: Params, job: RenderJob) {
  const sizes = VIDEO_SIZES.filter((s) => s.height <= job.height)
  if (typeof VideoEncoder !== 'undefined') {
    const mb = await import('./video-encoder')
    let failure: unknown
    for (const size of sizes) {
      const bitrate = videoBitrate(size.width, size.height)
      const byBitrate = new mb.Quality({ bitrate, bitrateMode: 'variable' })
      // Quantizer 18 of 63: visually lossless for this picture. The bitrate is used instead by
      // browsers that cannot hold a constant quality.
      const constantQuality = new mb.Quality({ quantizer: 18, bitrate, bitrateMode: 'variable' })
      const mp4 = () => new mb.Mp4OutputFormat({ fastStart: 'in-memory' }) // index first, so it starts playing at once
      const plans = [
        ...((await hasHardwareH264(size.width, size.height, bitrate))
          ? [{ format: mp4(), codecs: ['avc'], quality: byBitrate, hardwareAcceleration: 'prefer-hardware' } as const]
          : []),
        { format: new mb.WebMOutputFormat(), codecs: ['vp9', 'av1'], quality: constantQuality, hardwareAcceleration: 'no-preference' },
        { format: mp4(), codecs: ['avc'], quality: byBitrate, hardwareAcceleration: 'no-preference' },
        { format: new mb.WebMOutputFormat(), codecs: ['vp8'], quality: byBitrate, hardwareAcceleration: 'no-preference' },
      ] as const
      for (const { format, codecs, quality, hardwareAcceleration } of plans) {
        const codec = await mb.getFirstEncodableVideoCodec([...codecs], { width: size.width, height: size.height, quality })
        if (!codec) continue
        job.signal?.throwIfAborted()
        const { canvas, shader } = await offscreen(p, size.width, size.height, size.width / job.previewWidth)
        const output = new mb.Output({ format, target: new mb.BufferTarget() })
        try {
          const source = new mb.CanvasSource(canvas, {
            codec,
            quality,
            hardwareAcceleration,
            keyFrameInterval: 2,
            latencyMode: 'quality', // no dropped frames, best compression
            contentHint: 'detail', // keep edges sharp rather than motion smooth
          })
          output.addVideoTrack(source, { frameRate: VIDEO_FPS })
          await output.start()
          const frames = Math.round(job.seconds * VIDEO_FPS)
          const pace = pacer(job)
          for (let i = 0; i < frames; i++) {
            if (i) shader.render(1 / VIDEO_FPS)
            await source.add(i / VIDEO_FPS, 1 / VIDEO_FPS) // waits when the encoder is behind
            await pace((i + 1) / frames)
          }
          job.onProgress?.(1)
          await output.finalize()
          return { blob: new Blob([output.target.buffer!], { type: format.mimeType }), ext: format.fileExtension.slice(1), size, codec }
        } catch (error) {
          if (output.state !== 'finalized' && output.state !== 'canceled') await output.cancel().catch(() => {})
          if (job.signal?.aborted) throw error
          failure = error // an encoder that accepted the settings and then broke: try the next one
        } finally {
          shader.destroy()
        }
      }
    }
    if (failure) throw failure
  }
  // No WebCodecs (older Safari and Firefox): record the off-screen canvas as it plays. Real
  // time, so frames can drop on a slow device, but still at the output's own size.
  const mime = mediaRecorderMime
  if (!mime) throw new Error('This browser cannot encode video')
  const size = sizes.find((s) => s.height <= 1080) ?? sizes[sizes.length - 1]
  const { canvas, shader } = await offscreen(p, size.width, size.height, size.width / job.previewWidth)
  const stream = canvas.captureStream(VIDEO_FPS)
  try {
    const recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: videoBitrate(size.width, size.height) })
    const chunks: Blob[] = []
    recorder.ondataavailable = (e) => chunks.push(e.data)
    const stopped = new Promise<void>((resolve, reject) => {
      recorder.onstop = () => resolve()
      recorder.onerror = () => reject(new Error('Recording failed'))
    })
    recorder.start()
    const start = performance.now()
    for (let last = start, now = start; now - start < job.seconds * 1000; last = now) {
      now = await new Promise<number>((r) => requestAnimationFrame(r))
      if (job.signal?.aborted) break
      shader.render(Math.min(0.05, (now - last) / 1000))
      job.onProgress?.(Math.min(1, (now - start) / (job.seconds * 1000)))
    }
    recorder.stop()
    await stopped
    job.signal?.throwIfAborted()
    const type = mime.split(';')[0]
    const blob = new Blob(chunks, { type })
    if (!blob.size) throw new Error('Recording came back empty')
    return { blob, ext: type === 'video/mp4' ? 'mp4' : 'webm', size, codec: mime }
  } finally {
    stream.getTracks().forEach((t) => t.stop())
    shader.destroy()
  }
}

export const GIF_FPS = 20 // GIF frame times are whole hundredths of a second: 20 fps is exactly 5
export const GIF_SIZE = { width: 640, height: 360 }

// An animated GIF, rendered frame by frame like the video. GIF holds 256 colours and has no
// real compression, so three things keep it sharp and small: the picture is drawn large and
// scaled down (clean edges instead of 3px glyphs), the palette is built from several moments
// of the animation, and each frame stores only the pixels that changed since the last one.
// The encoder is only downloaded when a GIF is actually made.
export async function renderGif(p: Params, job: RenderJob) {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc')
  const { width: w, height: h } = job
  // Draw at 1-4x so a cell is at least 5px wide before scaling down.
  const zoom = Math.min(4, Math.max(1, Math.ceil(5 / (p.cell * (w / job.previewWidth)))))
  const { canvas, shader } = await offscreen(p, w * zoom, h * zoom, (w * zoom) / job.previewWidth)
  try {
    const out = Object.assign(document.createElement('canvas'), { width: w, height: h })
    const ctx = out.getContext('2d', { willReadFrequently: true })!
    ctx.imageSmoothingQuality = 'high'
    const grab = () => {
      ctx.drawImage(canvas, 0, 0, w, h)
      return ctx.getImageData(0, 0, w, h).data
    }

    // Palette: four moments half a second apart, so rain heads and trails are well represented.
    const sample = new Uint8ClampedArray(w * h * 4 * 4)
    for (let i = 0; i < 4; i++) {
      shader.render(0.5)
      sample.set(grab(), i * w * h * 4)
    }
    const palette = quantize(sample, 255) // 255 colours; one slot is left for "unchanged"
    const same = palette.length
    palette.push([0, 0, 0])

    const gif = GIFEncoder()
    const frames = Math.round(job.seconds * GIF_FPS)
    const shown = new Uint8Array(w * h) // what is on screen after the frames so far
    const pace = pacer(job)
    for (let i = 0; i < frames; i++) {
      shader.render(1 / GIF_FPS)
      const index = applyPalette(grab(), palette)
      if (i)
        for (let j = 0; j < index.length; j++) {
          if (index[j] === shown[j]) index[j] = same
          else shown[j] = index[j]
        }
      else shown.set(index)
      // dispose 1: leave the frame in place, so unchanged pixels show through the next one
      gif.writeFrame(index, w, h, { palette: i ? undefined : palette, delay: 1000 / GIF_FPS, transparent: i > 0, transparentIndex: same, dispose: 1 })
      await pace((i + 1) / frames)
    }
    gif.finish()
    return new Blob([gif.bytes()], { type: 'image/gif' })
  } finally {
    shader.destroy()
  }
}

export function download(name: string, data: string | Blob, type = 'text/plain') {
  const url = URL.createObjectURL(typeof data === 'string' ? new Blob([data], { type }) : data)
  const a = Object.assign(document.createElement('a'), { href: url, download: name })
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000) // after the browser has started the download
}
