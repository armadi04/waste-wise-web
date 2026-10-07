import { useCallback, useEffect, useRef, useState } from 'react'
import { centerCrop, makeAspectCrop } from 'react-image-crop'
import type { Crop, PixelCrop } from 'react-image-crop'
import { cropImageToFile } from '@/lib/utils/crop-image'

export interface CropResult {
  file: File
  previewUrl: string
}

export interface UseAvatarCropReturn {
  imageSrc: string | null
  crop: Crop | undefined
  completedCrop: PixelCrop | undefined
  imgRef: React.RefObject<HTMLImageElement | null>
  isOpen: boolean
  isApplying: boolean
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void
  onCropChange: (crop: Crop) => void
  onCropComplete: (crop: PixelCrop) => void
  onImageLoad: (e: React.SyntheticEvent<HTMLImageElement>) => void
  onApply: () => Promise<CropResult | null>
  onClose: () => void
}

export function useAvatarCrop(): UseAvatarCropReturn {
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState<Crop | undefined>()
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | undefined>()
  const [isOpen, setIsOpen] = useState(false)
  const [isApplying, setIsApplying] = useState(false)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const activePreviewUrl = useRef<string | null>(null)

  // Revoke object URL on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (activePreviewUrl.current) {
        URL.revokeObjectURL(activePreviewUrl.current)
      }
    }
  }, [])

  const onFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    // Reset so selecting the same file again re-triggers onChange
    e.target.value = ''

    const reader = new FileReader()
    reader.onload = () => {
      setImageSrc(reader.result as string)
      setCrop(undefined)
      setCompletedCrop(undefined)
      setIsOpen(true)
    }
    reader.readAsDataURL(file)
  }, [])

  // Center a square crop covering 80% of the image on load
  const onImageLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const { width, height } = e.currentTarget
      const centeredCrop = centerCrop(
        makeAspectCrop({ unit: '%', width: 80 }, 1, width, height),
        width,
        height,
      )
      setCrop(centeredCrop)
    },
    [],
  )

  const onCropChange = useCallback((c: Crop) => setCrop(c), [])
  const onCropComplete = useCallback((c: PixelCrop) => setCompletedCrop(c), [])

  const onApply = useCallback(async (): Promise<CropResult | null> => {
    if (!imgRef.current || !completedCrop) return null

    setIsApplying(true)
    try {
      const file = await cropImageToFile(imgRef.current, completedCrop)

      // Revoke previous preview URL before creating new one
      if (activePreviewUrl.current) {
        URL.revokeObjectURL(activePreviewUrl.current)
      }
      const previewUrl = URL.createObjectURL(file)
      activePreviewUrl.current = previewUrl

      setIsOpen(false)
      return { file, previewUrl }
    } catch {
      return null
    } finally {
      setIsApplying(false)
    }
  }, [completedCrop])

  const onClose = useCallback(() => {
    setIsOpen(false)
    setImageSrc(null)
    setCrop(undefined)
    setCompletedCrop(undefined)
  }, [])

  return {
    imageSrc,
    crop,
    completedCrop,
    imgRef,
    isOpen,
    isApplying,
    onFileSelect,
    onCropChange,
    onCropComplete,
    onImageLoad,
    onApply,
    onClose,
  }
}
