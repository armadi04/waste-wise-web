import type { RefObject, SyntheticEvent } from 'react'
import type { Crop, PixelCrop } from 'react-image-crop'
import 'react-image-crop/dist/ReactCrop.css'

export interface AvatarCropModalProps {
  isOpen: boolean
  imageSrc: string | null
  crop: Crop | undefined
  completedCrop: PixelCrop | undefined
  imgRef: RefObject<HTMLImageElement | null>
  onCropChange: (crop: Crop) => void
  onCropComplete: (crop: PixelCrop) => void
  onImageLoad: (e: SyntheticEvent<HTMLImageElement>) => void
  onApply: () => Promise<unknown>
  onClose: () => void
  isApplying: boolean
}
