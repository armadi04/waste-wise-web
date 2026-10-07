import {
  Button,
  Image,
  Modal,
  ModalBody,
  ModalContent,
  Snippet,
} from '@heroui/react'
import { Download, FileIcon } from 'lucide-react'
import type { MediaDetailModalProps } from '@/components/features/media/modal/media-detail-modal/types'
import { useTimeZone } from '@/lib/stores/time-zone'
import { downloadFile } from '@/lib/utils/download'
import { formatBytes } from '@/lib/utils/format'

export function MediaDetailModal({
  isOpen,
  onOpenChange,
  media,
}: MediaDetailModalProps) {
  useTimeZone((s) => s.timeZone)
  if (!media) return null

  return (
    <Modal
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      size="2xl"
      backdrop="blur"
      scrollBehavior="inside"
      classNames={{
        base: 'bg-content1 border border-default-200 rounded-large overflow-hidden',
        closeButton:
          'z-50 top-4 right-4 bg-black/20 hover:bg-black/40 text-white backdrop-blur-md',
      }}
    >
      <ModalContent className="p-0">
        {() => (
          <div className="flex flex-col w-full">
            {/* Improved Media Display Area */}
            <div className="relative flex h-[50vh] min-h-[300px] w-full items-center justify-center bg-default-100/50 p-8 dark:bg-black/40">
              {media.mimetype.startsWith('image/') ? (
                <Image
                  src={media.url || undefined}
                  alt={media.originalName || ''}
                  removeWrapper={false}
                  classNames={{
                    wrapper: 'w-full h-full flex items-center justify-center',
                    img: 'h-full w-auto max-w-full object-contain shadow-medium rounded-large',
                  }}
                  radius="none"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-4 text-default-400">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-default-200">
                    <FileIcon size={40} />
                  </div>
                  <p className="text-sm">Preview not available</p>
                </div>
              )}
            </div>

            {/* Footer / Details Section */}
            <ModalBody className="p-6 bg-content1">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <h3 className="text-lg font-semibold leading-none text-foreground">
                      {media.originalName}
                    </h3>
                    <p className="text-small text-default-500 font-mono">
                      {media.mimetype} • {formatBytes(media.size)}
                    </p>
                  </div>
                  <Button
                    isIconOnly
                    variant="flat"
                    radius="full"
                    onPress={() =>
                      downloadFile(media.url || '', media.originalName || '')
                    }
                    className="shrink-0"
                  >
                    <Download size={18} />
                  </Button>
                </div>

                <Snippet
                  symbol=""
                  variant="flat"
                  className="w-full"
                  classNames={{
                    pre: 'truncate font-mono text-xs',
                    base: 'bg-default-50 border border-default-200',
                  }}
                >
                  {media.url || ''}
                </Snippet>
              </div>
            </ModalBody>
          </div>
        )}
      </ModalContent>
    </Modal>
  )
}
