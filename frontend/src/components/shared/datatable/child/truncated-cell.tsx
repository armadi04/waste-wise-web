import { PopoverContent, PopoverTrigger } from '@heroui/react'
import React from 'react'
import { Popover } from '@/components/shared/controls'

export function TruncatedCell({
  children,
  maxWidth = 200,
}: {
  children: React.ReactNode
  maxWidth?: number
}) {
  // Ref lives on the block-level div — inline elements return scrollWidth=0 per spec.
  const outerRef = React.useRef<HTMLDivElement>(null)
  const [isOverflowing, setIsOverflowing] = React.useState(false)
  const [isOpen, setIsOpen] = React.useState(false)

  React.useEffect(() => {
    const el = outerRef.current
    if (!el) return
    const check = () => setIsOverflowing(el.scrollWidth > el.clientWidth)
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // The outer div is always stable (ref + mouse events never move).
  // Popover is mounted inside it only once overflow is confirmed, so
  // the PopoverTrigger ref never conflicts with our measurement ref.
  return (
    <div
      ref={outerRef}
      style={{ maxWidth }}
      className={`truncate${isOverflowing ? ' cursor-help' : ''}`}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {isOverflowing ? (
        <Popover
          classNames={{ content: 'shadow-xl' }}
          isOpen={isOpen}
          onOpenChange={() => {}}
          placement="top"
          offset={6}
          showArrow
        >
          <PopoverTrigger>
            <span>{children}</span>
          </PopoverTrigger>
          <PopoverContent>
            <div
              style={{ maxWidth: 360 }}
              className="text-sm whitespace-normal break-words py-1 px-0.5"
            >
              {children}
            </div>
          </PopoverContent>
        </Popover>
      ) : (
        children
      )}
    </div>
  )
}
