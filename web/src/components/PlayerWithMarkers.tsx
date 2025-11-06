import { useEffect, useRef } from 'react'
import Hls from 'hls.js'

type Marker = { time: number; type: string; note: string }
export default function PlayerWithMarkers({ src, markers = [] as Marker[] }:{ src: string; markers?: Marker[] }) {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let hls: Hls | null = null

    if (Hls.isSupported()) {
      hls = new Hls()
      hls.loadSource(src)
      hls.attachMedia(video)
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
    }
    return () => { hls?.destroy() }
  }, [src])

  const jump = (t:number) => {
    const v = videoRef.current
    if (!v) return
    v.currentTime = t
    v.focus()
  }

  return (
    <div className="space-y-3">
      <video ref={videoRef} controls className="w-full rounded border bg-black" aria-label="HLS video player" />
      <div className="flex flex-wrap gap-2">
        {markers.map((m, i) => (
          <button key={i} onClick={() => jump(m.time)} className="px-2 py-1 rounded bg-indigo-50 border text-indigo-800" title={m.note}>
            {m.type}@{m.time}s
          </button>
        ))}
        {markers.length === 0 && <span className="text-sm text-slate-600">No QC markers.</span>}
      </div>
    </div>
  )
}
