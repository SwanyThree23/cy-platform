'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Video, StopCircle, Upload, Play, Trash2, Clock, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const MAX_SECONDS = 600 // 10 minutes

interface VideoPostProps {
  userId: string
  onUploaded?: (url: string, duration: number) => void
}

type RecordState = 'idle' | 'recording' | 'preview' | 'uploading' | 'done'

export default function VideoPost({ userId, onUploaded }: VideoPostProps) {
  const [state, setState] = useState<RecordState>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null)
  const [title, setTitle] = useState('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const startTimeRef = useRef<number>(0)

  const supabase = createClient()

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  useEffect(() => () => {
    stopTimer()
    streamRef.current?.getTracks().forEach(t => t.stop())
    if (previewUrl) URL.revokeObjectURL(previewUrl)
  }, [])

  async function startRecording() {
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.muted = true
        videoRef.current.play()
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm'

      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      chunksRef.current = []

      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = handleRecordingStop

      recorder.start(1000)
      startTimeRef.current = Date.now()
      setState('recording')
      setElapsed(0)

      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startTimeRef.current) / 1000)
        setElapsed(secs)
        if (secs >= MAX_SECONDS) stopRecording()
      }, 500)
    } catch (e) {
      setError('Camera/microphone access denied. Please allow permissions and try again.')
    }
  }

  function stopRecording() {
    stopTimer()
    mediaRecorderRef.current?.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
  }

  function handleRecordingStop() {
    const blob = new Blob(chunksRef.current, { type: 'video/webm' })
    setRecordedBlob(blob)
    const url = URL.createObjectURL(blob)
    setPreviewUrl(url)
    if (videoRef.current) {
      videoRef.current.srcObject = null
      videoRef.current.src = url
      videoRef.current.muted = false
    }
    setState('preview')
  }

  async function uploadVideo() {
    if (!recordedBlob) return
    setState('uploading')
    setProgress(0)

    const filename = `${userId}/${Date.now()}.webm`

    const { data, error: upErr } = await supabase.storage
      .from('video-posts')
      .upload(filename, recordedBlob, {
        contentType: 'video/webm',
        upsert: false,
      })

    if (upErr) {
      setError(`Upload failed: ${upErr.message}`)
      setState('preview')
      return
    }

    setProgress(80)

    const { data: { publicUrl } } = supabase.storage.from('video-posts').getPublicUrl(filename)

    // Save to DB
    const { error: dbErr } = await supabase.from('video_posts').insert({
      user_id: userId,
      title: title.trim() || 'Video Post',
      video_url: publicUrl,
      duration_seconds: elapsed,
    })

    if (dbErr) {
      setError(`Database error: ${dbErr.message}`)
      setState('preview')
      return
    }

    setProgress(100)
    setState('done')
    onUploaded?.(publicUrl, elapsed)
  }

  function reset() {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    setRecordedBlob(null)
    setElapsed(0)
    setProgress(0)
    setError(null)
    setTitle('')
    setState('idle')
    if (videoRef.current) { videoRef.current.src = ''; videoRef.current.srcObject = null }
  }

  const remaining = MAX_SECONDS - elapsed
  const pct = Math.min((elapsed / MAX_SECONDS) * 100, 100)

  function fmtTime(s: number) {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="glass rounded-xl border border-white/10 overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10 bg-white/5 flex items-center gap-2">
        <Video size={18} className="text-gold" />
        <h3 className="font-semibold text-white">Record Video Post</h3>
        <span className="text-xs text-gray-500 ml-auto">Max 10 minutes</span>
      </div>

      <div className="p-4 space-y-4">
        {error && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-500/15 border border-red-500/25 rounded-lg text-red-300 text-sm">
            <AlertCircle size={15} />
            {error}
          </div>
        )}

        {/* Video preview */}
        <div className="relative bg-black rounded-xl overflow-hidden aspect-video">
          <video
            ref={videoRef}
            className="w-full h-full object-cover"
            playsInline
            controls={state === 'preview' || state === 'done'}
          />

          {state === 'idle' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <div className="text-center">
                <Video size={48} className="mx-auto mb-3 text-gold opacity-60" />
                <p className="text-gray-400 text-sm">Ready to record</p>
              </div>
            </div>
          )}

          {state === 'recording' && (
            <div className="absolute top-3 right-3 flex items-center gap-2 bg-red-600 px-2.5 py-1 rounded-full text-white text-xs font-bold animate-pulse">
              <span className="w-2 h-2 bg-white rounded-full" />
              REC {fmtTime(elapsed)}
            </div>
          )}
        </div>

        {/* Progress / countdown bar (during recording) */}
        {state === 'recording' && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-gray-400">
              <span className="flex items-center gap-1"><Clock size={11} /> {fmtTime(elapsed)} recorded</span>
              <span className={remaining <= 60 ? 'text-red-400 font-semibold' : ''}>{fmtTime(remaining)} left</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${pct > 90 ? 'bg-red-500' : 'bg-gold'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Upload progress */}
        {state === 'uploading' && (
          <div className="space-y-2">
            <p className="text-sm text-gray-300">Uploading video…</p>
            <div className="h-2 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gold rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Title input (preview state) */}
        {state === 'preview' && (
          <input
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gold/50"
            placeholder="Add a title for your video…"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={80}
          />
        )}

        {/* Done state */}
        {state === 'done' && (
          <div className="flex items-center gap-2 px-3 py-2 bg-green-500/15 border border-green-500/25 rounded-lg text-green-300 text-sm">
            <Play size={15} />
            Video posted successfully!
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {state === 'idle' && (
            <button
              onClick={startRecording}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
            >
              <Video size={18} /> Start Recording
            </button>
          )}

          {state === 'recording' && (
            <button
              onClick={stopRecording}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white/10 hover:bg-white/15 text-white font-semibold rounded-lg transition-colors border border-white/20"
            >
              <StopCircle size={18} /> Stop Recording
            </button>
          )}

          {state === 'preview' && (
            <>
              <button
                onClick={reset}
                className="flex items-center gap-2 px-4 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-lg transition-colors border border-white/10"
              >
                <Trash2 size={16} /> Discard
              </button>
              <button
                onClick={uploadVideo}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-gold hover:bg-gold/90 text-black font-bold rounded-lg transition-colors"
              >
                <Upload size={18} /> Post Video
              </button>
            </>
          )}

          {state === 'done' && (
            <button
              onClick={reset}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-white/10 hover:bg-white/15 text-white rounded-lg transition-colors border border-white/10"
            >
              Record Another
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
