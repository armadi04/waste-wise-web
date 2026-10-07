import jsQR from 'jsqr'
import { useEffect, useRef, useState } from 'react'

export function useCameraQr(active: boolean, onDecode: (text: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!active) return
    let stream: MediaStream | null = null
    let frame = 0
    let stopped = false
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { willReadFrequently: true })
    const tick = () => {
      const video = videoRef.current
      if (stopped || !video || !context) return
      if (video.readyState === video.HAVE_ENOUGH_DATA && video.videoWidth) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        context.drawImage(video, 0, 0, canvas.width, canvas.height)
        const image = context.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(image.data, image.width, image.height, {
          inversionAttempts: 'dontInvert',
        })
        if (code?.data) {
          onDecode(code.data)
          return
        }
      }
      frame = requestAnimationFrame(tick)
    }
    setError('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setError(
        'This browser cannot access a camera. Use a USB scanner or paste the code.',
      )
      return
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      .then(async (media) => {
        if (stopped) {
          media.getTracks().forEach((track) => track.stop())
          return
        }
        stream = media
        const video = videoRef.current
        if (!video) return
        video.srcObject = media
        await video.play()
        frame = requestAnimationFrame(tick)
      })
      .catch(() =>
        setError('Camera permission was denied or no camera is available.'),
      )
    return () => {
      stopped = true
      cancelAnimationFrame(frame)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [active, onDecode])
  return { videoRef, error }
}
