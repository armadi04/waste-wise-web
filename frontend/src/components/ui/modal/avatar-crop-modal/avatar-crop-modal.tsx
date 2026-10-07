import {
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from '@heroui/react'
import { Crop as CropIcon, ScanLine } from 'lucide-react'
import { useEffect, useRef } from 'react'
import ReactCrop from 'react-image-crop'
import type { AvatarCropModalProps } from '@/components/ui/modal/avatar-crop-modal/types'
import { Button, Modal } from '@/components/shared/controls'
import 'react-image-crop/dist/ReactCrop.css'

import { PREVIEW_SIZE } from '@/components/ui/modal/avatar-crop-modal/lib/avatar-crop-modal-helpers'

export function AvatarCropModal({
  isOpen,
  imageSrc,
  crop,
  completedCrop,
  imgRef,
  onCropChange,
  onCropComplete,
  onImageLoad,
  onApply,
  onClose,
  isApplying,
}: AvatarCropModalProps) {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  // Draw live preview whenever the crop selection changes
  useEffect(() => {
    const image = imgRef.current
    const canvas = previewCanvasRef.current
    if (!completedCrop || !image || !canvas || completedCrop.width === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const scaleX = image.naturalWidth / image.width
    const scaleY = image.naturalHeight / image.height

    canvas.width = PREVIEW_SIZE
    canvas.height = PREVIEW_SIZE

    ctx.clearRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE)
    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      PREVIEW_SIZE,
      PREVIEW_SIZE,
    )
  }, [completedCrop, imgRef])

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      size="lg"
      radius="lg"
      isDismissable={!isApplying}
      classNames={{
        backdrop: '!z-[150]',
        wrapper: '!z-[151]',
        base: 'border border-default-200 shadow-xl',
        header: 'border-b border-default-100',
        footer: 'border-t border-default-100',
      }}
    >
      <ModalContent>
        <ModalHeader className="flex gap-3 items-start">
          <div className="flex items-center justify-center w-9 h-9 rounded-large bg-[var(--app-selected-background)] shrink-0 mt-0.5">
            <CropIcon size={18} className="text-[var(--app-link)]" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-default-800 font-semibold">
              Crop Your Avatar
            </span>
            <p className="text-small font-normal text-default-400">
              Drag to reposition · Pull handles to resize
            </p>
          </div>
        </ModalHeader>

        <ModalBody className="py-5 gap-4">
          {/* Crop stage — dark bg makes the circular overlay pop */}
          <div className="rounded-large overflow-hidden bg-black flex items-center justify-center min-h-[300px]">
            {imageSrc && (
              <ReactCrop
                crop={crop}
                onChange={onCropChange}
                onComplete={onCropComplete}
                aspect={1}
                circularCrop
                minWidth={60}
              >
                <img
                  ref={imgRef}
                  src={imageSrc}
                  alt="Crop preview"
                  onLoad={onImageLoad}
                  style={{
                    maxHeight: '400px',
                    maxWidth: '100%',
                    objectFit: 'contain',
                    display: 'block',
                  }}
                />
              </ReactCrop>
            )}
          </div>

          {/* Live preview */}
          <div className="flex items-center gap-4 px-4 py-3 rounded-large bg-default-50 border border-default-100">
            <canvas
              ref={previewCanvasRef}
              className="rounded-full border-2 border-primary/30 shrink-0"
              style={{ width: PREVIEW_SIZE, height: PREVIEW_SIZE }}
            />
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-default-400 uppercase tracking-wider">
                Preview
              </span>
              <span className="text-sm text-default-600">
                This is how your avatar will appear
              </span>
              {!completedCrop?.width && (
                <span className="text-tiny text-default-400 flex items-center gap-1 mt-0.5">
                  <ScanLine size={12} />
                  Select a crop area above to see the preview
                </span>
              )}
            </div>
          </div>
        </ModalBody>

        <ModalFooter>
          <Button
            variant="flat"
            size="sm"
            className="font-semibold"
            onPress={onClose}
            isDisabled={isApplying}
          >
            Cancel
          </Button>
          <Button
            color="primary"
            size="sm"
            onPress={onApply}
            isLoading={isApplying}
            isDisabled={!completedCrop?.width}
            startContent={!isApplying && <CropIcon size={14} />}
          >
            Apply Crop
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  )
}
