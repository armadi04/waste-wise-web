import { Button, Input } from '@heroui/react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import type { CouponGalleryImage } from '@/types/portal'
import { reorder } from '@/components/features/portal/components/coupon-editor/lib/coupon-editor-helpers'
import { useUserPermission } from '@/hooks/permissions'
import { mediaQueryOptions } from '@/lib/query/options'
import { uploadMedia } from '@/lib/services/media.service'

export function GalleryEditor({
  value,
  onChange,
  readOnly,
  onBusyChange,
}: {
  value: Array<CouponGalleryImage>
  onChange: (value: Array<CouponGalleryImage>) => void
  readOnly: boolean
  onBusyChange?: (busy: boolean) => void
}) {
  const draftRef = useRef(value)
  draftRef.current = value
  const fileRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState('')
  const [uploadError, setUploadError] = useState('')
  const photoCount = value.filter((item) => item.url.trim()).length
  const locked = readOnly || uploading
  const addPhoto = (image: CouponGalleryImage) => {
    const current = draftRef.current
    const empty = current.findIndex((item) => !item.url.trim())
    const next =
      empty >= 0
        ? current.map((item, index) => (index === empty ? image : item))
        : [...current, image]
    draftRef.current = next
    onChange(next)
  }
  const upload = async (files: Array<File>) => {
    setUploadError('')
    if (!files.length) return
    if (photoCount + files.length > 10) {
      setUploadError('Maximum 10 photos. Select fewer files.')
      return
    }
    if (files.some((file) => !file.type.startsWith('image/'))) {
      setUploadError('Choose image files only.')
      return
    }
    setUploading(true)
    onBusyChange?.(true)
    const failed: Array<string> = []
    for (const [index, file] of files.entries()) {
      setProgress(`Uploading ${index + 1}/${files.length}`)
      try {
        const media = await uploadMedia(file)
        if (
          !media.url ||
          media.isPrivate ||
          !media.mimetype.startsWith('image/') ||
          media.url.length > 255
        )
          throw new Error('Invalid public image')
        addPhoto({ url: media.url, alt: media.originalName ?? file.name })
      } catch {
        failed.push(file.name)
      }
    }
    setUploading(false)
    onBusyChange?.(false)
    setProgress('')
    if (failed.length)
      setUploadError(
        `Upload failed: ${failed.join(', ')}. Your draft is preserved.`,
      )
    await queryClient.invalidateQueries({ queryKey: ['media'] })
  }
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const { hasPermission } = useUserPermission()
  const query = useQuery({
    ...mediaQueryOptions({
      page,
      limit: 12,
      search,
      sort: 'createdAt',
      direction: 'desc',
    }),
    enabled: libraryOpen && hasPermission('media.read'),
  })
  const update = (index: number, changes: Partial<CouponGalleryImage>) =>
    onChange(
      value.map((item, i) => (i === index ? { ...item, ...changes } : item)),
    )
  return (
    <section className="col-span-full grid gap-3 rounded-xl border border-default-200 p-4">
      <div className="flex justify-between">
        <h3 className="font-semibold">Photo gallery</h3>
        <span className="text-sm">{photoCount}/10</span>
      </div>
      {value.length > 10 && (
        <p role="alert" className="text-sm text-danger">
          Reduce this gallery to 10 photos before saving.
        </p>
      )}
      {uploadError && (
        <p role="alert" className="text-sm text-danger">
          {uploadError}
        </p>
      )}
      {progress && (
        <p role="status" className="text-sm">
          {progress}
        </p>
      )}
      <p className="text-sm text-default-500">
        The first photo is the cover. Up to 10 photos.
      </p>
      {value.map((image, index) => (
        <div
          key={index}
          className="grid gap-3 rounded-lg bg-default-50 p-3 sm:grid-cols-[96px_1fr_auto]"
        >
          {image.url ? (
            <img
              src={image.url}
              alt={image.alt}
              className="h-20 w-24 rounded-lg object-cover"
            />
          ) : (
            <span className="grid h-20 place-items-center text-xs text-default-500">
              No photo
            </span>
          )}
          <div className="grid gap-2">
            <Input
              label={`Photo ${index + 1} URL`}
              value={image.url}
              onValueChange={(url) => update(index, { url })}
              isReadOnly={locked}
            />
            <Input
              label="Alternative text"
              value={image.alt}
              onValueChange={(alt) => update(index, { alt })}
              isReadOnly={locked}
            />
          </div>
          {!readOnly && (
            <div className="flex gap-1 sm:flex-col">
              <Button
                type="button"
                isIconOnly
                size="sm"
                aria-label={`Move photo ${index + 1} up`}
                isDisabled={locked || index === 0}
                onPress={() => onChange(reorder(value, index, -1))}
              >
                <ArrowUp size={15} />
              </Button>
              <Button
                type="button"
                isIconOnly
                size="sm"
                aria-label={`Move photo ${index + 1} down`}
                isDisabled={locked || index === value.length - 1}
                onPress={() => onChange(reorder(value, index, 1))}
              >
                <ArrowDown size={15} />
              </Button>
              <Button
                type="button"
                isIconOnly
                size="sm"
                color="danger"
                isDisabled={locked}
                aria-label={`Remove photo ${index + 1}`}
                onPress={() => onChange(value.filter((_, i) => i !== index))}
              >
                <Trash2 size={15} />
              </Button>
            </div>
          )}
        </div>
      ))}
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          {hasPermission('media.create') && (
            <>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*"
                aria-label="Upload coupon photos"
                className="hidden"
                onChange={(event) => {
                  void upload(Array.from(event.target.files ?? []))
                  event.target.value = ''
                }}
              />
              <Button
                type="button"
                variant="flat"
                isDisabled={photoCount >= 10 || locked}
                onPress={() => fileRef.current?.click()}
              >
                Upload photos
              </Button>
            </>
          )}
          <Button
            type="button"
            variant="flat"
            isDisabled={value.length >= 10 || locked}
            onPress={() => onChange([...value, { url: '', alt: '' }])}
          >
            <Plus size={16} />
            Add URL
          </Button>
          {hasPermission('media.read') && (
            <Button
              type="button"
              variant="flat"
              isDisabled={locked}
              onPress={() => setLibraryOpen(!libraryOpen)}
            >
              Choose from media
            </Button>
          )}
        </div>
      )}
      {libraryOpen && !readOnly && (
        <div className="grid gap-3">
          <Input
            label="Search media"
            value={search}
            onValueChange={(text) => {
              setSearch(text)
              setPage(1)
            }}
          />
          {query.isLoading ? (
            <p className="text-sm">Loading media...</p>
          ) : query.isError ? (
            <Button type="button" onPress={() => void query.refetch()}>
              Retry media
            </Button>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2">
                {query.data?.data
                  .filter(
                    (item) =>
                      item.mimetype.startsWith('image/') &&
                      item.url &&
                      !item.isPrivate,
                  )
                  .map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      disabled={photoCount >= 10 || locked}
                      onClick={() => {
                        if (item.url)
                          addPhoto({
                            url: item.url,
                            alt: item.originalName ?? '',
                          })
                        setLibraryOpen(false)
                      }}
                      className="rounded-lg border border-default-200 p-2"
                    >
                      <img
                        src={item.url ?? ''}
                        alt={item.originalName ?? ''}
                        className="h-20 w-full rounded object-cover"
                      />
                      <span className="block truncate text-xs">
                        {item.originalName}
                      </span>
                    </button>
                  ))}
              </div>
              <div className="flex items-center justify-between">
                <Button
                  type="button"
                  size="sm"
                  isDisabled={page === 1}
                  onPress={() => setPage(page - 1)}
                >
                  Previous
                </Button>
                <span className="text-sm">Page {page}</span>
                <Button
                  type="button"
                  size="sm"
                  isDisabled={page >= (query.data?.meta.lastPage ?? 1)}
                  onPress={() => setPage(page + 1)}
                >
                  Next
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  )
}
