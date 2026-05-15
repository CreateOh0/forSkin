'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { Camera, RotateCcw } from 'lucide-react'

interface Props {
  onCapture: (blob: Blob) => void
  onError: (error: string) => void
}

export function CameraCapture({ onCapture, onError }: Props) {
  const t = useTranslations('Analyze')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [isActive, setIsActive] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setIsActive(true)
      }
    } catch {
      onError(t('cameraError'))
    }
  }, [facingMode, onError, t])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setIsActive(false)
  }, [])

  const capture = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')!.drawImage(video, 0, 0)
    canvas.toBlob(
      (blob) => {
        if (blob) {
          stopCamera()
          onCapture(blob)
        }
      },
      'image/jpeg',
      0.92
    )
  }, [stopCamera, onCapture])

  const flipCamera = useCallback(() => {
    stopCamera()
    setFacingMode((prev) => (prev === 'user' ? 'environment' : 'user'))
  }, [stopCamera])

  useEffect(() => () => stopCamera(), [stopCamera])

  return (
    <div className="relative w-full max-w-md mx-auto">
      <div className="relative aspect-[3/4] bg-zinc-900 rounded-xl overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
        {isActive && (
          <>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-52 h-72 border-2 border-white/50 rounded-full" />
            </div>
            <button
              onClick={flipCamera}
              className="absolute top-3 right-3 p-2 bg-black/40 rounded-full text-white"
              aria-label="Flip camera"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          </>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      <div className="flex gap-3 mt-4 justify-center">
        {!isActive ? (
          <Button onClick={startCamera} size="lg" className="gap-2">
            <Camera className="w-4 h-4" />
            {t('startCamera')}
          </Button>
        ) : (
          <>
            <Button variant="outline" onClick={stopCamera}>
              {t('retake')}
            </Button>
            <Button onClick={capture} size="lg">
              {t('capturePhoto')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
