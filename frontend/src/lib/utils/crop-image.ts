import type { PixelCrop } from 'react-image-crop'

const OUTPUT_SIZE = 300 // px — standard avatar resolution

export async function cropImageToFile(
  image: HTMLImageElement,
  crop: PixelCrop,
): Promise<File> {
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get 2D canvas context')

  const scaleX = image.naturalWidth / image.width
  const scaleY = image.naturalHeight / image.height

  ctx.drawImage(
    image,
    crop.x * scaleX,
    crop.y * scaleY,
    crop.width * scaleX,
    crop.height * scaleY,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  )

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error('Failed to create image blob'))
        resolve(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
      },
      'image/jpeg',
      0.92,
    )
  })
}
