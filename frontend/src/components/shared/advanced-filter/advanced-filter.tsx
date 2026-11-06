import {
  DrawerBody,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  PopoverContent,
  PopoverTrigger,
  useDisclosure,
} from '@heroui/react'
import { ListFilter, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button, Drawer, Popover } from '@/components/shared/controls'
import { useMediaQuery } from '@/hooks/global'

interface AdvancedFilterProps {
  /** Number of filters currently applied; drives the badge and Reset state. */
  activeCount: number
  /** Clears every filter owned by this panel. */
  onReset: () => void
  title?: string
  children: ReactNode
}

/**
 * "Filters" button that opens the filter fields in a popover on desktop and a
 * bottom drawer on touch/small screens. Fields are controlled by the caller
 * (URL-backed), so changes apply immediately in both containers.
 */
export function AdvancedFilter({
  activeCount,
  onReset,
  title = 'Filters',
  children,
}: AdvancedFilterProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure()

  const trigger = (onPress?: () => void) => (
    <Button
      size="sm"
      variant="bordered"
      className="border-default-200"
      startContent={<ListFilter size={14} />}
      onPress={onPress}
      aria-haspopup="dialog"
    >
      {title}
      {activeCount > 0 && (
        <span
          aria-label={`${activeCount} active filters`}
          className="ml-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-semibold leading-none text-primary-foreground"
        >
          {activeCount}
        </span>
      )}
    </Button>
  )

  const resetButton = (
    <Button
      size="sm"
      variant="light"
      startContent={<RotateCcw size={14} />}
      isDisabled={activeCount === 0}
      onPress={onReset}
    >
      Reset
    </Button>
  )

  if (isDesktop) {
    return (
      <Popover
        placement="bottom-end"
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        shouldCloseOnScroll={false}
      >
        <PopoverTrigger>{trigger()}</PopoverTrigger>
        <PopoverContent className="w-[26rem] max-w-[calc(100vw-2rem)] items-stretch gap-3 p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">{title}</h3>
            {resetButton}
          </div>
          {children}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <>
      {trigger(onOpen)}
      <Drawer
        isOpen={isOpen}
        onOpenChange={onOpenChange}
        placement="bottom"
        classNames={{ base: 'rounded-t-[28px] max-h-[85dvh]' }}
      >
        <DrawerContent>
          <DrawerHeader className="flex items-center justify-between pr-12">
            <span>{title}</span>
            {resetButton}
          </DrawerHeader>
          <DrawerBody className="pb-2">{children}</DrawerBody>
          <DrawerFooter className="pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button color="primary" className="w-full" onPress={onClose}>
              Show results
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  )
}
