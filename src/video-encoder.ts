// The parts of Mediabunny the video export uses. Importing them by name from here, rather than
// the whole package, lets the build drop the rest of it (demuxers, audio, other containers).
export { BufferTarget, CanvasSource, Mp4OutputFormat, Output, Quality, WebMOutputFormat, getFirstEncodableVideoCodec } from 'mediabunny'
